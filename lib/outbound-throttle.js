import { queryOne } from './mysql'

/**
 * Per-tenant + per-recipient outbound throttle for WhatsApp.
 *
 * Tracks send counts in `outbound_throttle` (a 1-minute resolution window)
 * and rejects (or queues) sends that exceed either:
 *   - per-recipient cap (default 30 / hour)
 *   - per-tenant cap      (default 2000 / hour)
 *   - per-tenant cap      (default 80 / minute — protects against bursts)
 *
 * If the per-tenant 80/min cap is hit we throw a "throttled" error that
 * the caller can choose to swallow (campaign sender) or surface (manual
 * one-off). The outbound_idempotency layer (in lib/outbound-idempotency.js)
 * still runs first, so dedup is unaffected.
 */

const DEFAULT_LIMITS = {
  perRecipientPerHour: 30,
  perTenantPerHour: 2000,
  perTenantPerMinute: 80
}

export function getLimits(overrides = {}) {
  return { ...DEFAULT_LIMITS, ...overrides }
}

/**
 * Returns { allowed, reason, remaining } for the proposed send.
 * Callers should check `allowed` before issuing the API request.
 */
export async function checkOutboundThrottle({ userId = 'default', phone, limits = {} } = {}) {
  const cfg = getLimits(limits)

  // Per-tenant (minute + hour)
  const perTenantMinute = await queryOne(
    `SELECT COUNT(*) AS cnt FROM outbound_throttle
     WHERE userId = ? AND bucketStart = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i')`,
    [userId]
  ).catch(() => ({ cnt: 0 }))
  if (Number(perTenantMinute?.cnt || 0) >= cfg.perTenantPerMinute) {
    return { allowed: false, reason: 'tenant_per_minute', limit: cfg.perTenantPerMinute, remaining: 0 }
  }
  const perTenantHour = await queryOne(
    `SELECT COUNT(*) AS cnt FROM outbound_throttle
     WHERE userId = ? AND bucketStart >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [userId]
  ).catch(() => ({ cnt: 0 }))
  if (Number(perTenantHour?.cnt || 0) >= cfg.perTenantPerHour) {
    return { allowed: false, reason: 'tenant_per_hour', limit: cfg.perTenantPerHour, remaining: 0 }
  }

  if (phone) {
    const normalized = String(phone).replace(/\D/g, '')
    const perRecipient = await queryOne(
      `SELECT COUNT(*) AS cnt FROM outbound_throttle
       WHERE userId = ? AND phone = ? AND bucketStart >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [userId, normalized]
    ).catch(() => ({ cnt: 0 }))
    if (Number(perRecipient?.cnt || 0) >= cfg.perRecipientPerHour) {
      return { allowed: false, reason: 'recipient_per_hour', limit: cfg.perRecipientPerHour, remaining: 0 }
    }
  }

  return { allowed: true, remaining: cfg.perTenantPerMinute - Number(perTenantMinute?.cnt || 0) }
}

/**
 * Record a successful send. Idempotent w.r.t. dedupKey — pass the same key
 * and we'll skip the second record.
 */
export async function recordOutboundSend({ userId = 'default', phone, dedupKey = null } = {}) {
  const normalized = phone ? String(phone).replace(/\D/g, '') : null
  const { query } = await import('./mysql')
  if (dedupKey) {
    const dup = await queryOne(
      `SELECT id FROM outbound_throttle WHERE userId = ? AND dedupKey = ? LIMIT 1`,
      [userId, dedupKey]
    ).catch(() => null)
    if (dup) return { recorded: false, reason: 'dedup' }
  }
  await query(
    `INSERT INTO outbound_throttle (id, userId, phone, bucketStart, dedupKey)
     VALUES (UUID(), ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), ?)`,
    [userId, normalized, dedupKey]
  ).catch(() => null)
  return { recorded: true }
}