const shopifyTokenCache = new Map()

export function normalizeShopifyDomain(shopDomain = '') {
  return shopDomain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^admin\.shopify\.com\/store\/.+$/, '')
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

  if (!normalizedDomain || !shopify?.clientId || !shopify?.clientSecret) {
    throw new Error('Shopify client credentials are incomplete')
  }

  const cacheKey = `${normalizedDomain}::${shopify.clientId}`
  const cachedToken = shopifyTokenCache.get(cacheKey)

  if (cachedToken?.accessToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const tokenResponse = await fetch(`https://${normalizedDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: shopify.clientId,
      client_secret: shopify.clientSecret
    })
  })

  const tokenData = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to fetch Shopify token')
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
    headers: { 'X-Shopify-Access-Token': accessToken }
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errors || 'Failed to fetch Shopify products')
  return data.products || []
}

export async function fetchShopifyOrders(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const normalizedDomain = normalizeShopifyDomain(shopify.shopDomain)

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/orders.json?status=any&limit=50`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errors || 'Failed to fetch Shopify orders')
  return data.orders || []
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
