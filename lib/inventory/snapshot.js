import { query, queryOne, queryMany } from '../mysql'
import { fetchShopifyProducts, getShopifyAccessToken } from '../integrations/shopify'

/**
 * Look up live inventory for the items in a cart context. Returns an array of
 * { productId, variantId, available, lowStock (true if available <= threshold) }.
 *
 * For carts with many items we sample the first 5 to keep the lookup bounded.
 */
export async function getCartInventorySnapshot({ shopifyIntegration, cartContext, threshold = 5 }) {
  if (!shopifyIntegration?.shopDomain) return []
  const lineItems = Array.isArray(cartContext?.line_items) ? cartContext.line_items : []
  if (lineItems.length === 0) return []

  // Try the inventory_levels endpoint; on 404/permission fallback to product stock field.
  let inventory = []
  try {
    inventory = await fetchInventoryLevels(shopifyIntegration, lineItems)
  } catch (err) {
    console.warn('[Inventory] fetchInventoryLevels failed, falling back to product stock:', err.message)
  }

  // Fallback: if nothing came back, use the product's `totalInventory` field
  if (inventory.length === 0) {
    try {
      const products = await fetchShopifyProducts({ ...shopifyIntegration, limit: 50 })
      const byId = new Map(products.map(p => [String(p.id), p]))
      inventory = lineItems
        .map((li) => {
          const id = li.product_id || li.productId
          const product = id ? byId.get(String(id)) : null
          const available = Number(product?.totalInventory ?? product?.variants?.[0]?.inventory_quantity ?? 0)
          return {
            productId: String(id || ''),
            variantId: String(li.variant_id || li.variantId || product?.variants?.[0]?.id || ''),
            available,
            lowStock: available > 0 && available <= threshold
          }
        })
        .filter(Boolean)
    } catch (e) {
      console.warn('[Inventory] fallback product lookup failed:', e.message)
    }
  }

  return inventory
}

async function fetchInventoryLevels(shopifyIntegration, lineItems) {
  const accessToken = await getShopifyAccessToken(shopifyIntegration)
  const domain = shopifyIntegration.shopDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const out = []
  for (const item of lineItems.slice(0, 5)) {
    const inventoryItemId = item.inventory_item_id || item.variant_inventory_item_id
    if (!inventoryItemId) continue
    const locationId = shopifyIntegration.locationId || ''
    const url = `https://${domain}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}${locationId ? `&location_id=${locationId}` : ''}`
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })
    if (!res.ok) continue
    const data = await res.json()
    const level = data.inventory_levels?.[0]
    if (level) {
      out.push({
        productId: String(item.product_id || ''),
        variantId: String(item.variant_id || ''),
        available: Number(level.available || 0),
        lowStock: Number(level.available || 0) <= 5
      })
    }
  }
  return out
}

/**
 * Convenience: pick the highest-priority urgency phrase for a cart.
 * Returns { tone: 'urgent' | 'normal' | 'low', phrase: string, itemsLow: number }
 */
export function urgencyToneForInventory(snapshot = []) {
  if (!snapshot.length) return { tone: 'normal', phrase: '', itemsLow: 0 }
  const itemsLow = snapshot.filter((i) => i.lowStock).length
  const itemsOut = snapshot.filter((i) => i.available === 0).length
  if (itemsOut > 0) {
    return { tone: 'urgent', phrase: '⚠️ One or more items in your cart are now OUT OF STOCK.', itemsLow }
  }
  if (itemsLow > 0) {
    return { tone: 'urgent', phrase: `🔥 Only a few left — ${itemsLow} item(s) in your cart are running low.`, itemsLow }
  }
  return { tone: 'normal', phrase: '', itemsLow: 0 }
}