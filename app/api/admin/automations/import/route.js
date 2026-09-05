import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/mysql'

/**
 * POST /api/admin/automations/import
 *   body: {
 *     userId,
 *     automations: [{ id?, name, status, source, summary, steps, metrics }],
 *     mode: 'merge' | 'replace'   (default merge)
 *   }
 *
 * Upserts each automation in the document. If `mode=replace` we delete
 * existing rows for the userId first (DANGEROUS — opt-in only).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = body.userId || 'default'
    const automations = Array.isArray(body.automations) ? body.automations : []
    const mode = body.mode === 'replace' ? 'replace' : 'merge'
    if (automations.length === 0) {
      return NextResponse.json({ success: false, error: 'automations[] required' }, { status: 400 })
    }

    if (mode === 'replace') {
      await query(`DELETE FROM automations WHERE userId = ?`, [userId])
    }

    let imported = 0
    let skipped = 0
    for (const a of automations) {
      if (!a || !a.id || !a.name) { skipped++; continue }
      const steps = JSON.stringify(Array.isArray(a.steps) ? a.steps : [])
      const metrics = JSON.stringify(a.metrics || { sent: 0, openRate: 0, conversions: 0 })
      await query(
        `INSERT INTO automations (id, userId, name, status, source, summary, steps, metrics, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), status = VALUES(status), source = VALUES(source),
           summary = VALUES(summary), steps = VALUES(steps), metrics = VALUES(metrics),
           updatedAt = NOW()`,
        [a.id, userId, a.name, a.status || 'inactive', a.source || 'Import',
         a.summary || '', steps, metrics]
      )
      imported++
    }
    return NextResponse.json({ success: true, mode, imported, skipped, total: automations.length })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}