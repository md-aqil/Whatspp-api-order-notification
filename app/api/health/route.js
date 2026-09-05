import { NextResponse } from 'next/server'
import { queryOne, queryMany } from '@/lib/mysql'
import { defaultAutomations } from '@/lib/automation-defaults'

/**
 * GET /api/health
 *
 * A liveness + integrity probe. Exercises:
 *   - DB connectivity
 *   - Cron playbook + last-run freshness
 *   - Webhook health roll-up
 *   - Default automations presence + parser health
 *   - Customer segment cardinality
 *   - Each automation engine step type referenced in defaults is at least
 *     a known type
 *
 * Returns:
 *   {
 *     ok: boolean,
 *     checks: [{ name, status: 'ok'|'warn'|'fail', detail }],
 *     summary: { db, webhooks, cron, automations, lastCron, counts }
 *   }
 */
export async function GET() {
  const checks = []
  const summary = {}

  // 1) DB connectivity
  try {
    const t = await queryOne('SELECT NOW() AS now')
    checks.push({ name: 'db', status: 'ok', detail: t?.now || 'connected' })
    summary.db = 'ok'
  } catch (e) {
    checks.push({ name: 'db', status: 'fail', detail: e.message })
    summary.db = 'fail'
  }

  // 2) Defaults present and step types known
  try {
    const KNOWN_STEP_TYPES = new Set([
      'trigger', 'message', 'interactive', 'condition', 'delay', 'ai', 'switch',
      'ab_split', 'shopify_discount', 'shopify_refund', 'shopify_gift_card',
      'product_list', 'product_carousel', 'single_product', 'channel_post',
      'add_to_wishlist', 'back_in_stock_subscribe', 'inventory_snapshot',
      'record_feedback', 'assign_referral', 'spin_wheel',
      'tag_audience', 'business_hours', 'language_detect', 'handoff_summary',
      'opt_in', 'vip_perk'
    ])
    const unknown = []
    for (const a of defaultAutomations) {
      for (const s of a.steps || []) {
        if (!KNOWN_STEP_TYPES.has(s.type)) unknown.push(`${a.id}::${s.type}`)
      }
    }
    summary.automations = { total: defaultAutomations.length, unknown }
    checks.push({
      name: 'automations',
      status: unknown.length === 0 ? 'ok' : 'warn',
      detail: `${defaultAutomations.length} defaults loaded, ${unknown.length} unknown step types`
    })
  } catch (e) {
    checks.push({ name: 'automations', status: 'fail', detail: e.message })
  }

  // 3) Last cron run freshness
  try {
    const row = await queryOne(
      `SELECT kind, ranAt, TIMESTAMPDIFF(HOUR, ranAt, NOW()) AS ageHours
       FROM cron_runs ORDER BY ranAt DESC LIMIT 1`
    )
    if (!row) {
      summary.lastCron = null
      checks.push({ name: 'cron', status: 'warn', detail: 'no runs recorded yet' })
    } else if (row.ageHours > 24) {
      summary.lastCron = { kind: row.kind, ageHours: row.ageHours }
      checks.push({ name: 'cron', status: 'warn', detail: `last run was ${row.ageHours}h ago (${row.kind})` })
    } else {
      summary.lastCron = { kind: row.kind, ageHours: row.ageHours }
      checks.push({ name: 'cron', status: 'ok', detail: `last run ${row.ageHours}h ago (${row.kind})` })
    }
  } catch (e) {
    checks.push({ name: 'cron', status: 'warn', detail: 'cron_runs table not yet present (run setup-mysql-tables.js)' })
  }

  // 4) Webhook recency
  try {
    const row = await queryOne(
      `SELECT MAX(receivedAt) AS lastAt, COUNT(*) AS total
       FROM webhook_logs WHERE receivedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    )
    summary.webhooks = { lastAt: row?.lastAt || null, last7d: Number(row?.total || 0) }
    if (!row?.lastAt) {
      checks.push({ name: 'webhooks', status: 'warn', detail: 'no webhook deliveries in 7d' })
    } else {
      checks.push({ name: 'webhooks', status: 'ok', detail: `${row.total} deliveries in last 7d, latest ${row.lastAt}` })
    }
  } catch (e) {
    checks.push({ name: 'webhooks', status: 'fail', detail: e.message })
  }

  // 5) Card counts
  try {
    const counts = await queryOne(
      `SELECT
         (SELECT COUNT(*) FROM customer_segments) AS customers,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM messages WHERE sentAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS messages30d`
    )
    summary.counts = counts
  } catch (e) {
    summary.counts = { error: e.message }
  }

  // 6) Outbound idempotency
  try {
    const row = await queryOne(
      `SELECT COUNT(*) AS total, SUM(usedCount > 1) AS dups
       FROM outbound_idempotency WHERE lastUsedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    )
    summary.outbound = {
      total7d: Number(row?.total || 0),
      duplicates7d: Number(row?.dups || 0)
    }
  } catch (e) {
    summary.outbound = { error: e.message }
  }

  const ok = checks.every(c => c.status === 'ok')
  return NextResponse.json({ success: true, ok, checks, summary, version: 1, ts: new Date().toISOString() })
}
