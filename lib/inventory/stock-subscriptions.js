import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from '../mysql'

/**
 * Subscribe a customer for a back-in-stock notification for a given product.
 * Idempotent per (userId, product, phone): updates variant + product info.
 */
export async function subscribeBackInStock({
  userId = 'default',
  customerPhone,
  shopifyProductId,
  shopifyVariantId,
  productTitle,
  productHandle,
  productImage,
  variantTitle,
  source = 'in_stock_request'
}) {
  if (!customerPhone || !shopifyProductId) return null
  const normalized = String(customerPhone).replace(/\D/g, '')

  await query(
    `INSERT INTO stock_subscriptions (
      id, userId, customerPhone, shopifyProductId, shopifyVariantId,
      productTitle, productHandle, productImage, variantTitle, source, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting')
    ON DUPLICATE KEY UPDATE
      shopifyVariantId = VALUES(shopifyVariantId),
      productTitle = VALUES(productTitle),
      productHandle = VALUES(productHandle),
      productImage = VALUES(productImage),
      variantTitle = VALUES(variantTitle),
      status = 'waiting',
      notifiedAt = NULL,
      updatedAt = NOW()`,
    [
      `stk_${uuidv4()}`, userId, normalized, String(shopifyProductId),
      shopifyVariantId || null,
      productTitle || '', productHandle || '', productImage || '',
      variantTitle || '', source
    ]
  )

  return { customerPhone: normalized, shopifyProductId, status: 'waiting' }
}

/**
 * Find all waiting subscriptions for a product that just came back in stock.
 */
export async function findPendingSubscriptionsForProduct({ userId = 'default', shopifyProductId }) {
  return queryMany(
    `SELECT * FROM stock_subscriptions
     WHERE userId = ? AND shopifyProductId = ? AND status = 'waiting'
     ORDER BY createdAt ASC`,
    [userId, String(shopifyProductId)]
  )
}

/**
 * Mark a list of subscription ids as notified.
 */
export async function markSubscriptionsNotified(ids = []) {
  if (!ids.length) return
  const placeholders = ids.map(() => '?').join(',')
  await query(
    `UPDATE stock_subscriptions
     SET status = 'notified', notifiedAt = NOW()
     WHERE id IN (${placeholders}) AND status = 'waiting'`,
    ids
  )
}

/**
 * Helper: handle an inventory webhook from Shopify.
 * inventory_levels/update — fires when available stock changes.
 *
 * If available > 0 (restocked), find waiting subscribers and emit a
 * `shopify.back_in_stock` automation event for each.
 */
export async function handleInventoryRestock({ userId, payload, triggerAutomationEvent, integrations }) {
  try {
    const inventoryItemId = payload.inventory_item_id
    const available = payload.available
    if (available === undefined || available === null) return { triggered: 0 }

    // Resolve product_id from inventory_item_id
    // Note: the webhook payload only carries inventory_item_id; we'd need
    // a follow-up Admin API call to map to product_id. We accept either
    // `inventory_item_id` (use as product id surrogate if same) or
    // `product_id` (legacy form).
    const productId = payload.product_id || inventoryItemId
    if (!productId) return { triggered: 0 }

    const wasOut = (payload.previous_available === 0 || payload.previous_available === undefined)
    const nowIn = Number(available) > 0
    if (!wasOut || !nowIn) return { triggered: 0 }

    const subs = await findPendingSubscriptionsForProduct({ userId, shopifyProductId: String(productId) })
    const ids = []
    for (const sub of subs) {
      try {
        await triggerAutomationEvent('shopify.back_in_stock', {
          customer_phone: sub.customerPhone,
          customerPhone: sub.customerPhone,
          shopify_product_id: sub.shopifyProductId,
          shopify_variant_id: sub.shopifyVariantId,
          product_title: sub.productTitle,
          product_handle: sub.productHandle,
          product_image: sub.productImage,
          variant_title: sub.variantTitle,
          source: sub.source
        }, integrations, userId)
        ids.push(sub.id)
      } catch (err) {
        console.error('[Inventory] back_in_stock event failed:', err.message)
      }
    }
    if (ids.length) await markSubscriptionsNotified(ids)
    return { triggered: ids.length }
  } catch (err) {
    console.error('[Inventory] handleInventoryRestock error:', err.message)
    return { triggered: 0, error: err.message }
  }
}