import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError, sanitizeMetaAccessToken } from '@/lib/meta-auth'
import { buildAutomationTemplateComponents as buildAutomationTemplateComponentsShared } from '@/lib/automation-template'

let pgPool
const shopifyTokenCache = new Map()
let automationConversationStateReadyPromise = null

const WHATSAPP_AUTOMATION_CONVERSATION_WINDOW_MS = 30 * 60 * 1000
const WHATSAPP_AUTOMATION_REPLY_COOLDOWN_MS = 10 * 60 * 1000
const WHATSAPP_SUPPORT_HANDOFF_MS = 2 * 60 * 60 * 1000
const WHATSAPP_MENU_STEP_IDS = new Set(['step-message-4', 'step-message-6'])
const WHATSAPP_SUPPORT_STEP_IDS = new Set(['step-message-11'])

function getPostgresPool() {
  if (!process.env.DB_URL) {
    throw new Error('DB_URL is not configured')
  }

  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.DB_URL
    })
  }

  return pgPool
}

async function queryOne(sql, params = []) {
  const result = await getPostgresPool().query(sql, params)
  return result.rows[0] || null
}

async function queryMany(sql, params = []) {
  const result = await getPostgresPool().query(sql, params)
  return result.rows
}

async function ensureAutomationConversationStateTable() {
  if (!automationConversationStateReadyPromise) {
    automationConversationStateReadyPromise = getPostgresPool().query(`
      CREATE TABLE IF NOT EXISTS automation_conversation_state (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL DEFAULT 'default',
        "automationId" TEXT NOT NULL,
        recipient TEXT NOT NULL,
        state TEXT,
        "lastInboundAt" TIMESTAMP,
        "lastMenuSentAt" TIMESTAMP,
        "lastReplyKey" TEXT,
        "lastReplyAt" TIMESTAMP,
        "handoffUntil" TIMESTAMP,
        payload JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS automation_conversation_state_lookup_idx
      ON automation_conversation_state ("userId", "automationId", recipient);
    `)
  }

  await automationConversationStateReadyPromise
}

function normalizeAutomationRecipientKey(value = '') {
  return String(value || '').replace(/\D/g, '')
}

function getAutomationConversationStateId(automationId, recipient) {
  return `${automationId}:${recipient}`
}

function getDateValue(value) {
  return value ? new Date(value) : null
}

function isWithinMs(timestamp, durationMs, now = new Date()) {
  const value = getDateValue(timestamp)
  return !!(value && now.getTime() - value.getTime() < durationMs)
}

function isHandoffActive(state, now = new Date()) {
  const handoffUntil = getDateValue(state?.handoffUntil)
  return !!(handoffUntil && handoffUntil.getTime() > now.getTime())
}

function shouldSuppressWhatsAppAutomationStep(step, state, now = new Date()) {
  if (!state) return false

  if (WHATSAPP_MENU_STEP_IDS.has(step.id) && isWithinMs(state.lastMenuSentAt, WHATSAPP_AUTOMATION_CONVERSATION_WINDOW_MS, now)) {
    return true
  }

  if (state.lastReplyKey === step.id && isWithinMs(state.lastReplyAt, WHATSAPP_AUTOMATION_REPLY_COOLDOWN_MS, now)) {
    return true
  }

  return false
}

async function getAutomationConversationState(automationId, recipient) {
  await ensureAutomationConversationStateTable()

  return queryOne(
    `SELECT id, "automationId", recipient, state, "lastInboundAt", "lastMenuSentAt", "lastReplyKey", "lastReplyAt", "handoffUntil", payload
     FROM automation_conversation_state
     WHERE "userId" = $1 AND "automationId" = $2 AND recipient = $3
     LIMIT 1`,
    ['default', automationId, recipient]
  )
}

async function saveAutomationConversationState(automationId, recipient, currentState = null, patch = {}) {
  await ensureAutomationConversationStateTable()

  const nextState = {
    id: getAutomationConversationStateId(automationId, recipient),
    userId: 'default',
    automationId,
    recipient,
    state: patch.state ?? currentState?.state ?? null,
    lastInboundAt: patch.lastInboundAt ?? currentState?.lastInboundAt ?? null,
    lastMenuSentAt: patch.lastMenuSentAt ?? currentState?.lastMenuSentAt ?? null,
    lastReplyKey: patch.lastReplyKey ?? currentState?.lastReplyKey ?? null,
    lastReplyAt: patch.lastReplyAt ?? currentState?.lastReplyAt ?? null,
    handoffUntil: patch.handoffUntil ?? currentState?.handoffUntil ?? null,
    payload: patch.payload ?? currentState?.payload ?? {}
  }

  await getPostgresPool().query(
    `INSERT INTO automation_conversation_state
      (id, "userId", "automationId", recipient, state, "lastInboundAt", "lastMenuSentAt", "lastReplyKey", "lastReplyAt", "handoffUntil", payload, "createdAt", "updatedAt")
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW())
     ON CONFLICT (id)
     DO UPDATE SET
      state = EXCLUDED.state,
      "lastInboundAt" = EXCLUDED."lastInboundAt",
      "lastMenuSentAt" = EXCLUDED."lastMenuSentAt",
      "lastReplyKey" = EXCLUDED."lastReplyKey",
      "lastReplyAt" = EXCLUDED."lastReplyAt",
      "handoffUntil" = EXCLUDED."handoffUntil",
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()`,
    [
      nextState.id,
      nextState.userId,
      nextState.automationId,
      nextState.recipient,
      nextState.state,
      nextState.lastInboundAt,
      nextState.lastMenuSentAt,
      nextState.lastReplyKey,
      nextState.lastReplyAt,
      nextState.handoffUntil,
      JSON.stringify(nextState.payload || {})
    ]
  )

  return nextState
}

function getShopifyCacheKey(shopDomain, clientId) {
  return `${shopDomain}::${clientId}`
}

function normalizeShopifyDomain(shopDomain = '') {
  return shopDomain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^admin\.shopify\.com\/store\/.+$/, '')
}

