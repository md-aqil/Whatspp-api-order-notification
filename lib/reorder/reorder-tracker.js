import { v4 as uuidv4 } from 'uuid'
import { query, queryMany } from '../mysql'

/**
 * Persist a customer's preference for a product (e.g. reorder cadence).
 * Idempotent per (userId, customerPhone, shopifyProductId) — updates last_ordered_at
 * if the product already exists in their preferences.
 */
export async function upsertCustomerProductPreference({
  userId = 'default',
  customerPhone,
  shopifyProductId,
  shopifyVariantId = null,
  productTitle,
  productHandle,
  productImage,
  productPrice,
  reorderDays = 0,
  lastOrderedAt,
  source = 'order'
}) {
  if (!customerPhone || !shopifyProductId) return null
  const id = `pref_${uuidv4()}`
  const normalized = String(customerPhone).replace(/\D/g, '')
  const lastOrdered = lastOrderedAt ? new Date(lastOrderedAt) : new Date()
  const nextEligible = reorderDays > 0
    ? new Date(lastOrdered.getTime() + reorderDays * 24 * 60 * 60 * 1000)
    : null

  await query(
    `INSERT INTO customer_product_preferences (
      id, userId, customerPhone, shopifyProductId, shopifyVariantId,
      productTitle, productHandle, productImage, productPrice,
      reorderDays, lastOrderedAt, nextEligibleAt, source, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_OBJECT('created_via', ?))
    ON DUPLICATE KEY UPDATE
      lastOrderedAt = VALUES(lastOrderedAt),
      reorderDays = VALUES(reorderDays),
      nextEligibleAt = VALUES(nextEligibleAt),
      productTitle = VALUES(productTitle),
      productHandle = VALUES(productHandle),
      productImage = VALUES(productImage),
      productPrice = VALUES(productPrice),
      updatedAt = NOW()`,
    [
      id, userId, normalized, String(shopifyProductId), shopifyVariantId,
      productTitle || '', productHandle || '', productImage || '', productPrice || '',
      reorderDays, lastOrdered, nextEligible, source, source
    ]
  )

  return { id, customerPhone: normalized, shopifyProductId }
}

/**
 * Find customers whose reorder window has just opened.
 * Returns one row per (customer × product) — each should trigger an automation.
 */
export async function findDueReorderNotifications({
  userId = 'default',
  limit = 50
}) {
  return queryMany(
    `SELECT *
     FROM customer_product_preferences
     WHERE userId = ?
       AND reorderDays > 0
       AND nextEligibleAt IS NOT NULL
       AND nextEligibleAt <= NOW()
       AND (lastNotifiedAt IS NULL OR lastNotifiedAt <= DATE_SUB(NOW(), INTERVAL 7 DAY))
     ORDER BY nextEligibleAt ASC
     LIMIT ?`,
    [userId, limit]
  )
}

/**
 * Mark a reorder as notified so we don't send again for the same window.
 */
export async function markReorderNotified(id) {
  if (!id) return
  await query(
    `UPDATE customer_product_preferences
     SET lastNotifiedAt = NOW(),
         nextEligibleAt = DATE_ADD(lastOrderedAt, INTERVAL reorderDays DAY)
     WHERE id = ?`,
    [id]
  )
}

/**
 * Self-tune reorderDays for a product based on the median gap between
 * consecutive orders in the last 180 days. Called by /api/reorder/tune and
 * after each successful order webhook for known consumables.
 *
 * Bounded: never below 7 days, never above 365, and only updates if the
 * observed gap differs by > 25% from the current reorderDays.
 */
