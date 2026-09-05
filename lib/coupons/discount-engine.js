import { v4 as uuidv4 } from 'uuid'
import { query } from '../mysql'
import {
  createShopifyDiscountCode,
  disableShopifyDiscountCode
} from '../integrations/shopify'

/**
 * Mint a single-use Shopify coupon for a specific recipient and persist it in
 * `shopify_discount_codes` for audit and tracking.
 *
 * Returns { code, priceRuleId, discountCodeId, expiresAt } on success.
 * Throws on Shopify API failure.
 */
export async function mintAndPersistDiscount({
  userId = 'default',
  shopifyIntegration,
  recipient,
  automationId = '',
  orderId = '',
  context = {},
  options = {}
}) {
  if (!shopifyIntegration) {
    throw new Error('Shopify integration is required to mint coupons')
  }

  const expiresAt = new Date(
    Date.now() + (Number(options.ttlDays || 14) * 24 * 60 * 60 * 1000)
  ).toISOString()

  const result = await createShopifyDiscountCode(shopifyIntegration, {
    ...options,
    startsAt: options.startsAt || new Date().toISOString(),
    endsAt: expiresAt,
    usageLimit: options.usageLimit ?? 1
  })

  const id = uuidv4()
  await query(
    `INSERT INTO shopify_discount_codes (
      id, userId, shopifyDiscountId, code, priceRuleId, recipient,
      automationId, orderId, context, expiresAt, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
    [
      id,
      userId,
      result.discountCodeId || null,
      result.code,
      result.priceRuleId || null,
      recipient || null,
      automationId || null,
      orderId || null,
      JSON.stringify(context || {}),
      expiresAt
    ]
  )

  return { id, ...result, expiresAt }
}

/**
 * Mark a discount as used (called from order webhook when the discount code
 * was applied at checkout). Idempotent.
 */
export async function markDiscountCodeUsed(code) {
  if (!code) return
  await query(
    `UPDATE shopify_discount_codes
     SET status = 'used', usedAt = NOW()
     WHERE code = ? AND status = 'active'`,
    [code]
  )
}

/**
 * Best-effort cancel: disable the price rule in Shopify and mark the row cancelled.
 * Silently swallows errors (cancellations are not user-visible).
 */
export async function cancelPersistedDiscount({
  userId = 'default',
  code,
  shopifyIntegration,
  reason = 'cancelled'
}) {
  if (!code) return
  try {
    const row = await query(
      `SELECT priceRuleId FROM shopify_discount_codes WHERE userId = ? AND code = ? LIMIT 1`,
      [userId, code]
    )
    const priceRuleId = row?.[0]?.priceRuleId
    if (priceRuleId && shopifyIntegration) {
      await disableShopifyDiscountCode(shopifyIntegration, priceRuleId)
    }
    await query(
      `UPDATE shopify_discount_codes
       SET status = 'cancelled', context = JSON_SET(COALESCE(context, '{}'), '$.cancel_reason', ?)
       WHERE code = ? AND status = 'active'`,
      [reason, code]
    )
  } catch (err) {
    console.warn('[Discount] cancel failed:', err.message)
  }
}

/**
 * Lookup previously minted codes for a recipient (for re-engagement flows).
 */
export async function getActiveDiscountsForRecipient({ userId = 'default', recipient, limit = 5 }) {
  if (!recipient) return []
  const normalized = String(recipient).replace(/\D/g, '')
  return query(
    `SELECT code, expiresAt, status, automationId, orderId, createdAt
     FROM shopify_discount_codes
     WHERE userId = ? AND REGEXP_REPLACE(COALESCE(recipient, ''), '[^0-9]', '') = ?
       AND status = 'active'
       AND expiresAt > NOW()
     ORDER BY createdAt DESC
     LIMIT ?`,
    [userId, normalized, limit]
  )
}