async function getShopifyAccessToken(shopify) {
  const normalizedDomain = normalizeShopifyDomain(shopify?.shopDomain)

  if (!normalizedDomain || !shopify?.clientId || !shopify?.clientSecret) {
    throw new Error('Shopify client credentials are incomplete')
  }

  if (!normalizedDomain.endsWith('.myshopify.com')) {
    throw new Error('Use your Shopify store domain in the format your-store.myshopify.com')
  }

  const cacheKey = getShopifyCacheKey(normalizedDomain, shopify.clientId)
  const cachedToken = shopifyTokenCache.get(cacheKey)

  if (cachedToken?.accessToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const tokenResponse = await fetch(`https://${normalizedDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: shopify.clientId,
      client_secret: shopify.clientSecret
    })
  })

  const rawTokenResponse = await tokenResponse.text()
  let tokenData = null

  try {
    tokenData = rawTokenResponse ? JSON.parse(rawTokenResponse) : {}
  } catch {
    if (rawTokenResponse.trim().startsWith('<')) {
      throw new Error(`Shopify returned an HTML page. Use your store domain like ${normalizedDomain || 'your-store.myshopify.com'}, not an admin.shopify.com URL.`)
    }
    throw new Error('Shopify returned an unreadable token response')
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to fetch Shopify access token')
  }

  const expiresInSeconds = Number(tokenData.expires_in || 86399)
  shopifyTokenCache.set(cacheKey, {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000
  })

  return tokenData.access_token
}

async function getStoredIntegrations() {
  const result = await getPostgresPool().query(
    'SELECT whatsapp, shopify, stripe FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
    ['default']
  )

  return result.rows[0] || null
}

async function saveStoredIntegration(type, data) {
  const pool = getPostgresPool()
  const existing = await pool.query(
    'SELECT id FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
    ['default']
  )

  if (existing.rows[0]) {
    await pool.query(
      `UPDATE integrations
       SET "${type}" = $1::jsonb, "updatedAt" = NOW()
       WHERE id = $2`,
      [JSON.stringify(data), existing.rows[0].id]
    )
    return
  }

  await pool.query(
    `INSERT INTO integrations ("userId", "${type}", "createdAt", "updatedAt")
     VALUES ($1, $2::jsonb, NOW(), NOW())`,
    ['default', JSON.stringify(data)]
  )
}

async function getStoredProducts() {
  const row = await queryOne(
    'SELECT products FROM products WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
    ['default']
  )
  return row?.products || []
}

async function saveStoredProducts(products) {
  const pool = getPostgresPool()
  const existing = await queryOne(
    'SELECT id FROM products WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
    ['default']
  )

  if (existing) {
    await pool.query(
      'UPDATE products SET products = $1::jsonb, "lastSync" = NOW(), "updatedAt" = NOW() WHERE id = $2',
      [JSON.stringify(products), existing.id]
    )
    return
  }

  await pool.query(
    'INSERT INTO products ("userId", products, "lastSync", "createdAt", "updatedAt") VALUES ($1, $2::jsonb, NOW(), NOW(), NOW())',
    ['default', JSON.stringify(products)]
  )
}

function normalizeComparableValue(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractShopifyHandleFromUrl(value = '') {
  if (!value) return ''

  try {
    const parsed = new URL(value)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const productIndex = parts.findIndex((part) => part === 'products')
    return productIndex >= 0 ? (parts[productIndex + 1] || '') : ''
  } catch {
    return ''
  }
}

async function fetchMetaCatalogProducts(whatsapp) {
  if (!whatsapp?.catalogId || !whatsapp?.accessToken) return []

  let url = `https://graph.facebook.com/v22.0/${whatsapp.catalogId}/products?fields=id,retailer_id,name,description,image_url,url,price`
  const products = []

  while (url) {
    const response = await fetch(url, {
      headers: {
        ...buildMetaAuthHeaders(whatsapp.accessToken),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    })

    const data = await response.json()
    if (!response.ok) {
      const metaMessage = data.error?.message || 'Meta catalog API error'
      const isWrongCatalogNode = data.error?.code === 100 && /products/i.test(metaMessage)
      if (isWrongCatalogNode) {
        const looksLikeKnownNonCatalogId =
          String(whatsapp.catalogId || '') === String(whatsapp.businessAccountId || '') ||
          String(whatsapp.catalogId || '') === String(whatsapp.phoneNumberId || '')

        throw new Error(
          looksLikeKnownNonCatalogId
            ? 'Saved Catalog ID is using your WhatsApp account/phone ID, not a Meta product catalog ID. Open Commerce Manager and copy the actual Catalog ID.'
            : 'Saved Catalog ID looks like a real catalog, but this token or app cannot access its products. Make sure the same Meta business/system user has access to that catalog in Commerce Manager.'
        )
      }

      throw new Error(metaMessage)
    }

    products.push(...(Array.isArray(data.data) ? data.data : []))
    url = data.paging?.next || ''
  }

  return products.map((product) => ({
    id: String(product.id || '').trim(),
    retailer_id: String(product.retailer_id || '').trim(),
    name: product.name || '',
    description: product.description || '',
    url: product.url || '',
    image_url: product.image_url || '',
    price: typeof product.price === 'object'
      ? `${product.price.amount || ''}`.trim()
      : String(product.price || '').trim()
  }))
}

async function validateMetaCatalogAccess(whatsapp) {
  if (!whatsapp?.catalogId || !whatsapp?.accessToken) return

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${whatsapp.catalogId}/products?fields=id&limit=1`,
    {
      headers: {
        ...buildMetaAuthHeaders(whatsapp.accessToken),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    }
  )

  const data = await response.json()
  if (response.ok) return

  const metaMessage = mapMetaAccessTokenError(data.error?.message || 'Meta catalog validation failed')
  const unsupportedGet = /unsupported get request/i.test(metaMessage)
  const isWrongCatalogNode = data.error?.code === 100 && /products/i.test(metaMessage)
  if (isWrongCatalogNode || unsupportedGet) {
    const looksLikeKnownNonCatalogId =
      String(whatsapp.catalogId || '') === String(whatsapp.businessAccountId || '') ||
      String(whatsapp.catalogId || '') === String(whatsapp.phoneNumberId || '')

    throw new Error(
      looksLikeKnownNonCatalogId
        ? 'Catalog ID appears to be your WhatsApp account/phone ID, not a Meta product catalog ID. Use the Catalog ID from Commerce Manager.'
        : 'Catalog ID looks real, but this token or app cannot access it. Give the token’s Meta business/system user access to that catalog in Commerce Manager.'
    )
  }

  throw new Error(metaMessage)
}

async function validateWhatsAppPhoneNumberAccess(phoneNumberId, accessToken, businessAccountId = '') {
  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}`, {
    headers: buildMetaAuthHeaders(accessToken),
    cache: 'no-store'
  })

  const data = await response.json()
  if (response.ok) return

  const metaMessage = mapMetaAccessTokenError(data.error?.message || 'Invalid WhatsApp credentials')
  const unsupportedGet = /unsupported get request/i.test(metaMessage)
  if (unsupportedGet || data.error?.code === 100) {
    const looksLikeBusinessAccountId = String(phoneNumberId || '') === String(businessAccountId || '')
    throw new Error(
      looksLikeBusinessAccountId
        ? 'Phone Number ID appears to be your Business Account ID. Use the numeric Phone Number ID from WhatsApp Manager or Meta Developer App setup.'
        : 'Phone Number ID is invalid, inaccessible for this token, or you pasted the wrong Meta ID. Use the numeric Phone Number ID from WhatsApp Manager.'
    )
  }

  throw new Error(metaMessage)
}

function normalizeWhatsAppIntegrationData(data = {}) {
  return {
    ...data,
    phoneNumberId: String(data.phoneNumberId || '').trim(),
    accessToken: sanitizeMetaAccessToken(data.accessToken),
    businessAccountId: String(data.businessAccountId || '').trim(),
    catalogId: String(data.catalogId || '').trim(),
    webhookVerifyToken: String(data.webhookVerifyToken || '').trim()
  }
}

function mapMetaCatalogProductsToAppProducts(metaProducts = []) {
  return metaProducts.map((product) => {
    const retailerId = String(product.retailer_id || '').trim()
    const metaId = String(product.id || '').trim()
    const url = product.url || ''
    const handle = extractShopifyHandleFromUrl(url)

    return {
      id: retailerId || metaId,
      title: product.name || retailerId || metaId || 'Catalog Product',
      description: product.description || '',
      price: product.price || '',
      image: product.image_url || '',
      handle,
      url,
      retailer_id: retailerId,
      metaCatalogProductId: metaId,
      metaCatalogMatched: !!retailerId,
      metaCatalogMatchedBy: 'catalog',
      source: 'meta'
    }
  })
}

function mergeShopifyProductsWithMetaCatalog(shopifyProducts = [], metaProducts = []) {
  if (!Array.isArray(shopifyProducts) || shopifyProducts.length === 0) return []
  if (!Array.isArray(metaProducts) || metaProducts.length === 0) {
    return shopifyProducts.map((product) => ({
      ...product,
      retailer_id: String(product?.retailer_id || product?.retailerId || '').trim(),
      metaCatalogMatched: false,
      metaCatalogMatchedBy: '',
      metaCatalogProductId: ''
    }))
  }

  const byRetailerId = new Map()
  const byHandle = new Map()
  const byUniqueTitle = new Map()
  const titleBuckets = new Map()

  for (const product of metaProducts) {
    const retailerIdKey = normalizeComparableValue(product.retailer_id)
    if (retailerIdKey && !byRetailerId.has(retailerIdKey)) byRetailerId.set(retailerIdKey, product)

    const handleKey = normalizeComparableValue(extractShopifyHandleFromUrl(product.url))
    if (handleKey && !byHandle.has(handleKey)) byHandle.set(handleKey, product)

    const titleKey = normalizeComparableValue(product.name)
    if (titleKey) {
      const bucket = titleBuckets.get(titleKey) || []
      bucket.push(product)
      titleBuckets.set(titleKey, bucket)
    }
  }

  for (const [titleKey, bucket] of titleBuckets.entries()) {
    if (bucket.length === 1) byUniqueTitle.set(titleKey, bucket[0])
  }

  return shopifyProducts.map((product) => {
    const explicitRetailerId = String(product?.retailer_id || product?.retailerId || '').trim()
    const retailerIdCandidate = byRetailerId.get(normalizeComparableValue(explicitRetailerId))
    const idCandidate = byRetailerId.get(normalizeComparableValue(product.id))
    const handleCandidate = byHandle.get(normalizeComparableValue(product.handle))
    const titleCandidate = byUniqueTitle.get(normalizeComparableValue(product.title))

    const matchedProduct = retailerIdCandidate || idCandidate || handleCandidate || titleCandidate || null
    const matchedBy = retailerIdCandidate
      ? 'retailer_id'
      : idCandidate
        ? 'shopify_id'
        : handleCandidate
          ? 'handle'
          : titleCandidate
            ? 'title'
            : ''

    return {
      ...product,
      retailer_id: matchedProduct?.retailer_id || explicitRetailerId || '',
      metaCatalogMatched: !!matchedProduct,
      metaCatalogMatchedBy: matchedBy,
      metaCatalogProductId: matchedProduct?.id || '',
      metaCatalogUrl: matchedProduct?.url || '',
      metaCatalogImage: matchedProduct?.image_url || '',
      metaCatalogName: matchedProduct?.name || ''
    }
  })
}

async function getStoredOrders(limit = 100) {
  return queryMany(
    'SELECT id, "userId", "shopifyOrderId", "orderNumber", "customerName", "customerEmail", "customerPhone", total, currency, status, "lineItems", "createdAt", "updatedAt", "whatsappSent", "whatsappMessageId", "whatsappSentAt" FROM orders WHERE "userId" = $1 ORDER BY "createdAt" DESC NULLS LAST LIMIT $2',
    ['default', limit]
  )
}

async function getLatestStoredOrderByPhone(phone) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  if (!normalizedPhone) return null

  return queryOne(
    `SELECT id, "userId", "shopifyOrderId", "orderNumber", "customerName", "customerEmail", "customerPhone", total, currency, status, "lineItems", "createdAt", "updatedAt", "whatsappSent", "whatsappMessageId", "whatsappSentAt"
     FROM orders
     WHERE "userId" = $1 AND regexp_replace(COALESCE("customerPhone", ''), '\D', '', 'g') = $2
     ORDER BY "createdAt" DESC NULLS LAST, "updatedAt" DESC NULLS LAST
     LIMIT 1`,
    ['default', normalizedPhone]
  )
}

async function getStoredChats() {
  return queryMany(
    'SELECT id, "userId", phone, name, "lastMessage", timestamp, unread, avatar FROM chats WHERE "userId" = $1 ORDER BY timestamp DESC NULLS LAST, "createdAt" DESC NULLS LAST',
    ['default']
  )
}

async function getStoredMessagesByPhone(phone) {
  return queryMany(
    'SELECT id, "userId", recipient, phone, message, "isCustomer", timestamp, "whatsappMessageId", status, "messageType", products, template FROM messages WHERE "userId" = $1 AND (recipient = $2 OR phone = $2) ORDER BY timestamp ASC NULLS LAST, "createdAt" ASC NULLS LAST',
    ['default', phone]
  )
}

async function getStoredChatByPhone(phone) {
  return queryOne(
    'SELECT id, "userId", phone, name, "lastMessage", timestamp, unread, avatar FROM chats WHERE "userId" = $1 AND phone = $2 LIMIT 1',
    ['default', phone]
  )
}

async function upsertStoredChat({ phone, name, lastMessage, timestamp, unread }) {
  const pool = getPostgresPool()
  const existing = await getStoredChatByPhone(phone)

  if (existing) {
    await pool.query(
      'UPDATE chats SET name = $1, "lastMessage" = $2, timestamp = $3, unread = $4, avatar = $5 WHERE id = $6',
      [
        name ?? existing.name,
        lastMessage ?? existing.lastMessage,
        timestamp ?? existing.timestamp ?? new Date(),
        unread ?? existing.unread ?? 0,
        existing.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((name ?? existing.name ?? 'Customer'))}&background=random`,
        existing.id
      ]
    )
    return getStoredChatByPhone(phone)
  }

  const newChat = {
    id: uuidv4(),
    userId: 'default',
    phone,
    name: name || `Customer ${phone}`,
    lastMessage: lastMessage || 'Chat created',
    timestamp: timestamp || new Date(),
    unread: unread || 0,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Customer')}&background=random`
  }

  await pool.query(
    'INSERT INTO chats (id, "userId", phone, name, "lastMessage", timestamp, unread, avatar, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
    [newChat.id, newChat.userId, newChat.phone, newChat.name, newChat.lastMessage, newChat.timestamp, newChat.unread, newChat.avatar]
  )
  return newChat
}

async function insertStoredMessage(message) {
  await getPostgresPool().query(
    'INSERT INTO messages (id, "userId", "campaignId", recipient, phone, message, "isCustomer", timestamp, "whatsappMessageId", status, "messageType", products, template, "orderId", "sentAt", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, NOW())',
    [
      message.id,
      message.userId || 'default',
      message.campaignId || null,
      message.recipient || null,
      message.phone || null,
      message.message || null,
      message.isCustomer ?? null,
      message.timestamp || null,
      message.whatsappMessageId || null,
      message.status || null,
      message.messageType || null,
      message.products ? JSON.stringify(message.products) : null,
      message.template || null,
      message.orderId || null,
      message.sentAt || null
    ]
  )
}

async function saveStoredWebhooks(webhooks) {
  const pool = getPostgresPool()
  const existing = await queryOne(
    'SELECT id FROM webhooks WHERE "userId" = $1 AND type = $2 ORDER BY "createdAt" DESC NULLS LAST, id DESC LIMIT 1',
    ['default', 'shopify']
  )

  if (existing) {
    await pool.query(
      'UPDATE webhooks SET webhooks = $1::jsonb, "createdAt" = NOW() WHERE id = $2',
      [JSON.stringify(webhooks), existing.id]
    )
    return
  }

  await pool.query(
    'INSERT INTO webhooks ("userId", type, webhooks, "createdAt") VALUES ($1, $2, $3::jsonb, NOW())',
    ['default', 'shopify', JSON.stringify(webhooks)]
  )
}

async function insertWebhookLog(type, topic, payload) {
  await getPostgresPool().query(
    `INSERT INTO webhook_logs (id, type, topic, payload, "receivedAt", "createdAt")
     VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())`,
    [uuidv4(), type, topic || null, JSON.stringify(payload || {})]
  )
}

async function getWebhookLogs(limit = 10) {
  const result = await getPostgresPool().query(
    `SELECT id, type, topic, payload, "receivedAt", "createdAt"
     FROM webhook_logs
     ORDER BY "receivedAt" DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows
}

async function getStoredShopifyCustomer(customerId) {
  return queryOne(
    `SELECT id, "customerId", phone
     FROM shopify_customers
     WHERE "customerId" = $1
     ORDER BY "updatedAt" DESC NULLS LAST, id DESC
     LIMIT 1`,
    [customerId]
  )
}

async function upsertStoredShopifyCustomer(customerId, phone) {
  const pool = getPostgresPool()
  const existing = await getStoredShopifyCustomer(customerId)
  if (existing) {
    await pool.query(
      `UPDATE shopify_customers
       SET phone = $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [phone, existing.id]
    )
    return
  }

  await pool.query(
    `INSERT INTO shopify_customers ("customerId", phone, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW())`,
    [customerId, phone]
  )
}

async function insertStoredOrder(order) {
  await getPostgresPool().query(
    `INSERT INTO orders (id, "userId", "shopifyOrderId", "orderNumber", "customerName", "customerEmail", "customerPhone", total, currency, status, "lineItems", "createdAt", "updatedAt", "whatsappSent", "whatsappMessageId", "whatsappSentAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16)`,
    [
      order.id,
      order.userId || 'default',
      order.shopifyOrderId || null,
      order.orderNumber || null,
      order.customerName || null,
      order.customerEmail || null,
      order.customerPhone || null,
      order.total || null,
      order.currency || null,
      order.status || null,
      JSON.stringify(order.lineItems || []),
      order.createdAt || new Date(),
      order.updatedAt || new Date(),
      !!order.whatsappSent,
      order.whatsappMessageId || null,
      order.whatsappSentAt || null
    ]
  )
}

async function getStoredOrderByShopifyOrderId(shopifyOrderId) {
  return queryOne(
    `SELECT id, "userId", "shopifyOrderId", "orderNumber", "customerName", "customerEmail", "customerPhone", total, currency, status, "lineItems", "createdAt", "updatedAt", "whatsappSent", "whatsappMessageId", "whatsappSentAt"
     FROM orders
     WHERE "shopifyOrderId" = $1
     LIMIT 1`,
    [shopifyOrderId]
  )
}

async function updateStoredOrderByShopifyOrderId(shopifyOrderId, patch) {
  const pool = getPostgresPool()
  const fields = []
  const values = []
  let index = 1

  const map = {
    status: 'status',
    updatedAt: '"updatedAt"',
    whatsappSent: '"whatsappSent"',
    whatsappMessageId: '"whatsappMessageId"',
    whatsappSentAt: '"whatsappSentAt"'
  }

  Object.entries(patch).forEach(([key, value]) => {
    if (!(key in map)) return
    fields.push(`${map[key]} = $${index}`)
    values.push(value)
    index += 1
  })

  if (fields.length === 0) return

  values.push(shopifyOrderId)
  await pool.query(
    `UPDATE orders
     SET ${fields.join(', ')}
     WHERE "shopifyOrderId" = $${index}`,
    values
  )
}

function interpolateMessage(template, context) {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function buildAutomationTemplateComponents(templateComponents, variableMappings, context) {
  return buildAutomationTemplateComponentsShared(templateComponents, variableMappings, context)
}

function buildCatalogProductContext(products, shopify, whatsapp = null) {
  const firstProduct = products[0] || null
  const normalizedDomain = normalizeShopifyDomain(shopify?.shopDomain || '')
  const baseDomain = normalizedDomain ? `https://${normalizedDomain}` : ''
  const whatsappCatalogLink = whatsapp?.businessAccountId || whatsapp?.phoneNumberId
    ? `https://wa.me/c/${whatsapp.businessAccountId || whatsapp.phoneNumberId}`
    : ''
  const productLink = firstProduct?.url || firstProduct?.metaCatalogUrl || (firstProduct?.handle && baseDomain ? `${baseDomain}/products/${firstProduct.handle}` : '')
  const catalogLink = baseDomain ? `${baseDomain}/collections/all` : whatsappCatalogLink
  const explicitRetailerIds = products
    .map((product) => String(product?.retailer_id || product?.retailerId || '').trim())
    .filter(Boolean)
  const retailerIds = products
    .map((product) => String(product?.retailer_id || product?.retailerId || product?.id || '').trim())
    .filter(Boolean)

  return {
    product_name: firstProduct?.title || firstProduct?.name || '',
    product_price: firstProduct?.price ? String(firstProduct.price) : '',
    product_link: productLink,
    product_names: products.slice(0, 3).map((product) => product.title || product.name).filter(Boolean).join(', '),
    catalog_link: catalogLink,
    product_retailer_id: retailerIds[0] || '',
    product_retailer_ids: retailerIds,
    explicit_product_retailer_id: explicitRetailerIds[0] || '',
    explicit_product_retailer_ids: explicitRetailerIds
  }
}

function getOrderLineItemTitle(item) {
  return String(
    item?.title ||
    item?.name ||
    item?.product_title ||
    item?.productTitle ||
    item?.variant_title ||
    item?.variantTitle ||
    ''
  ).trim()
}

function buildOrderProductContext(order = null) {
  const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : []
  const itemNames = lineItems
    .map((item) => getOrderLineItemTitle(item))
    .filter(Boolean)

  return {
    order_product_name: itemNames[0] || '',
    order_product_names: itemNames.slice(0, 3).join(', ')
  }
}

function resolveCatalogTemplateVariable(value, context) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''

  const normalized = trimmed.toLowerCase()
  if (normalized === '{{customer_name}}') return context.customer_name || ''
  if (normalized === '{{customer_phone}}') return context.customer_phone || ''
  if (normalized === '{{order_number}}') return context.order_number || ''
  if (normalized === '{{tracking_number}}') return context.tracking_number || ''
  if (normalized === '{{tracking_url}}') return context.tracking_url || ''
  if (normalized === '{{order_total}}') return context.order_total || ''
  if (normalized === '{{currency}}') return context.currency || ''
  if (normalized === '{{order_product_name}}') return context.order_product_name || ''
  if (normalized === '{{order_product_names}}') return context.order_product_names || ''
  if (normalized === '{{product_name}}') return context.product_name || ''
  if (normalized === '{{product_price}}') return context.product_price || ''
  if (normalized === '{{product_link}}') return context.product_link || ''
  if (normalized === '{{product_names}}') return context.product_names || ''
  if (normalized === '{{catalog_link}}') return context.catalog_link || ''

  return trimmed
}

function inferCatalogTemplateVariable(exampleText, index = 0, templateName = '') {
  const sample = String(exampleText || '').trim().toLowerCase()
  const templateLabel = String(templateName || '').trim().toLowerCase()
  const prefersOrderProductContext = /tracking|shipment|shipping|fulfill|delivery|order/i.test(templateLabel)

  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('order') && sample.includes('number')) return '{{order_number}}'
  if (sample.includes('tracking') && sample.includes('number')) return '{{tracking_number}}'
  if (sample.includes('tracking') && (sample.includes('link') || sample.includes('url'))) return '{{tracking_url}}'
  if (sample.includes('catalog') || sample.includes('collection')) return '{{catalog_link}}'
  if (sample.includes('product') && sample.includes('name')) {
    return prefersOrderProductContext ? '{{order_product_name}}' : '{{product_name}}'
  }
  if (sample.includes('product') && sample.includes('price')) return '{{product_price}}'
  if (sample.includes('product') && (sample.includes('link') || sample.includes('url'))) return '{{product_link}}'
  if (sample.includes('browse') || sample.includes('link') || sample.includes('url')) return '{{product_link}}'

  const fallbacks = prefersOrderProductContext
    ? ['{{customer_name}}', '{{order_number}}', '{{order_product_name}}', '{{tracking_url}}', '{{tracking_number}}']
    : ['{{customer_name}}', '{{catalog_link}}', '{{product_name}}', '{{product_link}}', '{{product_price}}']
  return fallbacks[index] || '{{catalog_link}}'
}