export async function tuneReorderDaysForProduct({ userId = 'default', shopifyProductId, min = 7, max = 365, drift = 0.25 } = {}) {
  if (!shopifyProductId) return { updated: false, reason: 'no_product' }
  try {
    const { query, queryOne } = await import('../mysql')
    const row = await queryOne(
      `SELECT reorderDays
       FROM customer_product_preferences
       WHERE userId = ? AND shopifyProductId = ?
       ORDER BY updatedAt DESC
       LIMIT 1`,
      [userId, shopifyProductId]
    )
    const current = Number(row?.reorderDays || 0)
    if (current <= 0) return { updated: false, reason: 'no_existing_pref' }

    // Pull the median gap between consecutive orders of this product for any customer
    const gaps = await query(
      `SELECT DATEDIFF(nextOrder, prevOrder) AS gap
       FROM (
         SELECT o.customerPhone,
                o.createdAt AS prevOrder,
                LEAD(o.createdAt) OVER (PARTITION BY o.customerPhone ORDER BY o.createdAt) AS nextOrder
         FROM orders o
         JOIN order_products op ON op.orderId = o.id AND op.userId = o.userId
         WHERE o.userId = ? AND op.shopifyProductId = ?
           AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 180 DAY)
       ) t
       WHERE nextOrder IS NOT NULL AND DATEDIFF(nextOrder, prevOrder) BETWEEN ? AND ?`,
      [userId, shopifyProductId, min, max]
    )
    if (!gaps?.length) return { updated: false, reason: 'no_history' }

    const sorted = gaps.map(r => Number(r.gap)).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (!median || median <= 0) return { updated: false, reason: 'no_median' }

    const newDays = Math.max(min, Math.min(max, Math.round(median)))
    if (Math.abs(newDays - current) / current < drift) {
      return { updated: false, reason: 'within_drift', current, suggested: newDays, samples: sorted.length }
    }

    await query(
      `UPDATE customer_product_preferences
       SET reorderDays = ?, updatedAt = NOW()
       WHERE userId = ? AND shopifyProductId = ?`,
      [newDays, userId, shopifyProductId]
    )
    return { updated: true, previous: current, newDays, samples: sorted.length }
  } catch (err) {
    return { updated: false, reason: 'error', error: err.message }
  }
}

/**
 * Guess a reasonable reorderDays value from a Shopify product collection tags
 * or a product type. Used by the order-webhook to auto-detect consumables.
 */
export function guessReorderDaysFromProduct(product = {}) {
  const tags = String(product.tags || product.product_type || '').toLowerCase()
  if (/daily|toothpaste|shampoo|conditioner|skincare|face|serum|cosmetic/.test(tags)) return 30
  if (/weekly|supplement|vitamin|petfood|kibble/.test(tags)) return 14
  if (/monthly|coffee|tea|candle|fragrance/.test(tags)) return 60
  return 0
}

/**
 * Compute the optimal hour-of-day to send a reorder nudge for a given customer.
 * Looks at the customer's historical inbound activity to find the hour bucket
 * they engage with us most, defaulting to 10am.
 *
 * Returns an hour (0-23) in the user's local timezone.
 */
export async function findOptimalSendHour({ userId = 'default', customerPhone }) {
  if (!customerPhone) return 10
  const normalized = String(customerPhone).replace(/\D/g, '')
  try {
    const [row] = await query(
      `SELECT HOUR(timestamp) AS hr, COUNT(*) AS count
       FROM messages
       WHERE userId = ? AND isCustomer = 1 AND (phone = ? OR recipient = ?)
         AND timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
       GROUP BY hr
       ORDER BY count DESC
       LIMIT 1`,
      [userId, normalized, normalized]
    )
    if (row?.hr !== undefined && row.hr !== null) {
      return Number(row.hr)
    }
  } catch (e) {}
  return 10
}

/**
 * Sweep helper that picks the right sendAt for each customer based on
 * optimal-hour logic. Used by /api/reorder/sweep and weekly cron.
 */
export async function computeScheduledReorderRuns({ userId = 'default', items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return []
  const enriched = []
  for (const item of items) {
    const optimalHour = await findOptimalSendHour({ userId, customerPhone: item.customerPhone })
    const sendAt = new Date()
    sendAt.setHours(optimalHour, 0, 0, 0)
    if (sendAt.getTime() < Date.now()) {
      sendAt.setDate(sendAt.getDate() + 1)
    }
    enriched.push({ ...item, optimalHour, sendAt })
  }
  return enriched
}