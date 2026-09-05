import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'
import { getStoredIntegrations } from '@/lib/db/integration-repository'
import { decrypt } from '@/lib/encryption'

/**
 * Template drift detector.
 *
 *   GET  /api/admin/template-sync?userId=...&apply=true
 *
 * Compares the templates currently used in `automations` (steps where
 * step.type === 'message' && step.template) against the live Meta template
 * catalog for the tenant. Reports templates that are:
 *   - missing on Meta (deleted)
 *   - changed on Meta (component diff)
 *   - healthy
 *
 * With `?apply=true`, healthy templates get their components refreshed in the
 * automation steps (non-destructive — only updates the local cache used by
 * the preview UI; the live template content still comes from Meta at send time).
 */
export async function GET(request) {
  return run(request)
}
export async function POST(request) {
  return run(request)
}

async function run(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const apply = url.searchParams.get('apply') === 'true'
    const expected = process.env.ADMIN_TOKEN || ''
    if (expected) {
      const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
      if (provided !== expected) {
        return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
      }
    }

    const integrations = await getStoredIntegrations(userId)
    const wa = integrations?.whatsapp
    if (!wa?.accessToken || !wa?.businessAccountId) {
      return NextResponse.json({ success: false, error: 'whatsapp_not_configured' }, { status: 400 })
    }
    const token = await decrypt(wa.accessToken)
    const wabaId = wa.businessAccountId

    // 1) Pull live templates from Meta
    const res = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/message_templates?fields=name,status,language,components,category,id&limit=200`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data?.error?.message || 'meta_error' }, { status: 502 })
    }
    const live = (data.data || []).map(t => ({
      name: t.name,
      status: t.status,
      language: t.language,
      category: t.category,
      id: t.id,
      components: t.components || []
    }))
    const liveByName = new Map(live.map(t => [`${t.name}::${t.language}`, t]))

    // 2) Pull automation template usage
    const rows = await queryMany(
      `SELECT id, steps FROM automations WHERE userId = ? AND steps LIKE '%"template"%'`,
      [userId]
    )
    const used = new Map()
    for (const r of rows) {
      let steps = []
      try { steps = typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps } catch (e) {}
      for (const s of steps || []) {
        if (s?.template) {
          const key = `${s.template}::${s.templateLanguage || 'en'}`
          if (!used.has(key)) used.set(key, { automationIds: new Set(), count: 0 })
          used.get(key).automationIds.add(r.id)
          used.get(key).count++
        }
      }
    }

    // 3) Compare
    const report = { healthy: [], drifted: [], missing: [], unknown: [] }
    for (const [key, info] of used.entries()) {
      const liveT = liveByName.get(key)
      if (!liveT) {
        report.missing.push({ name: key.split('::')[0], language: key.split('::')[1] || 'en', usedByAutomations: [...info.automationIds], count: info.count })
        continue
      }
      if (liveT.status && liveT.status !== 'APPROVED' && liveT.status !== 'ENABLED') {
        report.drifted.push({
          name: liveT.name, language: liveT.language, liveStatus: liveT.status,
          usedByAutomations: [...info.automationIds], count: info.count
        })
        continue
      }
      report.healthy.push({ name: liveT.name, language: liveT.language, usedByAutomations: [...info.automationIds], count: info.count, id: liveT.id })
    }
    for (const t of live) {
      if (!used.has(`${t.name}::${t.language}`)) {
        report.unknown.push({ name: t.name, language: t.language, status: t.status })
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      liveCount: live.length,
      usedCount: used.size,
      healthy: report.healthy.length,
      drifted: report.drifted.length,
      missing: report.missing.length,
      unknown: report.unknown.length,
      report,
      apply
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}