function getTemplateSlotExamples(component, groupKey) {
  const exampleGroup = component?.example?.[groupKey]
  if (Array.isArray(exampleGroup) && Array.isArray(exampleGroup[0])) return exampleGroup[0]
  return []
}

function getTemplateParameterSlots(templateComponents = []) {
  const slots = []

  for (const component of templateComponents) {
    if (component?.type === 'HEADER' && component.format === 'TEXT') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateSlotExamples(component, 'header_text')
      matches.forEach((_match, index) => {
        slots.push({
          componentType: 'HEADER',
          parameterType: 'text',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateSlotExamples(component, 'body_text')
      matches.forEach((_match, index) => {
        slots.push({
          componentType: 'BODY',
          parameterType: 'text',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button) => {
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((_match, index) => {
          slots.push({
            componentType: 'BUTTON',
            parameterType: 'text',
            buttonType: String(button.type || '').toUpperCase(),
            example: button?.example?.[index] || ''
          })
        })
      })
    }
  }

  return slots
}

function isProductDependentTemplateVariable(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized === '{{product_name}}' ||
    normalized === '{{product_price}}' ||
    normalized === '{{product_link}}' ||
    normalized === '{{product_names}}'
  )
}

function isOrderDependentTemplateVariable(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized === '{{order_number}}' ||
    normalized === '{{tracking_number}}' ||
    normalized === '{{tracking_url}}' ||
    normalized === '{{order_total}}' ||
    normalized === '{{currency}}' ||
    normalized === '{{order_product_name}}' ||
    normalized === '{{order_product_names}}'
  )
}

function templateRequiresProductContext(templateComponents = [], templateVariables = [], templateName = '') {
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferCatalogTemplateVariable(slot.example, index, templateName)
  ))

  if (resolvedVariableOrder.some((value) => isProductDependentTemplateVariable(value))) {
    return true
  }

  return templateComponents.some((component) => (
    component?.type === 'BUTTONS' &&
    Array.isArray(component.buttons) &&
    component.buttons.some((button) => {
      const buttonType = String(button?.type || '').toUpperCase()
      return buttonType === 'MPM' || buttonType === 'CATALOG'
    })
  ))
}

function templateRequiresOrderContext(templateComponents = [], templateVariables = [], templateName = '') {
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferCatalogTemplateVariable(slot.example, index, templateName)
  ))

  return resolvedVariableOrder.some((value) => isOrderDependentTemplateVariable(value))
}

function buildCatalogTemplatePayload({ templateName, templateLanguage, templateComponents = [], templateVariables = [], templateHeaderImageUrl = '', productContext, recipientContext }) {
  const mergedContext = { ...productContext, ...recipientContext }
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferCatalogTemplateVariable(slot.example, index, templateName)
  ))

  let cursor = 0
  const components = []

  for (const component of templateComponents) {
    if (component?.type === 'HEADER') {
      if (component.format === 'IMAGE') {
        if (!templateHeaderImageUrl) {
          throw new Error('Template requires an image header. Upload an image or provide a public image URL.')
        }

        const headerUrl = templateHeaderImageUrl.trim()
        if (headerUrl.startsWith('http://localhost') || headerUrl.startsWith('http://0.0.0.0') || headerUrl.startsWith('http://127.0.0.1')) {
          throw new Error(`Header image URL must be publicly accessible. "${headerUrl}" points to a local server.`)
        }

        components.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: headerUrl }
            }
          ]
        })
      } else if (component.format === 'VIDEO') {
        if (!templateHeaderImageUrl) {
          throw new Error('Template requires a video header but no public video URL was provided.')
        }

        components.push({
          type: 'header',
          parameters: [
            {
              type: 'video',
              video: { link: templateHeaderImageUrl.trim() }
            }
          ]
        })
      } else if (component.format === 'TEXT') {
        const matches = component.text?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'header',
            parameters: matches.map(() => {
              const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
              cursor += 1
              return { type: 'text', text: value }
            })
          })
        }
      }
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      if (matches.length > 0) {
        components.push({
          type: 'body',
          parameters: matches.map(() => {
            const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
            cursor += 1
            return { type: 'text', text: value }
          })
        })
      }
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase()

        if (buttonType === 'MPM') {
          const retailerIds = Array.isArray(productContext.explicit_product_retailer_ids) ? productContext.explicit_product_retailer_ids : []
          if (retailerIds.length === 0) {
            throw new Error('This template requires Meta retailer IDs for the selected products. Sync or map your Meta catalog retailer_id values before sending MPM templates.')
          }

          components.push({
            type: 'button',
            sub_type: 'mpm',
            index: String(buttonIndex),
            parameters: [
              {
                type: 'action',
                action: {
                  thumbnail_product_retailer_id: retailerIds[0],
                  sections: [
                    {
                      title: 'Products',
                      product_items: retailerIds.slice(0, 30).map((productRetailerId) => ({
                        product_retailer_id: productRetailerId
                      }))
                    }
                  ]
                }
              }
            ]
          })
          return
        }

        if (buttonType === 'CATALOG') {
          const retailerId = productContext.explicit_product_retailer_id
          if (!retailerId) {
            throw new Error('This template requires a Meta retailer ID for the selected product. Sync or map the product retailer_id before sending catalog-button templates.')
          }

          components.push({
            type: 'button',
            sub_type: 'catalog',
            index: String(buttonIndex),
            parameters: [
              {
                type: 'action',
                action: {
                  thumbnail_product_retailer_id: retailerId
                }
              }
            ]
          })
          return
        }

        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'button',
            sub_type: buttonType.toLowerCase(),
            index: String(buttonIndex),
            parameters: matches.map(() => {
              const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
              cursor += 1
              return { type: 'text', text: value }
            })
          })
        }
      })
    }
  }

  const templatePayload = {
    name: templateName,
    language: {
      code: templateLanguage || 'en_US'
    }
  }

  if (components.length > 0) {
    templatePayload.components = components
  }

  return templatePayload
}

