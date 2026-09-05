import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'
import { defaultAutomations } from '@/lib/automation-defaults'

/**
 * GET /api/admin/automations/export?userId=...&includeDefaults=false
 *
 * Returns a JSON document with all automations for a tenant (DB rows only,
 * by default). Suitable for backup / migration to another instance.
 */
export async function GET(request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const includeDefaults = url.searchParams.get('includeDefaults') === 'true'

  const rows = await queryMany(
    `SELECT id, name, status, source, summary, steps, metrics, updatedAt
     FROM automations
     WHERE userId = ?
     ORDER BY updatedAt DESC`,
    [userId]
  )

  const parseJson = (v) => {
    if (typeof v !== 'string') return v
    try { return JSON.parse(v) } catch (e) { return null }
  }
  const automations = rows.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    source: r.source,
    summary: r.summary,
    steps: parseJson(r.steps) || [],
    metrics: parseJson(r.metrics) || { sent: 0, openRate: 0, conversions: 0 },
    updatedAt: r.updatedAt
  }))

  const doc = {
    schema: 'chatflow.automations/v1',
    userId,
    exportedAt: new Date().toISOString(),
    count: automations.length,
    automations
  }
  if (includeDefaults) {
    doc.defaults = defaultAutomations
  }
  return NextResponse.json(doc)
}