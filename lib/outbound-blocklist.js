import { query, queryOne, queryMany } from './mysql'

/**
 * Per-tenant outbound phone blocklist. Used to suppress sends when a phone
 * is on a corporate / legal / spam blocklist from a source other than the
 * customer's own opt-in signal (which lives in customer_segments.optedOutMarketing).
 *
 * Backed by `outbound_blocklist (userId, phone, reason, source, expiresAt)`.
 */

export async function isBlocked({ userId = 'default', phone } = {}) {
  if (!phone) return { blocked: false }
  const normalized = String(phone).replace(/\D/g, '')
  if (!normalized) return { blocked: false }
  try {
    const row = await queryOne(
      `SELECT reason, source, expiresAt
       FROM outbound_blocklist
       WHERE userId = ? AND phone = ?
         AND (expiresAt IS NULL OR expiresAt > NOW())
       LIMIT 1`,
      [userId, normalized]
    )
    if (row) return { blocked: true, reason: row.reason, source: row.source, expiresAt: row.expiresAt }
  } catch (e) {}
  return { blocked: false }
}

export async function addToBlocklist({ userId = 'default', phone, reason = 'manual', source = 'admin', expiresAt = null } = {}) {
  if (!phone) throw new Error('phone required')
  const normalized = String(phone).replace(/\D/g, '')
  if (!normalized) throw new Error('invalid phone')
  await query(
    `INSERT INTO outbound_blocklist (userId, phone, reason, source, expiresAt)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE reason = VALUES(reason), source = VALUES(source), expiresAt = VALUES(expiresAt)`,
    [userId, normalized, String(reason).slice(0, 128), String(source).slice(0, 64), expiresAt]
  )
  return { userId, phone: normalized, reason, source, expiresAt }
}

export async function removeFromBlocklist({ userId = 'default', phone } = {}) {
  if (!phone) return { removed: 0 }
  const normalized = String(phone).replace(/\D/g, '')
  const res = await query(
    `DELETE FROM outbound_blocklist WHERE userId = ? AND phone = ?`,
    [userId, normalized]
  ).catch(() => null)
  return { removed: res?.affectedRows || 0 }
}

export async function listBlocklist({ userId = 'default', limit = 200 } = {}) {
  return queryMany(
    `SELECT phone, reason, source, expiresAt, createdAt
     FROM outbound_blocklist
     WHERE userId = ?
       AND (expiresAt IS NULL OR expiresAt > NOW())
     ORDER BY createdAt DESC
     LIMIT ?`,
    [userId, Math.min(Math.max(limit, 1), 1000)]
  )
}