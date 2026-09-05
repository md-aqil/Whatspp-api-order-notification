const shopifyTokenCache = new Map()

/**
 * Normalize a user-supplied shop identifier to a host suitable for the
 * Shopify Admin API (e.g. `my-store.myshopify.com`).
 *
 * Hardened against SSRF / credential-leak: the only accepted host suffix is
 * `.myshopify.com`. Any other shape throws so callers can fail fast instead
 * of silently sending the access token to a third party.
 *
 * Accepts:
 *   - "my-store.myshopify.com"
 *   - "https://my-store.myshopify.com/admin/..."
 *   - "admin.shopify.com/store/my-store"
 *
 * Rejects (throws): arbitrary hostnames like "evil.com" or "1.2.3.4".
 */
export function normalizeShopifyDomain(shopDomain = '') {
  let domain = String(shopDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    // Handle admin.shopify.com/store/<subdomain> → <subdomain>
    .replace(/^admin\.shopify\.com\/store\//i, '')
    // Strip any path/query/fragment
    .replace(/\/.*$/, '')

  // Reject IP literals and obvious non-Shopify hostnames before any rewrite
  if (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(domain) ||
    /^(localhost|.*\.local|.*\.internal)$/i.test(domain)
  ) {
    throw new Error(`Invalid Shopify shop domain: ${shopDomain}`)
  }

  if (domain && !domain.includes('.')) {
    domain = `${domain}.myshopify.com`
  }

  // Must look like a myshopify.com host. We intentionally allow only the
  // .myshopify.com TLD; the official Shopify dev/staging hosts (.myshopify.io,
  // spinify, etc.) are not in scope for this product.
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) {
    throw new Error(`Invalid Shopify shop domain: ${shopDomain}`)
  }

  return domain
}

export function extractShopifyHandleFromUrl(url = '') {
  if (!url) return ''
  try {
    const parts = url.split('/')
    return parts[parts.length - 1].split('?')[0]
  } catch (e) {
    return ''
  }
}

export function extractShopifyOrderCartIdentifiers(orderPayload = {}) {
  const checkoutToken = orderPayload.checkout_token || null
  let externalCartId = null

  if (orderPayload.cart_token) {
    externalCartId = orderPayload.cart_token
  }

  return { checkoutToken, externalCartId }
}

export async function getShopifyAccessToken(shopify) {
  const normalizedDomain = normalizeShopifyDomain(shopify?.shopDomain)

  if (!normalizedDomain) {
    throw new Error('Shopify store domain is required (e.g. your-store.myshopify.com)')
  }

  // Direct Admin API access token support (e.g. shpat_...)
  const directToken = [shopify?.accessToken, shopify?.clientSecret, shopify?.clientId].find(
    (t) => typeof t === 'string' && (t.startsWith('shpat_') || t.startsWith('shpua_') || t.startsWith('shpca_'))
  )
  if (directToken) {
    return directToken
  }

  if (!shopify?.clientId || !shopify?.clientSecret) {
    throw new Error('Shopify Client ID and Client Secret (or Admin API Token) are required')
  }

  const cacheKey = `${normalizedDomain}::${shopify.clientId}`
  const cachedToken = shopifyTokenCache.get(cacheKey)

  if (cachedToken?.accessToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  let tokenResponse
  try {
    tokenResponse = await fetch(`https://${normalizedDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: shopify.clientId,
        client_secret: shopify.clientSecret
      })
    })
  } catch (err) {
    throw new Error(`Could not connect to Shopify store at https://${normalizedDomain}: ${err.message}`)
  }

  let tokenData
  const rawText = await tokenResponse.text()
  try {
    tokenData = JSON.parse(rawText)
  } catch (e) {
    if (tokenResponse.status === 404) {
      throw new Error(`Shopify store '${normalizedDomain}' not found. Please verify your myshopify.com domain.`)
    }
    throw new Error(`Shopify returned an unexpected response (Status ${tokenResponse.status}). Please check your Shopify domain and credentials.`)
  }

  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error_description || tokenData?.error || 'Failed to authenticate with Shopify')
  }

  const expiresInSeconds = Number(tokenData.expires_in || 86399)
  shopifyTokenCache.set(cacheKey, {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000
  })

  return tokenData.access_token
}

export async function fetchShopifyProducts(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/products.json?limit=50`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  let data
  const rawText = await response.text()
  try {
    data = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`Failed to read products from Shopify (Status ${response.status}). Please verify your Shopify app API permissions.`)
  }

  if (!response.ok) throw new Error(data.errors || 'Failed to fetch Shopify products')
  return data.products || []
}

export async function fetchShopifyOrders(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/orders.json?status=any&limit=250`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errors || 'Failed to fetch Shopify orders')
  return data.orders || []
}

