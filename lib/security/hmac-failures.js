import { query, queryOne } from '../mysql'
import { sendNotification } from '../notify/notifications'
import { getStoredIntegrations, saveStoredIntegration } from '../db/integration-repository'

/**
 * Webhook secret rotation helper.
 *
 * Tracks consecutive HMAC failures in a small `hmac_failures` table. When a
 * tenant crosses `threshold` (default 5) within `windowMinutes` (default 30),
 * the offending integration is auto-disabled and the owner is notified.
 *
 * Called by lib/webhooks/shopify.js on every signature failure, and exposed
 * via:
 *   - recordHmacFailure(...)
 *   - clearHmacFailures(userId, kind)   — call on first successful delivery
 *   - runHmacFailureSweep(...)
 */

const DEFAULT_THRESHOLD = 5
const DEFAULT_WINDOW_MIN = 30

export async function recordHmacFailure({ userId = 'default', kind = 'shopify', sourceIp = null, threshold = DEFAULT_THRESHOLD, windowMinutes = DEFAULT_WINDOW_MIN, notify = true } = {}) {
  if (!userId || !kind) return { disabled: false }
  try {
    await query(
      `INSERT INTO hmac_failures (id, userId, kind, sourceIp, occurredAt)
       VALUES (UUID(), ?, ?, ?, NOW())`,
      [userId, kind, sourceIp ? String(sourceIp).slice(0, 64) : null]
    )
  } catch (e) {
    // table not present yet — no-op
    return { disabled: false }
  }

  const recent = await queryOne(
    `SELECT COUNT(*) AS cnt
     FROM hmac_failures
     WHERE userId = ? AND kind = ? AND occurredAt >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [userId, kind, windowMinutes]
  ).catch(() => ({ cnt: 0 }))
  const failures = Number(recent?.cnt || 0)
  if (failures < threshold) return { disabled: false, failures, threshold }

  // Check whether the integration is already disabled to avoid spamming notifications
  const integrations = await getStoredIntegrations(userId).catch(() => null)
  if (!integrations) return { disabled: false, failures, threshold, reason: 'no_integrations' }
  const blob = integrations?.[kind]
  if (!blob) return { disabled: false, failures, threshold, reason: 'no_blob' }
  if (blob.disabled === true) return { disabled: true, failures, threshold, alreadyDisabled: true }

  // Auto-disable
  blob.disabled = true
  blob.disabledAt = new Date().toISOString()
  blob.disabledReason = 'hmac_failure_threshold'
  await saveStoredIntegration(kind, blob, userId).catch(() => null)

  if (notify) {
    await sendNotification({
      userId,
      channel: 'email',
      kind: 'webhook_disabled',
      subject: `Your ${kind} integration was auto-disabled`,
      body: `We observed ${failures} HMAC signature failures within ${windowMinutes} minutes — usually a sign that the webhook secret was rotated on the source side without being updated here. Re-authorize the integration in Settings → Integrations to re-enable.`
    }).catch(() => null)
  }

  return { disabled: true, failures, threshold, kind }
}

export async function clearHmacFailures({ userId = 'default', kind = 'shopify' } = {}) {
  try {
    await query(`DELETE FROM hmac_failures WHERE userId = ? AND kind = ?`, [userId, kind])
    return { cleared: true }
  } catch (e) {
    return { cleared: false }
  }
}

export async function getHmacFailureStats({ userId = 'default', kind = null, windowMinutes = 60 } = {}) {
  const where = ['userId = ?', 'occurredAt >= DATE_SUB(NOW(), INTERVAL ? MINUTE)']
  const params = [userId, windowMinutes]
  if (kind) {
    where.push('kind = ?')
    params.push(kind)
  }
  const rows = await query(
    `SELECT kind, COUNT(*) AS cnt, MAX(occurredAt) AS lastAt
     FROM hmac_failures WHERE ${where.join(' AND ')}
     GROUP BY kind
     ORDER BY cnt DESC`,
    params
  ).catch(() => [])
  return rows
}

/**
 * Manual operator hook — sweeps all tenants and disables any integration that
 * is over the threshold. Idempotent and safe to call from cron.
 */
export async function runHmacFailureSweep({ threshold = DEFAULT_THRESHOLD, windowMinutes = DEFAULT_WINDOW_MIN } = {}) {
  const victims = await query(
    `SELECT userId, kind, COUNT(*) AS cnt
     FROM hmac_failures
     WHERE occurredAt >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     GROUP BY userId, kind
     HAVING cnt >= ?`,
    [windowMinutes, threshold]
  ).catch(() => [])

  const results = []
  for (const v of victims) {
    const r = await recordHmacFailure({
      userId: v.userId, kind: v.kind, threshold, windowMinutes, notify: true
    })
    results.push({ userId: v.userId, kind: v.kind, count: Number(v.cnt), ...r })
  }
  return { swept: victims.length, actions: results }
}