function parseDelayToMs(step) {
  const value = parseInt(step.delayValue || '0', 10)
  if (!value) return 0
  if (step.delayUnit === 'minutes') return value * 60 * 1000
  if (step.delayUnit === 'days') return value * 24 * 60 * 60 * 1000
  return value * 60 * 60 * 1000
}

function getSequentialStepId(steps, currentStepId) {
  const index = steps.findIndex((step) => step.id === currentStepId)
  if (index === -1) return ''
  return steps[index + 1]?.id || ''
}

function getNextAutomationStepId(steps, step, key = 'main') {
  const explicitTarget = step?.connections?.[key]
  if (explicitTarget) return explicitTarget
  if (key === 'fallback') return ''
  return getSequentialStepId(steps, step?.id)
}

function matchesCondition(rule, context) {
  if (!rule) return true
  const trimmed = rule.trim()
  if (trimmed.includes(' contains_any ')) {
    const [left, right] = trimmed.split(' contains_any ').map((value) => value.trim())
    const haystack = String(context[left] ?? '').toLowerCase()
    return right.split('|').some((token) => haystack.includes(token.trim().toLowerCase()))
  }
  if (trimmed.includes(' not contains ')) {
    const [left, right] = trimmed.split(' not contains ').map((value) => value.trim())
    return !String(context[left] ?? '').toLowerCase().includes(right.toLowerCase())
  }
  if (trimmed.includes(' contains ')) {
    const [left, right] = trimmed.split(' contains ').map((value) => value.trim())
    return String(context[left] ?? '').toLowerCase().includes(right.toLowerCase())
  }
  if (trimmed.includes('!=')) {
    const [left, right] = trimmed.split('!=').map((value) => value.trim())
    return String(context[left] ?? '') !== right
  }
  if (trimmed.includes('=')) {
    const [left, right] = trimmed.split('=').map((value) => value.trim())
    return String(context[left] ?? '') === right
  }
  return true
}

function buildIncomingWhatsAppAutomationContext(messageData, savedMessage, contact) {
  const textBody = messageData?.text?.body || savedMessage?.message || ''
  const displayName =
    contact?.profile?.name ||
    contact?.wa_id ||
    savedMessage?.recipient ||
    'Customer'

  return {
    customer_name: displayName,
    customer_phone: messageData?.from || savedMessage?.recipient || '',
    customerPhone: messageData?.from || savedMessage?.recipient || '',
    customer_message: textBody,
    financial_status: '',
    order_number: '',
    tracking_number: '',
    tracking_url: '',
    review_link: process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com/review',
    order_total: '',
    currency: 'INR'
  }
}

async function queueAutomationJob(automationId, recipient, message, template, payload, runAt) {
  const pool = getPostgresPool()
  if (!pool) return

  await pool.query(
    `INSERT INTO automation_jobs (id, "automationId", "userId", recipient, message, template, payload, status, "runAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', $8, NOW())`,
    [uuidv4(), automationId, 'default', recipient, message, template || null, JSON.stringify(payload || {}), runAt]
  )
}

async function incrementAutomationSentMetric(automationId) {
  const pool = getPostgresPool()
  if (!pool) return

  await pool.query(
    `UPDATE automations
     SET metrics = jsonb_set(COALESCE(metrics, '{}'::jsonb), '{sent}', to_jsonb(COALESCE((metrics->>'sent')::int, 0) + 1), true),
         "updatedAt" = NOW()
     WHERE id = $1`,
    [automationId]
  )
}

function resolveAutomationRecipient(step, context) {
  if (step?.recipientMode === 'fixed_number') {
    const fixedRecipient = typeof step.recipientNumber === 'string' ? step.recipientNumber.replace(/\D/g, '') : ''
    return fixedRecipient || null
  }

  const customerRecipient = typeof context.customerPhone === 'string' ? context.customerPhone.replace(/\D/g, '') : ''
  return customerRecipient || null
}

async function executeAutomationsForEvent(eventType, context, integrations) {
  const pool = getPostgresPool()
  if (!pool || !integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
    return
  }

  const automations = await queryMany(
    `SELECT id, name, steps, metrics
     FROM automations
     WHERE "userId" = $1 AND status = true`,
    ['default']
  )

  for (const automation of automations) {
    const steps = Array.isArray(automation.steps) ? automation.steps : []
    const trigger = steps.find((step) => step.type === 'trigger')
    if (!trigger || trigger.event !== eventType) continue

    const isIncomingWhatsAppAutomation = eventType === 'whatsapp.message_received'
    const conversationRecipient = isIncomingWhatsAppAutomation
      ? normalizeAutomationRecipientKey(resolveAutomationRecipient({ recipientMode: 'customer' }, context))
      : ''
    const now = new Date()
    let conversationState = null

    if (isIncomingWhatsAppAutomation && conversationRecipient) {
      conversationState = await getAutomationConversationState(automation.id, conversationRecipient)
      conversationState = await saveAutomationConversationState(
        automation.id,
        conversationRecipient,
        conversationState,
        { lastInboundAt: now }
      )

      if (isHandoffActive(conversationState, now)) {
        continue
      }
    }

    let totalDelayMs = 0
    let currentStepId = getNextAutomationStepId(steps, trigger, 'main')
    const visited = new Set([trigger.id])

    while (currentStepId && !visited.has(currentStepId)) {
      visited.add(currentStepId)
      const step = steps.find((item) => item.id === currentStepId)
      if (!step) break

      if (step.type === 'condition') {
        const passed = matchesCondition(step.rule, context)
        currentStepId = getNextAutomationStepId(steps, step, passed ? 'main' : 'fallback')
        continue
      }

      if (step.type === 'delay') {
        totalDelayMs += parseDelayToMs(step)
        currentStepId = getNextAutomationStepId(steps, step, 'main')
        continue
      }

      if (step.type === 'message') {
        const recipient = resolveAutomationRecipient(step, context)
        if (!recipient) {
          currentStepId = getNextAutomationStepId(steps, step, 'main')
          continue
        }

        if (
          isIncomingWhatsAppAutomation &&
          conversationRecipient &&
          normalizeAutomationRecipientKey(recipient) === conversationRecipient &&
          shouldSuppressWhatsAppAutomationStep(step, conversationState, now)
        ) {
          currentStepId = getNextAutomationStepId(steps, step, 'main')
          continue
        }

        const body = interpolateMessage(step.message, context)

        if (totalDelayMs > 0) {
          await queueAutomationJob(
            automation.id,
            recipient,
            body,
            step.template,
            {
              ...context,
              recipientMode: step.recipientMode || 'customer',
              recipientNumber: step.recipientNumber || '',
              templateLanguage: step.templateLanguage || 'en_US',
              templateComponents: step.templateComponents || [],
              variableMappings: step.variableMappings || []
            },
            new Date(Date.now() + totalDelayMs)
          )

          if (isIncomingWhatsAppAutomation && conversationRecipient && normalizeAutomationRecipientKey(recipient) === conversationRecipient) {
            conversationState = await saveAutomationConversationState(
              automation.id,
              conversationRecipient,
              conversationState,
              {
                state: WHATSAPP_SUPPORT_STEP_IDS.has(step.id) ? 'handoff' : (WHATSAPP_MENU_STEP_IDS.has(step.id) ? 'awaiting_choice' : 'active'),
                lastMenuSentAt: WHATSAPP_MENU_STEP_IDS.has(step.id) ? now : conversationState?.lastMenuSentAt,
                lastReplyKey: step.id,
                lastReplyAt: now,
                handoffUntil: WHATSAPP_SUPPORT_STEP_IDS.has(step.id)
                  ? new Date(now.getTime() + WHATSAPP_SUPPORT_HANDOFF_MS)
                  : conversationState?.handoffUntil
              }
            )
          }

          currentStepId = getNextAutomationStepId(steps, step, 'main')
          continue
        }

        try {
          const templateComponents = buildAutomationTemplateComponents(step.templateComponents, step.variableMappings, context)
          const messageData = step.template
            ? {
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'template',
              template: {
                name: step.template,
                language: {
                  code: step.templateLanguage || 'en_US'
                },
                ...(templateComponents ? { components: templateComponents } : {})
              }
            }
            : {
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'text',
              text: { body }
            }

          const result = await sendWhatsAppMessage(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            recipient,
            messageData
          )

          await insertStoredMessage({
            id: uuidv4(),
            userId: 'default',
            recipient,
            phone: recipient,
            message: body,
            isCustomer: false,
            timestamp: new Date(),
            whatsappMessageId: result.messages?.[0]?.id,
            status: 'sent',
            template: step.template || null
          })

          await incrementAutomationSentMetric(automation.id)

          if (isIncomingWhatsAppAutomation && conversationRecipient && normalizeAutomationRecipientKey(recipient) === conversationRecipient) {
            conversationState = await saveAutomationConversationState(
              automation.id,
              conversationRecipient,
              conversationState,
              {
                state: WHATSAPP_SUPPORT_STEP_IDS.has(step.id) ? 'handoff' : (WHATSAPP_MENU_STEP_IDS.has(step.id) ? 'awaiting_choice' : 'active'),
                lastMenuSentAt: WHATSAPP_MENU_STEP_IDS.has(step.id) ? now : conversationState?.lastMenuSentAt,
                lastReplyKey: step.id,
                lastReplyAt: now,
                handoffUntil: WHATSAPP_SUPPORT_STEP_IDS.has(step.id)
                  ? new Date(now.getTime() + WHATSAPP_SUPPORT_HANDOFF_MS)
                  : conversationState?.handoffUntil
              }
            )
          }
        } catch (error) {
          console.error(`Automation ${automation.name} failed:`, error.message)
        }

        currentStepId = getNextAutomationStepId(steps, step, 'main')
        continue
      }

      currentStepId = getNextAutomationStepId(steps, step, 'main')
    }
  }
}

async function processDueAutomationJobs() {
  const pool = getPostgresPool()
  if (!pool) return

  const integrations = await getStoredIntegrations()
  if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) return

  const jobs = await queryMany(
    `SELECT id, "automationId", recipient, message, template, payload
     FROM automation_jobs
     WHERE status = 'pending' AND "runAt" <= NOW()
     ORDER BY "runAt" ASC
     LIMIT 10`
  )

  for (const job of jobs) {
    try {
      const templateComponents = buildAutomationTemplateComponents(job.payload?.templateComponents, job.payload?.variableMappings, job.payload || {})
      const result = await sendWhatsAppMessage(
        integrations.whatsapp.phoneNumberId,
        integrations.whatsapp.accessToken,
        job.recipient,
        job.template
          ? {
            messaging_product: 'whatsapp',
            to: job.recipient.replace(/\D/g, ''),
            type: 'template',
            template: {
              name: job.template,
              language: {
                code: job.payload?.templateLanguage || 'en_US'
              },
              ...(templateComponents ? { components: templateComponents } : {})
            }
          }
          : {
            messaging_product: 'whatsapp',
            to: job.recipient.replace(/\D/g, ''),
            type: 'text',
            text: { body: job.message }
          }
      )

      await insertStoredMessage({
        id: uuidv4(),
        userId: 'default',
        recipient: job.recipient,
        phone: job.recipient,
        message: job.message,
        isCustomer: false,
        timestamp: new Date(),
        whatsappMessageId: result.messages?.[0]?.id,
        status: 'sent',
        template: job.template || null
      })

      await query(
        `UPDATE automation_jobs
         SET status = 'sent', "processedAt" = NOW()
         WHERE id = $1`,
        [job.id]
      )

      await incrementAutomationSentMetric(job.automationId)
    } catch (error) {
      await query(
        `UPDATE automation_jobs
         SET status = 'failed', "processedAt" = NOW(), payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{error}', to_jsonb($2::text), true)
         WHERE id = $1`,
        [job.id, error.message]
      )
    }
  }
}

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// WhatsApp API functions
async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  // Updated to use the same version as your working cURL command
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })

  const data = await response.json()

  // Improved error handling to ensure we only return success when the message is actually sent
  if (!response.ok) {
    console.error('WhatsApp API Error:', data);
    throw new Error(data.error?.message || `WhatsApp API error: ${response.status} ${response.statusText}`)
  }

  // Additional validation that the message was accepted
  if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
    console.error('Unexpected WhatsApp API response:', data);
    throw new Error('WhatsApp API returned unexpected response format')
  }

  return data
}

