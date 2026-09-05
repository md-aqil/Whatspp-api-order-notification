import { query, queryOne, queryMany } from '../mysql'
import { sendNotification } from '../notify/notifications'
import { triggerAutomationEvent } from '../automation-engine'
import { getStoredIntegrations } from '../db/integration-repository'

/**
 * Auto-rollback helper.
 *
 *   - Compares this week vs last week of cart_recovery_sessions revenue.
 *   - If the drop is >= dropPct (default 20%), fires:
 *       1) a notification to the owner (email + WhatsApp if configured)
 *       2) the `customer.csat_followup` automation event so the on-call
 *          flow can ask recent customers for a quick rating.
 *   - Dedup is keyed by ISO week so we don't spam during a sustained dip.
 *
 * Wired into /api/cron/regression-check (one-shot) and exported as a
 * library function for unit testing / ad-hoc invocation.
 */
const DEFAULT_DROP_PCT = 20
const DEFAULT_MIN_BASELINE_USD = 100

export async function runCartRecoveryRegressionCheck({ userId = 'default', dropPct = DEFAULT_DROP_PCT, minBaselineUsd = DEFAULT_MIN_BASELINE_USD, notify = true } = {}) {
  const lastWeek = await queryOne(
    `SELECT COALESCE(SUM(CAST(o.total AS DECIMAL(12,2))), 0) AS revenue,
            COUNT(DISTINCT o.id) AS orders
     FROM orders o
     JOIN cart_recovery_sessions crs
       ON crs.userId = o.userId
      AND crs.recovered_order_id = o.id
     WHERE o.userId = ?
       AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId]
  ).catch(() => null)
  const prevWeek = await queryOne(
    `SELECT COALESCE(SUM(CAST(o.total AS DECIMAL(12,2))), 0) AS revenue,
            COUNT(DISTINCT o.id) AS orders
     FROM orders o
     JOIN cart_recovery_sessions crs
       ON crs.userId = o.userId
      AND crs.recovered_order_id = o.id
     WHERE o.userId = ?
       AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       AND o.createdAt < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId]
  ).catch(() => null)

  const last = Number(lastWeek?.revenue || 0)
  const prev = Number(prevWeek?.revenue || 0)
  const deltaPct = prev > 0 ? Number((((last - prev) / prev) * 100).toFixed(2)) : 0
  const weekKey = isoWeekKey(new Date())

  // Not enough data → skip
  if (prev < minBaselineUsd) {
    return { triggered: false, reason: 'insufficient_baseline', last, prev, deltaPct, weekKey }
  }
  // Up or flat → no alert
  if (deltaPct > -dropPct) {
    return { triggered: false, reason: 'within_threshold', last, prev, deltaPct, weekKey }
  }

  // Idempotency: don't re-fire for the same week
  const existing = await queryOne(
    `SELECT id FROM metric_alerts WHERE userId = ? AND kind = ? AND windowKey = ? LIMIT 1`,
    [userId, 'cart_recovery_regression', weekKey]
  ).catch(() => null)
  if (existing) {
    return { triggered: false, reason: 'already_fired', weekKey, last, prev, deltaPct }
  }

  await query(
    `INSERT INTO metric_alerts (userId, kind, windowKey, metricValue, previousValue, deltaPct, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, 'cart_recovery_regression', weekKey, last, prev, deltaPct, JSON.stringify({ orders: Number(lastWeek?.orders || 0) })]
  ).catch(() => null)

  if (notify) {
    await sendNotification({
      userId,
      channel: 'email',
      kind: 'cart_recovery_regression',
      subject: `Cart-recovery revenue dropped ${Math.abs(deltaPct).toFixed(0)}% week-over-week`,
      body: `Recovered revenue this week: $${last.toFixed(2)} (orders ${Number(lastWeek?.orders || 0)}). Previous week: $${prev.toFixed(2)} (orders ${Number(prevWeek?.orders || 0)}). Drop: ${deltaPct.toFixed(2)}%. A CSAT follow-up event has been fired for recent customers — review the automation in the dashboard.`
    }).catch(() => null)
  }

  // Fire a CSAT follow-up event so the engine can run a default like
  // `default-post-delivery-csat` for any customer whose order was recovered
  // in the last 14 days.
  try {
    const integrations = await getStoredIntegrations(userId)
    const recent = await queryMany(
      `SELECT DISTINCT o.customerPhone AS phone
       FROM orders o
       JOIN cart_recovery_sessions crs
         ON crs.userId = o.userId
        AND crs.recovered_order_id = o.id
       WHERE o.userId = ?
         AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)
         AND o.customerPhone IS NOT NULL
       LIMIT 200`,
      [userId]
    )
    for (const r of recent) {
      await triggerAutomationEvent('customer.csat_followup', {
        customer_phone: r.phone,
        customerPhone: r.phone,
        reason: 'cart_recovery_regression',
        deltaPct,
        weekKey
      }, integrations, userId).catch(() => null)
    }
  } catch (err) {
    // best-effort
  }

  return { triggered: true, last, prev, deltaPct, weekKey }
}

function isoWeekKey(d) {
  // ISO 8601 week, e.g. 2026-W36
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}