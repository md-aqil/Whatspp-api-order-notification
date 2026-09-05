import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from '@/lib/mysql'

/**
 * Per-tenant contact-form ingest endpoint.
 *
 *   POST /api/leads/ingest
 *     body: {
 *       userId,
 *       name, phone, email, message?,
 *       source?,          // 'contact-form' | 'landing-page' | ...
 *       pageUrl?, utmSource?, utmCampaign?, metadata?
 *     }
 *
 * The endpoint is intentionally CORS-open with simple validation so landing
 * pages / external sites can POST to it directly.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body.userId || 'default').slice(0, 64)
    const name = String(body.name || '').trim().slice(0, 255) || null
    const phone = normalizePhone(body.phone)
    const email = String(body.email || '').trim().slice(0, 255) || null
    if (!name && !phone && !email) {
      return NextResponse.json({ success: false, error: 'name, phone, or email required' }, { status: 400 })
    }
    const source = String(body.source || 'contact-form').slice(0, 64)
    const pageUrl = String(body.pageUrl || '').slice(0, 512) || null
    const utmSource = String(body.utmSource || '').slice(0, 128) || null
    const utmCampaign = String(body.utmCampaign || '').slice(0, 128) || null
    const message = String(body.message || '').slice(0, 4000) || null
    const metadata = body.metadata && typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : null

    const id = uuidv4()
    await query(
      `INSERT INTO leads (id, userId, name, phone, email, source, pageUrl, utmSource, utmCampaign, message, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
      [id, userId, name, phone, email, source, pageUrl, utmSource, utmCampaign, message, metadata]
    )

    // Auto-trigger the `lead.created` automation event (no-op if no template matches)
    try {
      const { triggerAutomationEvent } = await import('@/lib/automation-engine')
      const { getStoredIntegrations } = await import('@/lib/db/integration-repository')
      const integrations = await getStoredIntegrations(userId)
      await triggerAutomationEvent('lead.created', {
        lead_id: id,
        customer_phone: phone,
        customerPhone: phone,
        customer_name: name,
        customer_email: email,
        source, pageUrl, utmSource, utmCampaign, message
      }, integrations, userId)
    } catch (e) {
      // best-effort
    }

    return NextResponse.json({ success: true, id, status: 'new' })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const status = url.searchParams.get('status') || null
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200)
  const where = ['userId = ?']
  const params = [userId]
  if (status) { where.push('status = ?'); params.push(status) }
  const rows = await queryMany(
    `SELECT id, name, phone, email, source, pageUrl, utmSource, utmCampaign, status, createdAt
     FROM leads WHERE ${where.join(' AND ')} ORDER BY createdAt DESC LIMIT ?`,
    [...params, limit]
  ).catch(() => [])
  return NextResponse.json({ success: true, userId, count: rows.length, leads: rows })
}

function normalizePhone(p) {
  if (!p) return null
  const s = String(p).replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (s.length < 7 || s.length > 15) return null
  return s
}