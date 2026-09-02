const shopifyTokenCache = new Map()

export function normalizeShopifyDomain(shopDomain = '') {
  let domain = String(shopDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^admin\.shopify\.com\/store\//i, '')

  if (domain && !domain.includes('.')) {
    domain = `${domain}.myshopify.com`
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
