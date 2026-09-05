import { query, queryMany } from '../mysql'
import { v4 as uuidv4 } from 'uuid'

/**
 * Tag-based audience segmentation.
 *
 * A segment is a list of boolean rules evaluated against
 * customer_segments + conversation_metrics. The engine returns a list of
 * matching customerPhone numbers.
 *
 * Rule shape:
 *   {
 *     field: 'totalSpent' | 'totalOrders' | 'lastOrderAtDays' |
 *            'lifetimeTier' | 'detectedLanguage' | 'optedOutMarketing' |
 *            'firstOrderAtDays' | 'hasBirthday' | 'custom:KEY',
 *     op:    '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in' | 'exists' | 'not_exists',
 *     value: any
 *   }
 *
 * Example rules:
 *   [{ field: 'totalSpent', op: '>=', value: 500 },
 *    { field: 'lifetimeTier', op: 'in', value: ['gold', 'platinum'] }]
 */

const FIELD_MAP = {
  totalSpent: 's.totalSpent',
  totalOrders: 's.totalOrders',
  lastOrderAtDays: 'DATEDIFF(NOW(), s.lastOrderAt)',
  firstOrderAtDays: 'DATEDIFF(NOW(), s.firstOrderAt)',
  lifetimeTier: 's.lifetimeTier',
  detectedLanguage: 'cm.detectedLanguage',
  optedOutMarketing: 's.optedOutMarketing',
  hasBirthday: 's.birthday',
  customerPhone: 's.customerPhone',
  referredBy: 's.referredBy'
}

const SUPPORTED_OPS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'exists', 'not_exists']

function buildWhere(rules = [], values) {
  const parts = []
  for (const rule of rules) {
    if (!rule || !rule.field) continue
    let col = FIELD_MAP[rule.field]
    if (!col) {
      if (rule.field.startsWith('custom:')) {
        const key = rule.field.substring(7)
        col = `JSON_UNQUOTE(JSON_EXTRACT(csc.metadata, '$.${key}'))`
      } else {
        continue
      }
    }
    const op = rule.op || '=='
    if (!SUPPORTED_OPS.includes(op)) continue

    switch (op) {
      case '==':
        parts.push(`${col} = ?`); values.push(String(rule.value ?? '')); break
      case '!=':
        parts.push(`${col} != ?`); values.push(String(rule.value ?? '')); break
      case '>':
      case '>=':
      case '<':
      case '<=':
        parts.push(`${col} ${op} ?`); values.push(Number(rule.value) || 0); break
      case 'in': {
        const arr = Array.isArray(rule.value) ? rule.value : String(rule.value).split(',').map(s => s.trim()).filter(Boolean)
        if (arr.length === 0) { parts.push('1=0'); break }
        const ph = arr.map(() => '?').join(',')
        parts.push(`${col} IN (${ph})`)
        values.push(...arr)
        break
      }
      case 'not_in': {
        const arr = Array.isArray(rule.value) ? rule.value : String(rule.value).split(',').map(s => s.trim()).filter(Boolean)
        if (arr.length === 0) { parts.push('1=1'); break }
        const ph = arr.map(() => '?').join(',')
        parts.push(`${col} NOT IN (${ph})`)
        values.push(...arr)
        break
      }
      case 'exists':
        parts.push(`${col} IS NOT NULL AND TRIM(COALESCE(${col}, '')) <> ''`); break
      case 'not_exists':
        parts.push(`(${col} IS NULL OR TRIM(COALESCE(${col}, '')) = '')`); break
    }
  }
  return parts.length ? parts.join(' AND ') : '1=1'
}

/**
 * Evaluate rules and return the list of customerPhone numbers that match.
 */
export async function evaluateAudience({ userId = 'default', rules = [], limit = 1000 }) {
  const values = [userId, Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 5000)]
  const where = buildWhere(rules, values)
  const rows = await queryMany(
    `SELECT DISTINCT s.customerPhone, s.lifetimeTier, s.totalSpent, s.totalOrders,
            s.firstOrderAt, s.lastOrderAt, s.optedOutMarketing,
            cm.detectedLanguage
     FROM customer_segments s
     LEFT JOIN conversation_metrics cm ON cm.userId = s.userId AND cm.customerPhone = s.customerPhone
     WHERE s.userId = ? AND ${where}
     ORDER BY s.totalSpent DESC
     LIMIT ?`,
    values
  )
  return rows
}

/**
 * Add customers to a saved audience. Persists the result to
 * customer_segments_custom with segmentKey for later reuse.
 */
export async function saveAudience({ userId = 'default', segmentKey, audience, source = 'manual' }) {
  if (!segmentKey || !Array.isArray(audience) || audience.length === 0) return { added: 0 }
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7-day TTL
  let added = 0
  for (const phone of audience) {
    const normalized = String(phone).replace(/\D/g, '')
    if (!normalized) continue
    try {
      await query(
        `INSERT INTO customer_segments_custom (id, userId, customerPhone, segmentKey, source, expiresAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           source = VALUES(source),
           expiresAt = VALUES(expiresAt)`,
        [`segcust_${uuidv4()}`, userId, normalized, segmentKey, source, expiresAt]
      )
      added++
    } catch (e) {
      console.warn('[Segments] failed to save audience member:', e.message)
    }
  }
  return { added, segmentKey, expiresAt }
}

/**
 * Read a saved audience.
 */
export async function getAudience({ userId = 'default', segmentKey }) {
  if (!segmentKey) return []
  return queryMany(
    `SELECT customerPhone, source, addedAt, expiresAt
     FROM customer_segments_custom
     WHERE userId = ? AND segmentKey = ? AND (expiresAt IS NULL OR expiresAt > NOW())`,
    [userId, segmentKey]
  )
}

/**
 * Add a single customer to a segment. Used by sweep endpoints to
 * auto-tag customers for downstream segment-based campaigns.
 */
export async function tagCustomer({ userId = 'default', customerPhone, segmentKey, source = 'auto', ttlDays = 30 } = {}) {
  if (!customerPhone || !segmentKey) return { tagged: false }
  const normalized = String(customerPhone).replace(/\D/g, '')
  if (!normalized) return { tagged: false }
  const expiresAt = ttlDays > 0 ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null
  await query(
    `INSERT INTO customer_segments_custom (id, userId, customerPhone, segmentKey, source, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       source = VALUES(source),
       expiresAt = VALUES(expiresAt)`,
    [`segcust_${uuidv4()}`, userId, normalized, segmentKey, source, expiresAt]
  )
  return { tagged: true, segmentKey, expiresAt }
}

/**
 * Remove a single customer from a segment.
 */
export async function untagCustomer({ userId = 'default', customerPhone, segmentKey } = {}) {
  if (!customerPhone || !segmentKey) return { removed: 0 }
  const normalized = String(customerPhone).replace(/\D/g, '')
  const res = await query(
    `DELETE FROM customer_segments_custom WHERE userId = ? AND customerPhone = ? AND segmentKey = ?`,
    [userId, normalized, segmentKey]
  )
  return { removed: res?.affectedRows || 0 }
}