export async function fetchShopifyCustomers(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/customers.json?limit=250`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errors || 'Failed to fetch Shopify customers')
  return data.customers || []
}

export async function fetchCompleteShopifyOrder(shopify, orderId) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/orders/${orderId}.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errors || 'Failed to fetch complete Shopify order')
  return data.order || {}
}

export async function createShopifyWebhook(shopify, topic, webhookUrl) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook: {
        topic,
        address: webhookUrl,
        format: 'json'
      }
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(JSON.stringify(data.errors) || 'Failed to create Shopify webhook')
  return data.webhook
}

/**
 * Appends tags to an existing Shopify order (e.g. 'COD-Confirmed', 'COD-Cancelled')
 */
export async function addShopifyOrderTags(shopify, orderId, newTags = []) {
  if (!orderId || !newTags || newTags.length === 0) return null

  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  // 1. Fetch current order to get existing tags
  const existingOrder = await fetchCompleteShopifyOrder(shopify, orderId)
  const currentTags = existingOrder.tags ? existingOrder.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  const tagsToAdd = Array.isArray(newTags) ? newTags : [newTags]
  const combinedTags = Array.from(new Set([...currentTags, ...tagsToAdd])).join(', ')

  // 2. Update order with merged tags
  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/orders/${orderId}.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order: {
        id: Number(orderId),
        tags: combinedTags
      }
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(JSON.stringify(data.errors) || 'Failed to update Shopify order tags')
  return data.order
}

/**
 * Cancels a Shopify order (e.g. when customer clicks Cancel in WhatsApp COD verification)
 */
export async function cancelShopifyOrder(shopify, orderId, reason = 'customer') {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/orders/${orderId}/cancel.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason,
      email: true,
      restock: true
    })
  })

  const data = await response.json()
  if (!response.ok) {
    // If order is already cancelled or couldn't be cancelled via cancel endpoint, update tags as fallback
    await addShopifyOrderTags(shopify, orderId, ['COD-Cancelled-Customer-Request'])
    return { cancelled: false, message: data.errors || 'Could not cancel via API, tagged order instead' }
  }

  // Tag order as COD-Cancelled
  await addShopifyOrderTags(shopify, orderId, ['COD-Cancelled'])
  return data.order
}

/**
 * Fetches a Shopify product by its handle or ID
 */
export async function fetchShopifyProductByHandle(shopify, handle) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/products.json?handle=${encodeURIComponent(handle)}&limit=1`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errors || 'Failed to fetch Shopify product')
  return data.products?.[0] || null
}

/**
 * Generate a short, memorable, URL-safe coupon code
 * Format: PREFIX-XXXXXX (e.g. WELCOME-A8K2Q9)
 */
export function generateShopifyDiscountCode(prefix = 'CHATFLOW') {
  const safePrefix = String(prefix || 'CHATFLOW')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .substring(0, 12) || 'CHATFLOW'
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const timePart = Date.now().toString(36).substring(-4).toUpperCase()
  return `${safePrefix}-${randomPart}${timePart}`.substring(0, 32)
}

/**
 * Create a unique, single-use Shopify Discount Code via the Admin API.
 *
 * @param {object} shopify - integration blob
 * @param {object} options
 * @param {string} [options.code] - explicit code; auto-generated if missing
 * @param {string} options.valueType - 'percentage' | 'fixed_amount'
 * @param {number} options.value - e.g. 10 for 10% off, or 5.00 for $5 off
 * @param {string} options.currency - required for fixed_amount
 * @param {number} [options.usageLimit=1] - default 1 (single-use)
 * @param {string} [options.startsAt] - ISO datetime
 * @param {string} [options.endsAt] - ISO datetime
 * @param {string} [options.customerId] - restrict to one customer (Shopify Plus)
 * @returns {Promise<{code, priceRuleId, discountCodeId, raw: object}>}
 */
