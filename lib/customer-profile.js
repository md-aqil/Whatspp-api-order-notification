import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from './mysql'

/**
 * Tier thresholds (cumulative lifetime spend).
 * Tweak via env if needed: TIERS_JSON='[{"name":"new","min":0}, ...]'
 */
const DEFAULT_TIERS = [
  { name: 'bronze', min: 0 },
  { name: 'silver', min: 200 },
  { name: 'gold', min: 500 },
  { name: 'platinum', min: 1500 }
]

function loadTiers() {
  try {
    const env = process.env.TIERS_JSON
    if (env) return JSON.parse(env)
  } catch (e) {}
  return DEFAULT_TIERS
}

export function tierForSpend(totalSpent = 0) {
  const tiers = loadTiers()
  let current = tiers[0]?.name || 'new'
  for (const t of tiers) {
    if (totalSpent >= (t.min || 0)) current = t.name
  }
  return current
}

/**
 * Upsert a customer's aggregate profile (lifetime value, tier, dates).
 * Idempotent per (userId, customerPhone). Triggered on every order webhook.
 */
export async function readCustomerProfile({ userId = 'default', customerPhone } = {}) {
  if (!customerPhone) return null
  const normalized = String(customerPhone).replace(/\D/g, '')
  return await queryOne(
    `SELECT * FROM customer_segments WHERE userId = ? AND customerPhone = ? LIMIT 1`,
    [userId, normalized]
  )
}

export async function upsertCustomerProfile({
  userId = 'default',
  customerPhone,
  orderTotal = 0,
  currency = 'INR',
  orderAt = new Date(),
  birthday = null,
  firstName = '',
  lastName = '',
  referredBy = null
}) {
  if (!customerPhone) return null
  const normalized = String(customerPhone).replace(/\D/g, '')
  const orderAmount = Number(orderTotal) || 0

  // Convert total price (e.g. "99.00") to decimal
  const orderAmountDecimal = Number(orderAmount.toFixed(2))

  // Load existing profile (if any)
  const existing = await queryOne(
    `SELECT * FROM customer_segments WHERE userId = ? AND customerPhone = ? LIMIT 1`,
    [userId, normalized]
  )

  const newTotalOrders = (existing?.totalOrders || 0) + 1
  const newTotalSpent = Number(((Number(existing?.totalSpent) || 0) + orderAmountDecimal).toFixed(2))
  const newTier = tierForSpend(newTotalSpent)

  const id = existing?.id || `seg_${uuidv4()}`
  const firstOrderAt = existing?.firstOrderAt || orderAt

  await query(
    `INSERT INTO customer_segments (
      id, userId, customerPhone, firstOrderAt, lastOrderAt, totalOrders, totalSpent,
      lifetimeTier, birthday, lastEngagementAt, referredBy, metadata, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, JSON_OBJECT('firstName', ?, 'lastName', ?, 'currency', ?), NOW())
    ON DUPLICATE KEY UPDATE
      lastOrderAt = VALUES(lastOrderAt),
      totalOrders = VALUES(totalOrders),
      totalSpent = VALUES(totalSpent),
      lifetimeTier = VALUES(lifetimeTier),
      birthday = COALESCE(VALUES(birthday), birthday),
      referredBy = COALESCE(VALUES(referredBy), referredBy),
      metadata = JSON_SET(COALESCE(metadata, '{}'), '$.firstName', VALUES(metadata)),
      updatedAt = NOW()`,
    [
      id, userId, normalized,
      firstOrderAt, orderAt,
      newTotalOrders, newTotalSpent,
      newTier, birthday, referredBy,
      firstName, lastName, currency
    ]
  )

  return { id, totalOrders: newTotalOrders, totalSpent: newTotalSpent, tier: newTier, previousTier: existing?.lifetimeTier || 'new' }
}

/**
 * Find customers whose last order is older than `daysAgo` and who haven't
 * opted out of marketing.
 */
export async function findLapsedCustomers({ userId = 'default', daysAgo = 90, limit = 100 } = {}) {
  return queryMany(
    `SELECT * FROM customer_segments
     WHERE userId = ?
       AND lastOrderAt IS NOT NULL
       AND lastOrderAt <= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND optedOutMarketing = 0
       AND totalOrders > 0
     ORDER BY lastOrderAt DESC
     LIMIT ?`,
    [userId, daysAgo, limit]
  )
}

/**
 * Find customers whose totalSpent just crossed a tier threshold AND were
 * previously on a lower tier. Used to trigger a one-time upgrade alert.
 */
export async function findTierUpgradeCandidates({ userId = 'default', limit = 50 } = {}) {
  return queryMany(
    `SELECT * FROM customer_segments
     WHERE userId = ?
       AND lastOrderAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
     ORDER BY updatedAt DESC
     LIMIT ?`,
    [userId, limit]
  )
}

/**
 * Find customers whose birthday is today.
 */
export async function findBirthdayCustomers({ userId = 'default' } = {}) {
  return queryMany(
    `SELECT * FROM customer_segments
     WHERE userId = ?
       AND optedOutMarketing = 0
       AND birthday IS NOT NULL
       AND MONTH(birthday) = MONTH(CURDATE())
       AND DAY(birthday) = DAY(CURDATE())`,
    [userId]
  )
}

/**
 * Mark customer as opted out of marketing.
 */
export async function setMarketingOptOut({ userId = 'default', customerPhone, optedOut = true }) {
  if (!customerPhone) return
  const normalized = String(customerPhone).replace(/\D/g, '')
  await query(
    `UPDATE customer_segments SET optedOutMarketing = ?, updatedAt = NOW()
     WHERE userId = ? AND customerPhone = ?`,
    [optedOut ? 1 : 0, userId, normalized]
  )
}

/**
 * Record a double opt-in. Sets optedOutMarketing=0, stamps optInConfirmedAt,
 * and stores the source (e.g. "double_optin_yes_reply"). Idempotent — safe
 * to call on every inbound YES.
 */
export async function recordOptIn({ userId = 'default', customerPhone, source = 'double_optin' } = {}) {
  if (!customerPhone) return { optedIn: false }
  const normalized = String(customerPhone).replace(/\D/g, '')
  if (!normalized) return { optedIn: false }
  await query(
    `UPDATE customer_segments
     SET optedOutMarketing = 0,
         optInConfirmedAt = COALESCE(optInConfirmedAt, NOW()),
         optInSource = COALESCE(optInSource, ?),
         updatedAt = NOW()
     WHERE userId = ? AND customerPhone = ?`,
    [String(source).slice(0, 64), userId, normalized]
  )
  return { optedIn: true, source }
}

/**
 * Persist NPS / CSAT rating from a button reply.
 */
export async function recordFeedback({
  userId = 'default',
  customerPhone,
  shopifyOrderId,
  orderNumber,
  score,
  feedbackType = 'csat',
  comment,
  automationId,
  context
}) {
  const id = `fb_${uuidv4()}`
  await query(
    `INSERT INTO customer_feedback (
      id, userId, customerPhone, shopifyOrderId, orderNumber, score,
      feedbackType, comment, automationId, context, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id, userId, String(customerPhone || '').replace(/\D/g, ''),
      shopifyOrderId || null, orderNumber || null,
      Math.max(0, Math.min(10, parseInt(score, 10) || 0)),
      feedbackType, comment || null, automationId || null,
      JSON.stringify(context || {})
    ]
  )
  return id
}