// Function to save incoming WhatsApp messages to database
async function saveIncomingMessage(messageData) {
  console.log('saveIncomingMessage called with:', JSON.stringify(messageData, null, 2));

  // Extract data based on message type
  const { from, text, timestamp, type, image, document, audio, video, location, contacts } = messageData;

  // Create message object
  const message = {
    id: uuidv4(),
    userId: 'default',
    recipient: from, // This is the customer's phone number
    phone: from, // Also store phone number directly for easier querying
    message: '', // Will be populated based on message type
    isCustomer: true,
    timestamp: new Date(timestamp ? timestamp * 1000 : Date.now()), // Convert WhatsApp timestamp to JS Date
    whatsappMessageId: messageData.id,
    status: 'received',
    messageType: type || 'unknown'
  };

  // Handle different message types
  if (type === 'text' && text?.body) {
    message.message = text.body;
  } else if (type === 'image') {
    message.message = '[Image message received]';
  } else if (type === 'document') {
    message.message = '[Document message received]';
  } else if (type === 'audio') {
    message.message = '[Audio message received]';
  } else if (type === 'video') {
    message.message = '[Video message received]';
  } else if (type === 'location' && location) {
    message.message = `[Location: ${location.latitude}, ${location.longitude}]`;
  } else if (type === 'contacts' && contacts) {
    message.message = '[Contact information received]';
  } else {
    // Fallback for unknown message types
    message.message = '[Message received]';
    console.log('Unknown message type:', JSON.stringify(messageData, null, 2));
  }

  console.log('Saving message to database:', JSON.stringify(message, null, 2));

  await insertStoredMessage(message);

  // Update or create chat in the chats collection
  const chat = await getStoredChatByPhone(from);
  await upsertStoredChat({
    phone: from,
    name: chat?.name || `Customer ${from}`,
    lastMessage: message.message,
    timestamp: message.timestamp,
    unread: (chat?.unread || 0) + 1
  });

  return message;
}

// Function to save outgoing WhatsApp messages to database
async function saveOutgoingMessage(to, messageText, whatsappResponse) {
  const message = {
    id: uuidv4(),
    userId: 'default',
    recipient: to,
    phone: to, // Also store phone number directly for easier querying
    message: messageText,
    isCustomer: false,
    timestamp: new Date(),
    whatsappMessageId: whatsappResponse.messages?.[0]?.id,
    status: 'sent'
  };

  await insertStoredMessage(message);

  // Update or create chat in the chats collection
  const chat = await getStoredChatByPhone(to);
  await upsertStoredChat({
    phone: to,
    name: chat?.name || `Customer ${to}`,
    lastMessage: messageText,
    timestamp: new Date(),
    unread: chat?.unread || 0
  });

  return message;
}

async function sendOrderStatusUpdate(phoneNumberId, accessToken, to, order, newStatus) {
  // Format the status message
  let statusMessage = '';
  let statusEmoji = '';

  switch (newStatus) {
    case 'fulfilled':
      statusEmoji = '✅';
      statusMessage = `Your order #${order.orderNumber} has been fulfilled and is on its way!`;
      break;
    case 'shipped':
      statusEmoji = '🚚';
      statusMessage = `Your order #${order.orderNumber} has been shipped!`;
      break;
    case 'cancelled':
      statusEmoji = '❌';
      statusMessage = `Your order #${order.orderNumber} has been cancelled.`;
      break;
    case 'refunded':
      statusEmoji = '💰';
      statusMessage = `Your order #${order.orderNumber} has been refunded.`;
      break;
    default:
      statusEmoji = '🔄';
      statusMessage = `Your order #${order.orderNumber} status has been updated to: ${newStatus}`;
  }

  const messageData = {
    messaging_product: "whatsapp",
    to: to.replace(/\D/g, ''),
    type: "text",
    text: {
      body: `${statusEmoji} *Order Status Update*

${statusMessage}

Thank you for your purchase!`
    }
  };

  return await sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData);
}

// Shopify API functions
async function fetchShopifyProducts(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/products.json`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify API error')
  }

  return data.products.map(product => ({
    id: product.id.toString(),
    title: product.title,
    description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 200),
    price: product.variants[0]?.price || '0.00',
    image: product.images[0]?.src,
    handle: product.handle
  }))
}

async function fetchShopifyOrders(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/orders.json?status=any`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify API error')
  }

  // Transform Shopify orders to match our internal format
  return data.orders.map(order => ({
    id: `shopify-${order.id}`,
    userId: 'default',
    shopifyOrderId: order.id.toString(),
    orderNumber: order.order_number,
    customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
    customerEmail: order.customer?.email,
    customerPhone: order.customer?.phone,
    total: order.total_price,
    currency: order.currency,
    status: order.financial_status,
    lineItems: order.line_items || [],
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at || order.created_at)
  }))
}

async function fetchCompleteShopifyOrder(shopify, orderId) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/orders/${orderId}.json`;

  console.log(`Fetching complete order ${orderId} from Shopify API: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`Shopify API error fetching complete order ${orderId}:`, data.errors || response.status);
    throw new Error(data.errors || 'Shopify API error fetching complete order');
  }

  console.log(`Successfully fetched complete order ${orderId}`);
  return data.order;
}