export async function createShopifyDiscountCode(shopify, options = {}) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const code = options.code || generateShopifyDiscountCode(options.prefix || 'CHATFLOW')
  const valueType = options.valueType || 'percentage'
  const value = Number(options.value || 10)
  const usageLimit = options.usageLimit ?? 1

  const startsAt = options.startsAt || new Date().toISOString()
  const endsAt = options.endsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Step 1: Create Price Rule
  const priceRuleBody = {
    price_rule: {
      title: `ChatFlow Coupon ${code} ${Date.now()}`,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: valueType,
      value: valueType === 'fixed_amount' ? `-${Math.abs(value)}` : `-${Math.abs(value)}`,
      customer_selection: 'all',
      usage_limit: usageLimit,
      once_per_customer: usageLimit === 1,
      starts_at: startsAt,
      ends_at: endsAt
    }
  }

  if (options.minimumSubtotal) {
    priceRuleBody.price_rule.prerequisite_subtotal_range = {
      greater_than_or_equal_to: Number(options.minimumSubtotal)
    }
  }

  if (options.productIds?.length) {
    priceRuleBody.price_rule.target_type = 'line_item'
    priceRuleBody.price_rule.target_selection = 'entitled'
    priceRuleBody.price_rule.entitled_product_ids = options.productIds
  }

  if (options.collectionIds?.length) {
    priceRuleBody.price_rule.target_selection = 'entitled'
    priceRuleBody.price_rule.entitled_collection_ids = options.collectionIds
  }

  const priceRuleRes = await fetch(`https://${normalizedDomain}/admin/api/2024-01/price_rules.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(priceRuleBody)
  })
  const priceRuleData = await priceRuleRes.json()
  if (!priceRuleRes.ok) {
    throw new Error(priceRuleData.errors || `Failed to create Shopify price rule (${priceRuleRes.status})`)
  }
  const priceRuleId = priceRuleData.price_rule?.id

  // Step 2: Create Discount Code linked to the price rule
  const discountCodeBody = {
    discount_code: {
      code,
      usage_limit: usageLimit
    }
  }

  if (options.customerId) {
    discountCodeBody.discount_code.customer_id = options.customerId
  }

  const discountRes = await fetch(`https://${normalizedDomain}/admin/api/2024-01/price_rules/${priceRuleId}/discount_codes.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(discountCodeBody)
  })
  const discountData = await discountRes.json()
  if (!discountRes.ok) {
    throw new Error(discountData.errors || `Failed to create Shopify discount code (${discountRes.status})`)
  }

  return {
    code,
    priceRuleId,
    discountCodeId: discountData.discount_code?.id,
    raw: discountData.discount_code
  }
}

/**
 * Disable (delete) a Shopify discount code — used when a customer cancels.
 * Soft delete by setting ends_at to past; this is safer than hard delete for
 * customers who already saw the code.
 */
export async function disableShopifyDiscountCode(shopify, priceRuleId) {
  if (!priceRuleId) return null
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const res = await fetch(`https://${normalizedDomain}/admin/api/2024-01/price_rules/${priceRuleId}.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      price_rule: {
        ends_at: new Date(Date.now() - 1000).toISOString()
      }
    })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.errors || `Failed to disable Shopify discount (${res.status})`)
  }
  return true
}

/**
 * Issue a refund for a Shopify order (used by returns self-service flow).
 * Refunds only the given line items / amounts.
 */
export async function refundShopifyOrder(shopify, orderId, refund = {}) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const body = {
    refund: {
      notify: refund.notify !== false,
      note: refund.note || 'Refund issued via WhatsApp automation',
      refund_line_items: (refund.lineItems || []).map((li) => ({
        line_item_id: li.lineItemId,
        quantity: li.quantity || 1,
        restock_type: li.restockType || 'no_restock'
      })),
      transactions: (refund.transactions || []).map((t) => ({
        parent_id: t.parentId,
        amount: String(t.amount || 0),
        kind: t.kind || 'refund',
        gateway: t.gateway
      }))
    }
  }

  if (refund.shipping?.fullRefund === false && refund.shipping?.amount) {
    body.refund.shipping = { amount: String(refund.shipping.amount) }
  } else if (refund.shipping?.fullRefund !== false) {
    body.refund.shipping = { full_refund: true }
  }

  const res = await fetch(`https://${normalizedDomain}/admin/api/2024-01/orders/${orderId}/refunds.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.errors || `Failed to refund Shopify order (${res.status})`)
  return data.refund
}

/**
 * Issue store credit (gift card) to a customer. Uses Shopify's Gift Card API.
 */
export async function createShopifyGiftCard(shopify, { code, initialValue, currency = 'USD', customerId, expiresAt }) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const body = {
    gift_card: {
      initial_value: String(initialValue),
      currency,
      code: code || undefined,
      expires_at: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  if (customerId) body.gift_card.customer_id = customerId

  const res = await fetch(`https://${normalizedDomain}/admin/api/2024-01/gift_cards.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.errors || `Failed to create gift card (${res.status})`)
  return data.gift_card
}

