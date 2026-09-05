import { query, queryOne, queryMany } from './mysql'

/**
 * Detect whether a customer has gone silent (no inbound WhatsApp message in N days).
 * Returns true if last inbound is older than the threshold.
 */
export async function isCustomerSilent({ userId = 'default', customerPhone, silenceDays = 60 }) {
  if (!customerPhone) return false
  const normalized = String(customerPhone).replace(/\D/g, '')
  const row = await queryOne(
    `SELECT MAX(timestamp) AS lastInbound
     FROM messages
     WHERE userId = ? AND isCustomer = 1 AND (phone = ? OR recipient = ?)
       AND timestamp >= DATE_SUB(NOW(), INTERVAL 365 DAY)`,
    [userId, normalized, normalized]
  )
  if (!row?.lastInbound) return false
  const last = new Date(row.lastInbound)
  if (isNaN(last.getTime())) return false
  const ageDays = (Date.now() - last.getTime()) / (24 * 60 * 60 * 1000)
  return ageDays >= silenceDays
}

/**
 * Find all customers who opted out (have replied with STOP, marked optedOutMarketing,
 * or had delivery failures / template-unreachable in the last 7 days).
 */
export async function findOptedOutCustomers({ userId = 'default', limit = 200 } = {}) {
  return queryMany(
    `SELECT * FROM customer_segments
     WHERE userId = ? AND optedOutMarketing = 1
     ORDER BY updatedAt DESC
     LIMIT ?`,
    [userId, Math.min(limit, 1000)]
  )
}

/**
 * Find customers with no inbound message in N days who have NOT opted out
 * — these are the win-back candidates.
 */
export async function findSilentCustomers({ userId = 'default', silenceDays = 60, limit = 200 } = {}) {
  return queryMany(
    `SELECT s.* FROM customer_segments s
     WHERE s.userId = ?
       AND s.optedOutMarketing = 0
       AND s.totalOrders > 0
       AND (
         NOT EXISTS (
           SELECT 1 FROM messages m
           WHERE m.userId = s.userId
             AND (m.phone = s.customerPhone OR m.recipient = s.customerPhone)
             AND m.isCustomer = 1
             AND m.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
         )
       )
     ORDER BY s.lastOrderAt DESC
     LIMIT ?`,
    [userId, Math.max(1, Math.min(silenceDays, 365)), Math.min(limit, 1000)]
  )
}