async function createShopifyWebhook(shopify, topic, webhookUrl) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/webhooks.json`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook: {
        topic: topic,
        address: webhookUrl,
        format: 'json'
      }
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify webhook creation error')
  }

  return data.webhook
}

// Stripe functions
async function createStripeCheckoutSession(lineItems, metadata) {
  // This would integrate with Stripe API
  // Placeholder for now
  const sessionId = uuidv4()
  const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`

  return {
    id: sessionId,
    url: checkoutUrl
  }
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  // Fix the route construction to properly handle webhook paths
  const route = path.length > 0 ? `/${path.join('/')}` : '/'
  const method = request.method

  // Add debugging for route matching
  console.log(`Processing route: ${route}, method: ${method}, path array:`, path)
  console.log(`Full params:`, params)

  try {
    await processDueAutomationJobs()

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "WhatsApp Commerce Hub API" }))
    }

    // Integrations endpoints
    if (route === '/integrations' && method === 'GET') {
      const integrations = await getStoredIntegrations()

      const defaultIntegrations = {
        whatsapp: {
          connected: false,
          data: {
            phoneNumberId: '',
            businessAccountId: '',
            catalogId: '',
            webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || ''
          }
        },
        shopify: { connected: false, data: {} },
        stripe: { connected: false, data: {} }
      }

      if (integrations) {
        // Check if integrations are properly configured
        defaultIntegrations.whatsapp.connected = !!(integrations.whatsapp?.phoneNumberId && integrations.whatsapp?.accessToken)
        defaultIntegrations.shopify.connected = !!(
          integrations.shopify?.shopDomain &&
          integrations.shopify?.clientId &&
          integrations.shopify?.clientSecret
        )
        defaultIntegrations.stripe.connected = !!(integrations.stripe?.secretKey)

        // Return data without sensitive fields
        const normalizedWhatsApp = normalizeWhatsAppIntegrationData(integrations.whatsapp || {})
        defaultIntegrations.whatsapp.data = {
          phoneNumberId: normalizedWhatsApp.phoneNumberId,
          businessAccountId: normalizedWhatsApp.businessAccountId,
          catalogId: normalizedWhatsApp.catalogId,
          webhookVerifyToken: normalizedWhatsApp.webhookVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || ''
        }
        defaultIntegrations.shopify.data = {
          shopDomain: integrations.shopify?.shopDomain || '',
          clientId: integrations.shopify?.clientId || ''
        }
        defaultIntegrations.stripe.data = {
          publishableKey: integrations.stripe?.publishableKey || ''
        }
      }

      return handleCORS(NextResponse.json(defaultIntegrations))
    }

    if (route === '/integrations' && method === 'POST') {
      const body = await request.json()
      const { type } = body
      let { data } = body
      let warning = ''

      if (!type || !data) {
        return handleCORS(NextResponse.json(
          { error: "Type and data are required" },
          { status: 400 }
        ))
      }

      if (type === 'whatsapp') {
        data = normalizeWhatsAppIntegrationData(data)
      }

      // Test the integration before saving
      try {
        if (type === 'whatsapp' && data.phoneNumberId && data.accessToken) {
          await validateWhatsAppPhoneNumberAccess(
            data.phoneNumberId,
            data.accessToken,
            data.businessAccountId
          )

          if (data.catalogId) {
            try {
              await validateMetaCatalogAccess({
                catalogId: data.catalogId,
                accessToken: data.accessToken,
                businessAccountId: data.businessAccountId,
                phoneNumberId: data.phoneNumberId
              })
            } catch (error) {
              warning = `Meta Catalog ID was not saved: ${error.message}`
              delete data.catalogId
            }
          }
        }

        if (type === 'shopify' && data.shopDomain && data.clientId && data.clientSecret) {
          // Test Shopify connection
          await fetchShopifyProducts(data)
        }

        if (type === 'stripe' && data.secretKey) {
          // Test Stripe connection (placeholder)
          if (!data.secretKey.startsWith('sk_')) {
            throw new Error('Invalid Stripe secret key format')
          }
        }
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Integration test failed: ${error.message}` },
          { status: 400 }
        ))
      }

      // Ensure WhatsApp configuration has the right structure
      if (type === 'whatsapp') {
        if (!data.webhookVerifyToken) {
          data.webhookVerifyToken = `wa_verify_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
        }

        data.connected = !!(data.phoneNumberId && data.accessToken);
        // Ensure catalogId is properly handled
        if (data.catalogId === '') {
          delete data.catalogId;
        }
      }

      if (type === 'shopify') {
        data = {
          shopDomain: normalizeShopifyDomain(data.shopDomain || ''),
          clientId: data.clientId || '',
          clientSecret: data.clientSecret || ''
        }
      }

      // Save integration
      await saveStoredIntegration(type, data)

      return handleCORS(NextResponse.json({ success: true, ...(warning ? { warning } : {}) }))
    }

    // Setup webhooks endpoint
    if (route === '/setup-webhooks' && method === 'POST') {
      const integrations = await getStoredIntegrations();

      if (!integrations?.shopify?.shopDomain || !integrations?.shopify?.clientId || !integrations?.shopify?.clientSecret) {
        return handleCORS(NextResponse.json(
          { error: "Shopify not configured" },
          { status: 400 }
        ))
      }

      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/shopify`

        // Create webhooks for order creation and status updates
        const webhooks = [
          { topic: 'orders/create', address: webhookUrl },
          { topic: 'orders/updated', address: webhookUrl },
          { topic: 'orders/paid', address: webhookUrl },
          { topic: 'orders/fulfilled', address: webhookUrl },
          { topic: 'orders/cancelled', address: webhookUrl },
          // NEW: Add customer webhooks to capture phone numbers
          { topic: 'customers/create', address: webhookUrl },
          { topic: 'customers/update', address: webhookUrl }
        ];

        const createdWebhooks = [];

        for (const webhook of webhooks) {
          try {
            const createdWebhook = await createShopifyWebhook(
              integrations.shopify,
              webhook.topic,
              webhook.address
            );

            createdWebhooks.push({
              webhookId: createdWebhook.id,
              topic: webhook.topic,
              address: webhook.address
            });
          } catch (error) {
            console.error(`Failed to create webhook for ${webhook.topic}:`, error.message);
            // Continue with other webhooks even if one fails
          }
        }

        // Save webhook info
        await saveStoredWebhooks(createdWebhooks)

        return handleCORS(NextResponse.json({
          success: true,
          webhooks: createdWebhooks
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to setup webhooks: ${error.message}` },
          { status: 400 }
        ))
      }
    }

    // Webhook logs endpoint
    if (route === '/webhook-logs' && method === 'GET') {
      try {
        const webhookUrl = new URL(request.url)
        const limit = parseInt(webhookUrl.searchParams.get('limit')) || 10
        const logs = await getWebhookLogs(limit)
        return handleCORS(NextResponse.json({ logs }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to get webhook logs: ${error.message}` },
          { status: 500 }
        ))
      }
    }

    // Products endpoint
    if (route === '/products' && method === 'GET') {
      const integrations = await getStoredIntegrations()

      try {
        const hasMetaCatalog = !!(integrations?.whatsapp?.catalogId && integrations?.whatsapp?.accessToken)

        if (!hasMetaCatalog) {
          return handleCORS(NextResponse.json(
            { error: "Meta catalog not configured. Connect WhatsApp catalog access to load products." },
            { status: 400 }
          ))
        }

        const metaCatalogProducts = await fetchMetaCatalogProducts(integrations.whatsapp)
        const metaProducts = mapMetaCatalogProductsToAppProducts(metaCatalogProducts)
        await saveStoredProducts(metaProducts)
        return handleCORS(NextResponse.json(metaProducts))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to fetch products: ${error.message}` },
          { status: 400 }
        ))
      }
    }

    // Orders endpoint
    if (route === '/orders' && method === 'GET') {
      try {
        // Try to fetch orders from Shopify if integration is configured
        const integrations = await getStoredIntegrations()

        if (integrations?.shopify?.shopDomain && integrations?.shopify?.clientId && integrations?.shopify?.clientSecret) {
          try {
            // Fetch orders directly from Shopify
            const shopifyOrders = await fetchShopifyOrders(integrations.shopify)

            // Return Shopify orders
            return handleCORS(NextResponse.json(shopifyOrders))
          } catch (error) {
            console.error('Failed to fetch Shopify orders:', error)
            // Fall back to database orders if Shopify fetch fails
          }
        }

        // Fall back to database orders
        const orders = await getStoredOrders(100)
        const cleanedOrders = orders.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedOrders))
      } catch (error) {
        console.error('Failed to fetch orders:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch orders' },
          { status: 500 }
        ))
      }
    }

    // Update the send catalog endpoint to support template selection and multiple recipients
    if (route === '/send-catalog' && method === 'POST') {
      try {
        const body = await request.json();
        const { products: productIds, recipient, recipients, templateName, templateLanguage, templateComponents, templateVariables, templateHeaderImageUrl } = body;
        const normalizedProductIds = Array.isArray(productIds) ? productIds : []

        // Handle both single recipient and multiple recipients
        let recipientList = [];
        if (recipients && Array.isArray(recipients) && recipients.length > 0) {
          recipientList = recipients;
        } else if (recipient) {
          // Support both single recipient and comma-separated recipients
          recipientList = recipient.split(',').map(r => r.trim()).filter(r => r);
        } else {
          return handleCORS(NextResponse.json(
            { error: "Recipient phone number(s) required" },
            { status: 400 }
          ));
        }

        // Get integrations
        const integrations = await getStoredIntegrations();

        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { error: "WhatsApp not configured" },
            { status: 400 }
          ));
        }

        // Get products
        const storedProducts = await getStoredProducts();
        if (normalizedProductIds.length > 0 && (!storedProducts || storedProducts.length === 0)) {
          return handleCORS(NextResponse.json(
            { error: "No products found. Please sync products first." },
            { status: 400 }
          ));
        }

        const selectedProducts = Array.isArray(storedProducts)
          ? storedProducts.filter(p => normalizedProductIds.includes(p.id))
          : [];
        const productContext = buildCatalogProductContext(selectedProducts, integrations.shopify, integrations.whatsapp);
        const selectedTemplateComponents = Array.isArray(templateComponents) ? templateComponents : []
        const selectedTemplateVariables = Array.isArray(templateVariables) ? templateVariables : []
        const requiresProducts = templateName
          ? templateRequiresProductContext(selectedTemplateComponents, selectedTemplateVariables, templateName)
          : false
        const requiresOrderContext = templateName
          ? templateRequiresOrderContext(selectedTemplateComponents, selectedTemplateVariables, templateName)
          : false

        if (normalizedProductIds.length > 0 && selectedProducts.length === 0) {
          return handleCORS(NextResponse.json(
            { error: "Selected products not found" },
            { status: 400 }
          ));
        }

        if (requiresProducts && selectedProducts.length === 0) {
          return handleCORS(NextResponse.json(
            { error: "This template requires product selection. Choose at least one WhatsApp-ready product." },
            { status: 400 }
          ));
        }

        // Send to each recipient
        const results = [];
        for (const recipient of recipientList) {
          try {
            // Validate and format phone number
            const formattedRecipient = recipient.replace(/\D/g, '');

            // Log the recipient number for debugging
            console.log(`Sending catalog to: ${recipient}, formatted: ${formattedRecipient}`);

            // Check if the number seems valid
            if (formattedRecipient.length < 10) {
              results.push({
                recipient: recipient,
                success: false,
                error: "Invalid phone number format. Please include country code."
              });
              continue;
            }

            // Check if we're using a template
            if (templateName) {
              const [existingChat, latestOrder] = await Promise.all([
                getStoredChatByPhone(formattedRecipient),
                getLatestStoredOrderByPhone(formattedRecipient)
              ])

              if (requiresOrderContext && !latestOrder) {
                results.push({
                  recipient,
                  success: false,
                  error: 'This template is mapped to order or purchased-product fields, but no recent order was found for this recipient.'
                })
                continue
              }

              const orderProductContext = buildOrderProductContext(latestOrder)
              const templatePayload = buildCatalogTemplatePayload({
                templateName,
                templateLanguage,
                templateComponents: selectedTemplateComponents,
                templateVariables: selectedTemplateVariables,
                templateHeaderImageUrl,
                productContext: { ...productContext, ...orderProductContext },
                recipientContext: {
                  customer_name: existingChat?.name || latestOrder?.customerName || 'Customer',
                  customer_phone: formattedRecipient,
                  order_number: latestOrder?.orderNumber || '',
                  tracking_number: '',
                  tracking_url: '',
                  order_total: latestOrder?.total ? String(latestOrder.total) : '',
                  currency: latestOrder?.currency || ''
                }
              })

              // Debug log the template payload
              console.log('Template payload:', JSON.stringify(templatePayload, null, 2))

              // Send using the selected template
              const messageData = {
                messaging_product: "whatsapp",
                to: formattedRecipient,
                type: "template",
                template: templatePayload
              };

              const result = await sendWhatsAppMessage(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                formattedRecipient,
                messageData
              );

              // Log the message
              await insertStoredMessage({
                id: uuidv4(),
                userId: 'default',
                recipient: formattedRecipient,
                phone: formattedRecipient,
                message: `Catalog template sent: ${templateName}`,
                isCustomer: false,
                timestamp: new Date(),
                products: selectedProducts,
                template: templateName,
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              });

              results.push({
                recipient: recipient,
                success: true,
                messageId: result.messages?.[0]?.id
              });
            } else {
              // Use the existing text-based approach
              const hasCatalogId = integrations.whatsapp.catalogId;

              // Always use text-based messages to avoid template approval requirements
              // Create a catalog link
              const businessAccountId = integrations.whatsapp.businessAccountId || integrations.whatsapp.phoneNumberId;
              const catalogLink = `https://wa.me/c/${businessAccountId}`;

              // Create a message that includes information about selected products with images
              let productInfo = ''
              if (selectedProducts.length > 0) {
                productInfo = "Selected products:\n"
                selectedProducts.slice(0, 3).forEach((product, index) => {
                  let productEntry = `${index + 1}. *${product.title}* - $${product.price}\n`;
                  if (product.image) {
                    productEntry += `   📷 Image: ${product.image}\n`;
                  }
                  if (product.description) {
                    productEntry += `   📝 ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}\n`;
                  }
                  productInfo += productEntry + "\n";
                });
                if (selectedProducts.length > 3) {
                  productInfo += `...and ${selectedProducts.length - 3} more items\n`;
                }
              }

              const catalogMessage = `🛍️ *Our Product Catalog*

Check out our latest products:
${catalogLink}

${productInfo ? `${productInfo}` : ''}Browse our full collection and find something special just for you!

🛍️ *Shop Now* - Click the link above to browse our catalog with images`;

              const messageData = {
                messaging_product: "whatsapp",
                to: formattedRecipient,
                type: "text",
                text: {
                  body: catalogMessage,
                  preview_url: true
                }
              };

              console.log('Sending message with data:', JSON.stringify(messageData, null, 2));

              const result = await sendWhatsAppMessage(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                formattedRecipient,
                messageData
              );

              console.log('WhatsApp API response:', JSON.stringify(result, null, 2));

              // Log the message
              await insertStoredMessage({
                id: uuidv4(),
                userId: 'default',
                recipient: formattedRecipient,
                phone: formattedRecipient,
                message: catalogMessage,
                isCustomer: false,
                timestamp: new Date(),
                products: selectedProducts,
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              });

              const existingChat = await getStoredChatByPhone(formattedRecipient);
              await upsertStoredChat({
                phone: formattedRecipient,
                name: existingChat?.name || `Customer ${formattedRecipient}`,
                lastMessage: 'Catalog sent',
                timestamp: new Date(),
                unread: existingChat?.unread || 0
              });

              results.push({
                recipient: recipient,
                success: true,
                messageId: result.messages?.[0]?.id
              });
            }
          } catch (error) {
            console.error(`Failed to send catalog message to ${recipient}:`, error);
            results.push({
              recipient: recipient,
              success: false,
              error: error.message || 'Failed to send message'
            });
          }
        }

        // Return results
        const successfulSends = results.filter(r => r.success).length;
        const failedSends = results.filter(r => !r.success).length;

        return handleCORS(NextResponse.json({
          success: successfulSends > 0,
          sentCount: successfulSends,
          failedCount: failedSends,
          results: results
        }));
      } catch (error) {
        console.error('Failed to send catalog:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to send catalog' },
          { status: 500 }
        ));
      }
    }

    // New endpoint to fetch WhatsApp templates
    if (route === '/whatsapp-templates' && method === 'GET') {
      try {
        // Get WhatsApp integration details
        const integrations = await getStoredIntegrations();

        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            {
              error: "WhatsApp not configured properly. Missing phone number ID or access token.",
              guidance: "Please check your WhatsApp integration settings in the dashboard."
            },
            { status: 400 }
          ));
        }

        // Use the business account ID from integration settings
        const businessAccountId = integrations.whatsapp.businessAccountId;

        if (!businessAccountId) {
          return handleCORS(NextResponse.json(
            {
              error: "Business account ID not found in integration settings",
              guidance: "Please ensure your WhatsApp Business Account is properly configured."
            },
            { status: 400 }
          ));
        }

        // Fetch templates from WhatsApp API using the business account ID
        const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;

        const templateResponse = await fetch(url, {
          headers: {
            ...buildMetaAuthHeaders(integrations.whatsapp.accessToken),
            'Content-Type': 'application/json'
          }
        });

        const data = await templateResponse.json();

        if (!templateResponse.ok) {
          console.error('WhatsApp Templates API Error:', data);

          // Provide more detailed error information
          let errorMessage = "Failed to fetch templates from WhatsApp API";
          let guidance = "";

          if (data.error?.code === 100) {
            if (data.error?.message?.includes('message_templates')) {
              errorMessage = "Unable to access message templates";
              guidance = "Your business account may not have the required permissions or the account ID may be incorrect.";
            } else {
              errorMessage = "Invalid request to WhatsApp API";
              guidance = "There may be an issue with your business account configuration.";
            }
          } else if (data.error?.code === 200) {
            errorMessage = "Insufficient permissions";
            guidance = "Your access token may not have the required business_management permissions.";
          }

          // Return an empty array with error details instead of an error to allow the UI to still function
          return handleCORS(NextResponse.json({
            data: [],
            error: errorMessage,
            guidance: guidance,
            apiError: data.error
          }));
        }

        // Filter for approved templates only
        const approvedTemplates = data.data?.filter(template =>
          template.status === 'APPROVED'
        ) || [];

        return handleCORS(NextResponse.json(approvedTemplates));
      } catch (error) {
        console.error('Failed to fetch WhatsApp templates:', error);
        return handleCORS(NextResponse.json(
          {
            error: 'Failed to fetch WhatsApp templates',
            guidance: "Please check your internet connection and WhatsApp integration settings.",
            technicalError: error.message
          },
          { status: 500 }
        ));
      }
    }

    // Webhook endpoint for WhatsApp
    if (route === '/webhook/whatsapp' && method === 'GET') {
      try {
        const verifyToken = request.nextUrl.searchParams.get('hub.verify_token')
        const challenge = request.nextUrl.searchParams.get('hub.challenge')

        // If no verify token provided, return a message indicating endpoint is configured
        if (!verifyToken) {
          return handleCORS(NextResponse.json({
            message: "WhatsApp webhook endpoint is configured. Provide hub.verify_token for verification.",
            status: "ready"
          }))
        }

        const integrations = await getStoredIntegrations()
        const storedToken = integrations?.whatsapp?.webhookVerifyToken
        // Use env token if stored token is empty or is a test value like '123'
        const expectedToken = (storedToken && storedToken.length > 10) ? storedToken : process.env.WHATSAPP_VERIFY_TOKEN

        console.log('WhatsApp webhook verification:', { verifyToken, expectedToken, storedToken, envToken: process.env.WHATSAPP_VERIFY_TOKEN })

        if (verifyToken === expectedToken) {
          return handleCORS(new NextResponse(challenge))
        } else {
          return handleCORS(new NextResponse('Forbidden', { status: 403 }))
        }
      } catch (error) {
        console.error('WhatsApp webhook verification error:', error)
        return handleCORS(new NextResponse('Internal server error', { status: 500 }))
      }
    }

    if (route === '/webhook/whatsapp' && method === 'POST') {
      try {
        const body = await request.json()

        // Log webhook for debugging
        await insertWebhookLog('whatsapp', null, body)

        console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

        // Process incoming WhatsApp messages
        if (body.entry && Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            if (entry.changes && Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                console.log('Processing change:', JSON.stringify(change, null, 2));

                // Handle incoming messages
                if (change.field === 'messages') {
                  const contactsByWaId = new Map(
                    (change.value?.contacts || [])
                      .filter((contact) => contact?.wa_id)
                      .map((contact) => [contact.wa_id, contact])
                  )

                  // Check for actual messages
                  if (change.value?.messages && Array.isArray(change.value.messages)) {
                    console.log('Processing incoming messages');
                    const automationIntegrations = await getStoredIntegrations()
                    for (const message of change.value.messages) {
                      console.log('Saving incoming message:', JSON.stringify(message, null, 2));
                      // Save incoming message to database
                      const contact = contactsByWaId.get(message.from)
                      const savedMessage = await saveIncomingMessage(message)
                      await executeAutomationsForEvent(
                        'whatsapp.message_received',
                        buildIncomingWhatsAppAutomationContext(message, savedMessage, contact),
                        automationIntegrations
                      )
                    }
                  }

                  // Handle message statuses (delivery/read receipts)
                  if (change.value?.statuses && Array.isArray(change.value.statuses)) {
                    console.log('Processing message statuses');
                    for (const status of change.value.statuses) {
                      console.log('Message status update:', JSON.stringify(status, null, 2));
                      // We could save status updates to a separate collection if needed
                      // For now, we'll just log them
                    }
                  }

                  // Handle contacts (new conversations)
                  if (change.value?.contacts && Array.isArray(change.value.contacts)) {
                    console.log('Processing contacts');
                    for (const contact of change.value.contacts) {
                      console.log('New contact:', JSON.stringify(contact, null, 2));
                      // We could save contact information if needed
                    }
                  }
                }
              }
            }
          }
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('WhatsApp webhook processing error:', error)
        // Always return success to WhatsApp even if we have errors
        // This prevents WhatsApp from retrying the webhook
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // Webhook endpoint for Shopify
    // Fixed the route matching to properly handle webhook paths
    if (route === '/webhook/shopify' && method === 'POST') {
      try {
        const body = await request.json()
        const topic = request.headers.get('x-shopify-topic')

        // Log webhook for debugging
        await insertWebhookLog('shopify', topic, body)

        if ((topic === 'customers/create' || topic === 'customers/update') && body?.id) {
          const discoveredPhone = body.phone || body.default_address?.phone || body.addresses?.find((address) => address.phone)?.phone || null
          if (discoveredPhone) {
            await upsertStoredShopifyCustomer(body.id.toString(), discoveredPhone)
            await upsertStoredShopifyCustomer(`guest-${body.id.toString()}`, discoveredPhone)
          }
        }

        // Process different Shopify webhook topics
        if (topic === 'orders/create' && body.id) {
          // Log detailed information about the incoming order
          console.log(`=== NEW ORDER RECEIVED ===`);
          console.log(`Order Number: ${body.order_number}`);
          console.log(`Order ID: ${body.id}`);
          console.log(`Customer ID: ${body.customer?.id}`);
          console.log(`Customer Email: ${body.customer?.email}`);

          // Enhanced order creation logic to handle missing customer data
          // Look for phone number in multiple places
          let customerPhone = null;

          // Log what data we received
          console.log(`Received customer data:`, JSON.stringify(body.customer, null, 2));
          console.log(`Received shipping address:`, JSON.stringify(body.shipping_address, null, 2));
          console.log(`Received billing address:`, JSON.stringify(body.billing_address, null, 2));

          // Check customer object
          if (body.customer && body.customer.phone) {
            customerPhone = body.customer.phone;
            console.log(`Found phone in customer.phone: ${customerPhone}`);
          }
          // Check shipping address
          else if (body.shipping_address && body.shipping_address.phone) {
            customerPhone = body.shipping_address.phone;
            console.log(`Found phone in shipping_address.phone: ${customerPhone}`);
          }
          // Check billing address
          else if (body.billing_address && body.billing_address.phone) {
            customerPhone = body.billing_address.phone;
            console.log(`Found phone in billing_address.phone: ${customerPhone}`);
          }

          // NEW: Additional check for phone numbers in address fields
          // Sometimes Shopify doesn't send phone in dedicated phone field but in address fields
          if (!customerPhone) {
            console.log('Checking for phone numbers in name/address fields...');

            // Check if phone is in shipping address fields
            if (body.shipping_address) {
              // Look for phone in first_name, last_name, or address fields as a fallback
              const shippingFields = [
                body.shipping_address.first_name,
                body.shipping_address.last_name,
                body.shipping_address.address1,
                body.shipping_address.address2
              ];

              console.log('Shipping address fields to check:', shippingFields);

              for (const field of shippingFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in shipping address field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }

            // Check if phone is in billing address fields
            if (!customerPhone && body.billing_address) {
              const billingFields = [
                body.billing_address.first_name,
                body.billing_address.last_name,
                body.billing_address.address1,
                body.billing_address.address2
              ];

              console.log('Billing address fields to check:', billingFields);

              for (const field of billingFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in billing address field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }

            // Check if phone is in customer name fields
            if (!customerPhone && body.customer) {
              const customerFields = [
                body.customer.first_name,
                body.customer.last_name
              ];

              console.log('Customer name fields to check:', customerFields);

              for (const field of customerFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in customer name field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }
          }

          // NEW: If still no phone found, check our customer database for regular customers
          if (!customerPhone && body.customer && body.customer.id) {
            try {
              console.log(`No phone found in webhook data for order ${body.order_number}, checking customer database for regular customer`);
              const customerRecord = await getStoredShopifyCustomer(body.customer.id.toString());

              if (customerRecord && customerRecord.phone) {
                customerPhone = customerRecord.phone;
                console.log(`Found phone in customer database for regular customer: ${customerPhone}`);
              } else {
                console.log('No customer record found in database or no phone in record for regular customer');
              }
            } catch (dbError) {
              console.error('Error checking customer database for regular customer:', dbError.message);
            }
          }

          // NEW: If still no phone found, check our customer database for guest customers
          if (!customerPhone && body.customer && body.customer.id) {
            try {
              console.log(`No phone found for regular customer, checking customer database for guest customer`);
              const guestCustomerRecord = await getStoredShopifyCustomer(`guest-${body.customer.id.toString()}`);

              if (guestCustomerRecord && guestCustomerRecord.phone) {
                customerPhone = guestCustomerRecord.phone;
                console.log(`Found phone in customer database for guest customer: ${customerPhone}`);
              } else {
                console.log('No customer record found in database or no phone in record for guest customer');
              }
            } catch (dbError) {
              console.error('Error checking customer database for guest customer:', dbError.message);
            }
          }

          // NEW: If still no phone found, fetch complete order from Shopify API
          if (!customerPhone) {
            try {
              console.log(`No phone found in webhook data for order ${body.order_number}, fetching complete order from Shopify API`);
              const integrations = await getStoredIntegrations();

              if (integrations?.shopify?.shopDomain && integrations?.shopify?.clientId && integrations?.shopify?.clientSecret) {
                const completeOrder = await fetchCompleteShopifyOrder(
                  integrations.shopify,
                  body.id
                );

                console.log(`Complete order fetched for order ${body.order_number}`);

                // Log what data we received from the complete order
                console.log(`Complete order customer data:`, JSON.stringify(completeOrder.customer, null, 2));
                console.log(`Complete order shipping address:`, JSON.stringify(completeOrder.shipping_address, null, 2));
                console.log(`Complete order billing address:`, JSON.stringify(completeOrder.billing_address, null, 2));

                // Try to find phone in the complete order data
                if (completeOrder.customer && completeOrder.customer.phone) {
                  customerPhone = completeOrder.customer.phone;
                  console.log(`Found phone in complete order customer data: ${customerPhone}`);
                } else if (completeOrder.shipping_address && completeOrder.shipping_address.phone) {
                  customerPhone = completeOrder.shipping_address.phone;
                  console.log(`Found phone in complete order shipping address: ${customerPhone}`);
                } else if (completeOrder.billing_address && completeOrder.billing_address.phone) {
                  customerPhone = completeOrder.billing_address.phone;
                  console.log(`Found phone in complete order billing address: ${customerPhone}`);
                }

                // If still not found, check for phone numbers in name/address fields of complete order
                if (!customerPhone) {
                  console.log('Checking complete order for phone numbers in name/address fields');

                  // Check shipping address fields
                  if (completeOrder.shipping_address) {
                    const shippingFields = [
                      completeOrder.shipping_address.first_name,
                      completeOrder.shipping_address.last_name,
                      completeOrder.shipping_address.address1,
                      completeOrder.shipping_address.address2
                    ];

                    console.log('Shipping address fields to check:', shippingFields);

                    for (const field of shippingFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order shipping address field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }

                  // Check billing address fields
                  if (!customerPhone && completeOrder.billing_address) {
                    const billingFields = [
                      completeOrder.billing_address.first_name,
                      completeOrder.billing_address.last_name,
                      completeOrder.billing_address.address1,
                      completeOrder.billing_address.address2
                    ];

                    console.log('Billing address fields to check:', billingFields);

                    for (const field of billingFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order billing address field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }

                  // Check customer name fields
                  if (!customerPhone && completeOrder.customer) {
                    const customerFields = [
                      completeOrder.customer.first_name,
                      completeOrder.customer.last_name
                    ];

                    console.log('Customer name fields to check:', customerFields);

                    for (const field of customerFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order customer name field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }
                }
              } else {
                console.log('Shopify integration not configured, cannot fetch complete order');
              }
            } catch (fetchError) {
              console.error('Error fetching complete order from Shopify API:', fetchError.message);
            }
          }

          const order = {
            id: uuidv4(),
            userId: 'default',
            shopifyOrderId: body.id.toString(),
            orderNumber: body.order_number || body.name,
            customerName: body.customer ?
              `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() :
              'Unknown Customer',
            customerEmail: body.customer ? body.customer.email : null,
            customerPhone: customerPhone,
            total: body.total_price,
            currency: body.currency,
            status: body.financial_status || 'pending',
            lineItems: body.line_items || [],
            createdAt: new Date(body.created_at),
            updatedAt: new Date(body.created_at),
            whatsappSent: false
          }

          // Save order to database
          await insertStoredOrder(order)

          console.log(`=== ORDER PROCESSING COMPLETE ===`);
          console.log(`Order ${order.orderNumber} saved.`);
          console.log(`Customer phone: ${customerPhone ? customerPhone : 'NOT FOUND'}`);
          console.log(`WhatsApp notification: ${customerPhone ? 'WILL BE SENT' : 'SKIPPED (no phone)'}`);

          // Send WhatsApp confirmation to customer if phone number exists
          if (customerPhone) {
            const integrations = await getStoredIntegrations()

            if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
              try {
                const confirmationMessage = `🎉 *Order Confirmation*\n\n` +
                  `Thank you for your order, ${order.customerName}!\n\n` +
                  `📋 Order #${order.orderNumber}\n` +
                  `💰 Total: ${order.currency} ${order.total}\n` +
                  `📦 Status: Processing\n\n` +
                  `We'll send you updates as your order progresses. Thank you for choosing us! 🙏`

                const messageData = {
                  messaging_product: "whatsapp",
                  to: customerPhone.replace(/\D/g, ''),
                  type: "text",
                  text: {
                    body: confirmationMessage
                  }
                }

                const result = await sendWhatsAppMessage(
                  integrations.whatsapp.phoneNumberId,
                  integrations.whatsapp.accessToken,
                  customerPhone,
                  messageData
                )

                // Update order to mark WhatsApp as sent
                await updateStoredOrderByShopifyOrderId(order.shopifyOrderId, {
                  whatsappSent: true,
                  whatsappMessageId: result.messages?.[0]?.id,
                  whatsappSentAt: new Date(),
                  updatedAt: new Date()
                })

                // Log the message
                await insertStoredMessage({
                  id: uuidv4(),
                  userId: 'default',
                  orderId: order.id,
                  recipient: customerPhone,
                  phone: customerPhone,
                  message: confirmationMessage,
                  isCustomer: false,
                  timestamp: new Date(),
                  whatsappMessageId: result.messages?.[0]?.id,
                  status: 'sent',
                  sentAt: new Date()
                })

                console.log(`WhatsApp confirmation sent for order ${order.orderNumber}`);

              } catch (whatsappError) {
                console.error('Failed to send WhatsApp confirmation:', whatsappError)
                // Don't fail the webhook if WhatsApp fails
              }
            } else {
              console.log('WhatsApp not configured, skipping notification');
            }
          } else {
            console.log(`No phone number found for order ${order.orderNumber}, skipping WhatsApp notification`);
          }

          if (body.customer?.id && customerPhone) {
            await upsertStoredShopifyCustomer(body.customer.id.toString(), customerPhone)
          }

          const automationIntegrations = await getStoredIntegrations()
          await executeAutomationsForEvent('shopify.order_created', {
            customer_name: order.customerName,
            customerPhone: customerPhone,
            order_number: order.orderNumber,
            financial_status: order.status,
            order_total: order.total,
            currency: order.currency,
            review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
            ...buildOrderProductContext(order)
          }, automationIntegrations)
        }
        // Handle order status updates
        else if (topic && topic.startsWith('orders/') && body.id) {
          // Get the order from our database
          const existingOrder = await getStoredOrderByShopifyOrderId(body.id.toString())

          if (existingOrder) {
            // Extract the status from the topic (orders/fulfilled -> fulfilled)
            const newStatus = topic.replace('orders/', '')

            // Update order in database
            await updateStoredOrderByShopifyOrderId(body.id.toString(), {
              status: newStatus,
              updatedAt: new Date()
            })

            // Send WhatsApp notification if customer phone exists and status has changed
            if (existingOrder.customerPhone && existingOrder.status !== newStatus) {
              const integrations = await getStoredIntegrations()

              if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
                try {
                  // Send status update notification
                  const result = await sendOrderStatusUpdate(
                    integrations.whatsapp.phoneNumberId,
                    integrations.whatsapp.accessToken,
                    existingOrder.customerPhone,
                    existingOrder,
                    newStatus
                  )

                  // Log the message
                  await insertStoredMessage({
                    id: uuidv4(),
                    userId: 'default',
                    orderId: existingOrder.id,
                    recipient: existingOrder.customerPhone,
                    phone: existingOrder.customerPhone,
                    message: `Order status update: ${newStatus}`,
                    isCustomer: false,
                    timestamp: new Date(),
                    whatsappMessageId: result.messages?.[0]?.id,
                    status: 'sent',
                    sentAt: new Date()
                  })

                  console.log(`WhatsApp status update sent for order ${existingOrder.orderNumber} (${newStatus})`);

                } catch (whatsappError) {
                  console.error('Failed to send WhatsApp status update:', whatsappError)
                  // Don't fail the webhook if WhatsApp fails
                }
              }

              const trackingNumber = body.fulfillments?.[0]?.tracking_number || body.fulfillments?.[0]?.tracking_numbers?.[0] || ''
              const trackingUrl = body.fulfillments?.[0]?.tracking_url || body.fulfillments?.[0]?.tracking_urls?.[0] || ''
              const automationIntegrations = await getStoredIntegrations()
              if (trackingNumber || topic === 'orders/fulfilled') {
                await executeAutomationsForEvent('shopify.fulfillment_created', {
                  customer_name: existingOrder.customerName,
                  customerPhone: existingOrder.customerPhone,
                  order_number: existingOrder.orderNumber,
                  tracking_number: trackingNumber,
                  tracking_url: trackingUrl,
                  financial_status: newStatus,
                  review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
                  ...buildOrderProductContext(existingOrder)
                }, automationIntegrations)
              }
              if (topic === 'orders/fulfilled') {
                await executeAutomationsForEvent('shopify.order_delivered', {
                  customer_name: existingOrder.customerName,
                  customerPhone: existingOrder.customerPhone,
                  order_number: existingOrder.orderNumber,
                  tracking_number: trackingNumber,
                  tracking_url: trackingUrl,
                  financial_status: newStatus,
                  review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
                  ...buildOrderProductContext(existingOrder)
                }, automationIntegrations)
              }
            }
          }
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('Shopify webhook processing error:', error)
        // Always return success to Shopify even if we have errors
        // This prevents Shopify from retrying the webhook
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // Add a specific handler for debugging the route
    if (route === '/webhook/shopify' && method === 'GET') {
      return handleCORS(NextResponse.json({
        message: "Shopify webhook endpoint is working",
        method: "GET",
        note: "Shopify webhooks use POST method"
      }))
    }

    // New endpoint to send WhatsApp messages from the dashboard
    if (route === '/send-whatsapp-message' && method === 'POST') {
      try {
        const body = await request.json()
        const { to, message } = body

        if (!to || !message) {
          return handleCORS(NextResponse.json(
            { error: "Recipient and message are required" },
            { status: 400 }
          ))
        }

        // Get WhatsApp integration details
        const integrations = await getStoredIntegrations()

        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { error: "WhatsApp not configured" },
            { status: 400 }
          ))
        }

        // Prepare message data
        const messageData = {
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ''), // Remove any non-digit characters
          type: "text",
          text: {
            body: message
          }
        }

        // Send message via WhatsApp API
        const result = await sendWhatsAppMessage(
          integrations.whatsapp.phoneNumberId,
          integrations.whatsapp.accessToken,
          to,
          messageData
        )

        // Save message to database
        const savedMessage = await saveOutgoingMessage(to, message, result)

        // Return the saved message object
        const messageResponse = {
          id: savedMessage.id,
          text: savedMessage.message,
          isCustomer: savedMessage.isCustomer,
          timestamp: savedMessage.timestamp,
          phone: savedMessage.phone
        }

        return handleCORS(NextResponse.json({
          success: true,
          message: messageResponse,
          messageId: result.messages?.[0]?.id
        }))

      } catch (error) {
        console.error('Failed to send WhatsApp message:', error)
        const isRecipientAllowlistError =
          error.message?.includes('Recipient phone number not in allowed list')

        return handleCORS(NextResponse.json(
          {
            error: isRecipientAllowlistError
              ? 'This phone number is not in your WhatsApp test recipient list.'
              : `Failed to send message: ${error.message}`,
            guidance: isRecipientAllowlistError
              ? 'In Meta Developer Dashboard, add this number to the WhatsApp API allowed recipients list, then try again.'
              : undefined
          },
          { status: isRecipientAllowlistError ? 400 : 500 }
        ))
      }
    }

    // New endpoint to get chats for the dashboard
    if (route === '/chats' && method === 'GET') {
      try {
        const chats = await getStoredChats()

        const cleanedChats = chats.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedChats))
      } catch (error) {
        console.error('Failed to fetch chats:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch chats' },
          { status: 500 }
        ))
      }
    }

    // New endpoint to get messages for a specific chat
    if (route.startsWith('/chats/') && route.endsWith('/messages') && method === 'GET') {
      try {
        const phone = route.split('/')[2]; // Extract phone number from route

        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Fetch all messages for this phone number (both incoming from customer and outgoing to customer)
        const messages = await getStoredMessagesByPhone(phone);

        // Transform messages to ensure consistent structure for the frontend
        const transformedMessages = messages.map(msg => {
          // For incoming messages (from customer)
          // If isCustomer is explicitly set to true, or if the phone field matches the chat phone (and it's not an outgoing message)
          if (msg.isCustomer === true || (msg.phone && msg.phone === phone && msg.recipient !== phone)) {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: true,
              timestamp: msg.timestamp || new Date(),
              phone: msg.phone || phone
            };
          }
          // For outgoing messages (to customer)
          // If isCustomer is explicitly set to false, or if the recipient field matches the chat phone (and it's not an incoming message)
          else if (msg.isCustomer === false || (msg.recipient && msg.recipient === phone && msg.phone !== phone)) {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: false,
              timestamp: msg.timestamp || new Date(),
              phone: msg.recipient || phone
            };
          }
          // Fallback - assume outgoing message if we can't determine
          else {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: false,
              timestamp: msg.timestamp || new Date(),
              phone: msg.recipient || msg.phone || phone
            };
          }
        });

        return handleCORS(NextResponse.json(transformedMessages));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch messages' },
          { status: 500 }
        ));
      }
    }

    // New endpoint to create a new chat
    if (route === '/chats' && method === 'POST') {
      try {
        let body;
        try {
          body = await request.json();
        } catch (parseError) {
          console.error('Failed to parse JSON body:', parseError);
          return handleCORS(NextResponse.json(
            { error: "Invalid JSON in request body" },
            { status: 400 }
          ));
        }

        const { phone, name } = body;

        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Format the phone number
        const formattedPhone = phone.replace(/\D/g, '');

        // Check if chat already exists
        const existingChat = await getStoredChatByPhone(formattedPhone);

        if (existingChat) {
          return handleCORS(NextResponse.json(existingChat));
        }

        // Create new chat
        const newChat = await upsertStoredChat({
          phone: formattedPhone,
          name: name || `Customer ${formattedPhone}`,
          lastMessage: 'Chat created',
          timestamp: new Date(),
          unread: 0
        });

        const { _id, ...cleanedChat } = newChat;
        return handleCORS(NextResponse.json(cleanedChat));
      } catch (error) {
        console.error('Failed to create chat:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to create chat' },
          { status: 500 }
        ));
      }
    }

    // Route not found
    console.log(`Route not found: ${route}, method: ${method}`)
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` },
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
