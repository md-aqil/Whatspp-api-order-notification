import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from './mysql'

/**
 * Add a product to a customer's wishlist. Idempotent per
 * (userId, customerPhone, shopifyProductId).
 */
export async function addToWishlist({
  userId = 'default',
  customerPhone,
  shopifyProductId,
  shopifyVariantId,
  productTitle,
  productHandle,
  productImage,
  productPrice,
  notifyOnDiscount = false,
  notifyOnRestock = true
}) {
  if (!customerPhone || !shopifyProductId) return null
  const normalized = String(customerPhone).replace(/\D/g, '')

  await query(
    `INSERT INTO wishlists (
      id, userId, customerPhone, shopifyProductId, shopifyVariantId,
      productTitle, productHandle, productImage, productPrice,
      notifyOnDiscount, notifyOnRestock
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      shopifyVariantId = VALUES(shopifyVariantId),
      productTitle = VALUES(productTitle),
      productHandle = VALUES(productHandle),
      productImage = VALUES(productImage),
      productPrice = VALUES(productPrice),
      notifyOnDiscount = VALUES(notifyOnDiscount),
      notifyOnRestock = VALUES(notifyOnRestock)`,
    [
      `wl_${uuidv4()}`, userId, normalized, String(shopifyProductId),
      shopifyVariantId || null,
      productTitle || '', productHandle || '', productImage || '', productPrice || '',
      notifyOnDiscount ? 1 : 0, notifyOnRestock ? 1 : 0
    ]
  )
  return { customerPhone: normalized, shopifyProductId }
}

/**
 * Remove a product from a customer's wishlist.
 */
export async function removeFromWishlist({ userId = 'default', customerPhone, shopifyProductId }) {
  if (!customerPhone || !shopifyProductId) return
  const normalized = String(customerPhone).replace(/\D/g, '')
  await query(
    `DELETE FROM wishlists WHERE userId = ? AND customerPhone = ? AND shopifyProductId = ?`,
    [userId, normalized, String(shopifyProductId)]
  )
}

/**
 * List a customer's wishlist, most recent first.
 */
export async function listWishlist({ userId = 'default', customerPhone, limit = 50 }) {
  if (!customerPhone) return []
  const normalized = String(customerPhone).replace(/\D/g, '')
  return queryMany(
    `SELECT * FROM wishlists
     WHERE userId = ? AND customerPhone = ?
     ORDER BY addedAt DESC
     LIMIT ?`,
    [userId, normalized, limit]
  )
}

/**
 * Find wishlist rows for a product whose restock notification is enabled.
 * Used by the inventory webhook to alert wishlist members too.
 */
export async function findWishlistForRestock({ userId = 'default', shopifyProductId }) {
  return queryMany(
    `SELECT * FROM wishlists
     WHERE userId = ? AND shopifyProductId = ? AND notifyOnRestock = 1`,
    [userId, String(shopifyProductId)]
  )
}

/**
 * Bulk: find customers who have product in wishlist AND have
 * notifyOnDiscount enabled, for price-drop campaigns.
 */
export async function findWishlistForDiscount({ userId = 'default', shopifyProductId }) {
  return queryMany(
    `SELECT * FROM wishlists
     WHERE userId = ? AND shopifyProductId = ? AND notifyOnDiscount = 1`,
    [userId, String(shopifyProductId)]
  )
}