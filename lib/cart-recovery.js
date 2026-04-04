import crypto from 'crypto'
import { query, queryMany, queryOne } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

const DEFAULT_USER_ID = 'default'

async function ensureCartRecoveryReady() {
  await ensureSettingsTables()
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizePhone(value) {
  const raw = normalizeText(value)
  if (!raw) return ''
  if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`
  return raw.replace(/\D/g, '')
}

function normalizeInteger(value, fallback = 0) {
  const parsed = parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function buildLineItems(payload = {}) {
  const source = normalizeArray(
    payload.line_items ||
    payload.lineItems ||
    payload.items ||
    payload.products
  )

  return source.map((item) => normalizeObject(item))
}

function getLineItemName(item = {}) {
  return normalizeText(
    item.title ||
    item.name ||
    item.product_title ||
    item.productName ||
    item.variant_title ||
    item.variantTitle
  )
}

function resolveDiscount(payload = {}) {
  const codes = normalizeArray(payload.discount_codes || payload.discountCodes)
  const firstCode = normalizeObject(codes[0] || {})
  return {
    code: normalizeText(payload.discount_code || payload.discountCode || firstCode.code),
    amount: normalizeText(payload.discount_amount || payload.discountAmount || firstCode.amount || firstCode.value)
  }
}

function resolveCustomerName(payload = {}) {
  const explicitName = normalizeText(payload.customer_name || payload.customerName || payload.name)
  if (explicitName) return explicitName

  const customer = normalizeObject(payload.customer)
  const shipping = normalizeObject(payload.shipping_address || payload.shippingAddress)
  const billing = normalizeObject(payload.billing_address || payload.billingAddress)

  const fullName = normalizeText(`${customer.first_name || ''} ${customer.last_name || ''}`)
  if (fullName) return fullName

  const shippingName = normalizeText(`${shipping.first_name || ''} ${shipping.last_name || ''}`)
  if (shippingName) return shippingName

  const billingName = normalizeText(`${billing.first_name || ''} ${billing.last_name || ''}`)
  return billingName
}

function resolveCustomerPhone(payload = {}) {
  const customer = normalizeObject(payload.customer)
  const shipping = normalizeObject(payload.shipping_address || payload.shippingAddress)
  const billing = normalizeObject(payload.billing_address || payload.billingAddress)
  return normalizePhone(
    payload.customer_phone ||
    payload.customerPhone ||
    payload.phone ||
    customer.phone ||
    shipping.phone ||
    billing.phone
  )
}

function resolveCustomerEmail(payload = {}) {
  const customer = normalizeObject(payload.customer)
  return normalizeText(
    payload.customer_email ||
    payload.customerEmail ||
    payload.email ||
    customer.email
  )
}

function resolveCheckoutUrl(payload = {}) {
  return normalizeText(
    payload.checkout_url ||
    payload.checkoutUrl ||
    payload.abandoned_checkout_url ||
    payload.abandonedCheckoutUrl ||
    payload.cart_url ||
    payload.cartUrl ||
    payload.web_url ||
    payload.url
  )
}

function resolveCartId(payload = {}) {
  return normalizeText(
    payload.cart_id ||
    payload.cartId ||
    payload.external_cart_id ||
    payload.externalCartId ||
    payload.checkout_id ||
    payload.checkoutId ||
    payload.id ||
    payload.token
  )
}

function resolveCheckoutToken(payload = {}) {
  return normalizeText(
    payload.checkout_token ||
    payload.checkoutToken ||
    payload.token
  )
}

function resolveCartItemCount(payload = {}, lineItems = []) {
  const explicit = normalizeInteger(payload.cart_item_count ?? payload.cartItemCount ?? payload.item_count, -1)
  if (explicit >= 0) return explicit

  if (lineItems.length === 0) return 0

  return lineItems.reduce((total, item) => {
    const qty = normalizeInteger(item.quantity, 1)
    return total + Math.max(1, qty)
  }, 0)
}

function toIsoDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function normalizeCartPlatform(value = '') {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized.startsWith('shopify')) return 'shopify'
  if (normalized.startsWith('woocommerce')) return 'woocommerce'
  return normalized || 'custom'
}

function normalizeCartStatusFromEvent(eventType = '') {
  const normalizedEvent = normalizeText(eventType).toLowerCase()
  if (normalizedEvent.endsWith('.cart_abandoned')) return 'abandoned'
  if (normalizedEvent.endsWith('.cart_recovered')) return 'recovered'
  if (normalizedEvent.endsWith('.cart_created')) return 'active'
  if (normalizedEvent.endsWith('.cart_updated')) return 'active'
  return ''
}

function normalizeCartStatus(value = '', eventType = '') {
  const eventStatus = normalizeCartStatusFromEvent(eventType)
  if (eventStatus) return eventStatus

  const normalized = normalizeText(value).toLowerCase()
  if (!normalized) return 'active'
  if (['recovered', 'converted', 'completed'].includes(normalized)) return 'recovered'
  if (['abandoned', 'inactive'].includes(normalized)) return 'abandoned'
  return 'active'
}

export function buildCartRecoveryContext(payload = {}, platformHint = '') {
  const lineItems = buildLineItems(payload)
  const productNames = lineItems
    .map((item) => getLineItemName(item))
    .filter(Boolean)

  const discount = resolveDiscount(payload)
  const platform = normalizeCartPlatform(platformHint || payload.platform || payload.event || payload.event_type)
  const customerPhone = resolveCustomerPhone(payload)
  const checkoutToken = resolveCheckoutToken(payload)
  const cartId = resolveCartId(payload) || checkoutToken

  return {
    platform,
    cart_id: cartId,
    external_cart_id: cartId,
    checkout_token: checkoutToken,
    checkout_url: resolveCheckoutUrl(payload),
    customer_name: resolveCustomerName(payload),
    customer_phone: customerPhone,
    customerPhone,
    customer_email: resolveCustomerEmail(payload),
    cart_total: normalizeText(payload.cart_total || payload.cartTotal || payload.total_price || payload.total || payload.order_total || payload.orderTotal),
    order_total: normalizeText(payload.order_total || payload.orderTotal || payload.total_price || payload.total || payload.cart_total || payload.cartTotal),
    currency: normalizeText(payload.currency || payload.currency_code || payload.currencyCode),
    cart_item_count: resolveCartItemCount(payload, lineItems),
    cart_first_product: productNames[0] || '',
    cart_product_names: productNames.slice(0, 5).join(', '),
    order_product_name: productNames[0] || '',
    order_product_names: productNames.slice(0, 5).join(', '),
    discount_code: discount.code,
    discount_amount: discount.amount,
    recovery_deadline: normalizeText(payload.recovery_deadline || payload.recoveryDeadline || ''),
    store_name: normalizeText(payload.store_name || payload.storeName || payload.shop_name || payload.shopName || payload.site_name || payload.siteName),
    status: normalizeCartStatus(payload.status, payload.event || payload.event_type),
    cart_updated_at: toIsoDate(payload.updated_at || payload.updatedAt || payload.last_activity_at || payload.lastActivityAt || payload.created_at || payload.createdAt),
    line_items: lineItems
  }
}

export function mapCartSessionToContext(session = {}) {
  const lineItems = normalizeArray(session.line_items)
  const productNames = lineItems
    .map((item) => getLineItemName(item))
    .filter(Boolean)
  const customerPhone = normalizePhone(session.customer_phone)

  return {
    platform: normalizeCartPlatform(session.platform),
    cart_session_id: session.id || '',
    cart_id: normalizeText(session.external_cart_id),
    external_cart_id: normalizeText(session.external_cart_id),
    checkout_token: normalizeText(session.checkout_token),
    checkout_url: normalizeText(session.checkout_url),
    customer_name: normalizeText(session.customer_name),
    customer_phone: customerPhone,
    customerPhone,
    customer_email: normalizeText(session.customer_email),
    cart_total: normalizeText(session.cart_total),
    order_total: normalizeText(session.cart_total),
    currency: normalizeText(session.currency),
    cart_item_count: normalizeInteger(session.cart_item_count, 0),
    cart_first_product: productNames[0] || '',
    cart_product_names: productNames.slice(0, 5).join(', '),
    order_product_name: productNames[0] || '',
    order_product_names: productNames.slice(0, 5).join(', '),
    discount_code: normalizeText(session.discount_code),
    discount_amount: normalizeText(session.discount_amount),
    store_name: normalizeText(session.metadata?.store_name),
    status: normalizeText(session.status || 'active'),
    line_items: lineItems
  }
}

export async function upsertCartRecoverySession({
  userId = DEFAULT_USER_ID,
  platform,
  context = {},
  metadata = {},
  status = ''
}) {
  await ensureCartRecoveryReady()

  const normalizedPlatform = normalizeCartPlatform(platform || context.platform)
  const externalCartId = normalizeText(context.external_cart_id || context.cart_id || context.checkout_token)
  if (!externalCartId) return null

  const existing = await queryOne(
    `SELECT id, status, abandoned_at, recovered_at, metadata
     FROM cart_recovery_sessions
     WHERE userId = ? AND platform = ? AND external_cart_id = ?
     LIMIT 1`,
    [userId, normalizedPlatform, externalCartId]
  )

  let nextStatus = normalizeCartStatus(status || context.status || existing?.status, '')
  if (existing?.status === 'recovered' && nextStatus !== 'recovered') nextStatus = 'recovered'
  if (existing?.status === 'abandoned' && nextStatus === 'active') nextStatus = 'abandoned'

  const mergedMetadata = {
    ...(normalizeObject(existing?.metadata)),
    ...(normalizeObject(metadata))
  }

  const sessionId = existing?.id || crypto.randomUUID()

  if (existing) {
    await query(
      `UPDATE cart_recovery_sessions SET
        checkout_token = ?,
        customer_name = ?,
        customer_email = ?,
        customer_phone = ?,
        cart_total = ?,
        currency = ?,
        cart_item_count = ?,
        line_items = ?,
        checkout_url = ?,
        discount_code = ?,
        discount_amount = ?,
        status = ?,
        recovered_order_id = COALESCE(?, recovered_order_id),
        metadata = JSON_MERGE_PATCH(metadata, ?),
        last_activity_at = ?,
        abandoned_at = COALESCE(?, abandoned_at),
        recovered_at = COALESCE(?, recovered_at),
        updatedAt = NOW()
      WHERE id = ?`,
      [
        normalizeText(context.checkout_token),
        normalizeText(context.customer_name),
        normalizeText(context.customer_email),
        normalizePhone(context.customer_phone || context.customerPhone),
        normalizeText(context.cart_total || context.order_total),
        normalizeText(context.currency),
        normalizeInteger(context.cart_item_count, 0),
        JSON.stringify(normalizeArray(context.line_items)),
        normalizeText(context.checkout_url),
        normalizeText(context.discount_code),
        normalizeText(context.discount_amount),
        nextStatus,
        normalizeText(context.recovered_order_id),
        JSON.stringify(mergedMetadata),
        context.cart_updated_at ? new Date(context.cart_updated_at) : new Date(),
        nextStatus === 'abandoned' ? (existing?.abandoned_at || new Date()) : existing?.abandoned_at || null,
        nextStatus === 'recovered' ? (existing?.recovered_at || new Date()) : existing?.recovered_at || null,
        sessionId
      ]
    )
  } else {
    await query(
      `INSERT INTO cart_recovery_sessions (
        id, userId, platform, connection_id, site_id, external_cart_id, checkout_token,
        customer_name, customer_email, customer_phone, cart_total, currency, cart_item_count,
        line_items, checkout_url, discount_code, discount_amount, status, recovered_order_id,
        metadata, last_activity_at, abandoned_at, recovered_at, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        sessionId,
        userId,
        normalizedPlatform,
        normalizeText(context.connection_id || ''),
        normalizeText(context.site_id || ''),
        externalCartId,
        normalizeText(context.checkout_token),
        normalizeText(context.customer_name),
        normalizeText(context.customer_email),
        normalizePhone(context.customer_phone || context.customerPhone),
        normalizeText(context.cart_total || context.order_total),
        normalizeText(context.currency),
        normalizeInteger(context.cart_item_count, 0),
        JSON.stringify(normalizeArray(context.line_items)),
        normalizeText(context.checkout_url),
        normalizeText(context.discount_code),
        normalizeText(context.discount_amount),
        nextStatus,
        normalizeText(context.recovered_order_id),
        JSON.stringify(mergedMetadata),
        context.cart_updated_at ? new Date(context.cart_updated_at) : new Date(),
        nextStatus === 'abandoned' ? new Date() : null,
        nextStatus === 'recovered' ? new Date() : null
      ]
    )
  }

  const session = await queryOne('SELECT * FROM cart_recovery_sessions WHERE id = ?', [sessionId])
  if (session) {
    session.__previous_status = existing?.status || ''
  }
  return session
}

export async function cancelPendingCartRecoveryJobs({
  userId = DEFAULT_USER_ID,
  sessionIds = [],
  externalCartIds = [],
  checkoutTokens = [],
  reason = 'cart_recovered'
}) {
  await ensureCartRecoveryReady()

  const normalizedSessionIds = [...new Set(normalizeArray(sessionIds).map(normalizeText).filter(Boolean))]
  const normalizedExternalIds = [...new Set(normalizeArray(externalCartIds).map(normalizeText).filter(Boolean))]
  const normalizedCheckoutTokens = [...new Set(normalizeArray(checkoutTokens).map(normalizeText).filter(Boolean))]

  if (
    normalizedSessionIds.length === 0 &&
    normalizedExternalIds.length === 0 &&
    normalizedCheckoutTokens.length === 0
  ) {
    return 0
  }

  const [result] = await query(
    `UPDATE automation_jobs
     SET status = 'cancelled',
         processedAt = NOW(),
         payload = JSON_SET(COALESCE(payload, '{}'), '$.cancelled_reason', ?)
     WHERE userId = ?
       AND status = 'pending'
       AND (
         JSON_EXTRACT(payload, '$.cart_session_id') = ?
         OR JSON_EXTRACT(payload, '$.external_cart_id') = ?
         OR JSON_EXTRACT(payload, '$.cart_id') = ?
         OR JSON_EXTRACT(payload, '$.checkout_token') = ?
       )`,
    [
      reason,
      userId,
      normalizedSessionIds.length > 0 ? normalizedSessionIds[0] : null,
      normalizedExternalIds.length > 0 ? normalizedExternalIds[0] : null,
      normalizedExternalIds.length > 0 ? normalizedExternalIds[0] : null,
      normalizedCheckoutTokens.length > 0 ? normalizedCheckoutTokens[0] : null
    ]
  )

  return result?.affectedRows || 0
}

export async function markCartSessionsRecovered({
  userId = DEFAULT_USER_ID,
  platform = '',
  externalCartId = '',
  checkoutToken = '',
  recoveredOrderId = ''
}) {
  await ensureCartRecoveryReady()

  const normalizedPlatform = normalizeCartPlatform(platform)
  const normalizedExternalCartId = normalizeText(externalCartId)
  const normalizedCheckoutToken = normalizeText(checkoutToken)

  if (!normalizedExternalCartId && !normalizedCheckoutToken) return []

  const where = ['userId = ?']
  const values = [userId]

  if (normalizedPlatform && normalizedPlatform !== 'custom') {
    where.push('platform = ?')
    values.push(normalizedPlatform)
  }

  const identifierClauses = []
  if (normalizedExternalCartId) {
    where.push('external_cart_id = ?')
    values.push(normalizedExternalCartId)
  }
  if (normalizedCheckoutToken) {
    where.push('checkout_token = ?')
    values.push(normalizedCheckoutToken)
  }

  if (identifierClauses.length === 0) return []

  where.push(`(${identifierClauses.join(' OR ')})`)
  values.push(normalizeText(recoveredOrderId) || null)

  await query(
    `UPDATE cart_recovery_sessions
     SET status = 'recovered',
         recovered_order_id = COALESCE(?, recovered_order_id),
         recovered_at = COALESCE(recovered_at, NOW()),
         updatedAt = NOW()
     WHERE ${where.join(' AND ')}
       AND status <> 'recovered'`,
    values
  )

  return []
}

export async function findCartSessionsReadyForAbandonment({
  userId = DEFAULT_USER_ID,
  thresholdMinutes = 60,
  limit = 25,
  platform = ''
}) {
  await ensureCartRecoveryReady()

  const normalizedThreshold = Math.min(Math.max(parseInt(String(thresholdMinutes || 60), 10) || 60, 5), 10080)
  const normalizedLimit = Math.min(Math.max(parseInt(String(limit || 25), 10) || 25, 1), 200)
  const normalizedPlatform = normalizeCartPlatform(platform)

  const filters = [
    'userId = ?',
    "status = 'active'",
    'abandoned_at IS NULL',
    'recovered_at IS NULL',
    "COALESCE(TRIM(customer_phone), '') <> ''",
    "COALESCE(TRIM(checkout_url), '') <> ''"
  ]

  const values = [userId, normalizedLimit]

  if (normalizedPlatform && normalizedPlatform !== 'custom') {
    filters.push('platform = ?')
    values.push(normalizedPlatform)
  }

  return queryMany(
    `SELECT *
     FROM cart_recovery_sessions
     WHERE ${filters.join(' AND ')}
       AND COALESCE(last_activity_at, updatedAt, createdAt) <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     ORDER BY COALESCE(last_activity_at, updatedAt, createdAt) ASC
     LIMIT ?`,
    values
  )
}

export async function markCartSessionAbandoned(sessionId) {
  await ensureCartRecoveryReady()

  const normalizedId = normalizeText(sessionId)
  if (!normalizedId) return null

  return queryOne(
    `UPDATE cart_recovery_sessions
     SET status = 'abandoned',
         abandoned_at = COALESCE(abandoned_at, NOW()),
         updatedAt = NOW()
     WHERE id = ?
     RETURNING *`,
    [normalizedId]
  )
}

export async function persistCartRecoveryEvent({
  userId = DEFAULT_USER_ID,
  eventType = '',
  payload = {},
  platformHint = '',
  metadata = {}
}) {
  const context = buildCartRecoveryContext(payload, platformHint || eventType)
  const platform = normalizeCartPlatform(platformHint || eventType)
  const status = normalizeCartStatus(context.status, eventType)

  const session = await upsertCartRecoverySession({
    userId,
    platform,
    context: {
      ...context,
      status
    },
    metadata: {
      ...normalizeObject(metadata),
      last_event: normalizeText(eventType)
    },
    status
  })

  let cancelledJobs = 0
  const transitionedToRecovered = Boolean(
    status === 'recovered' &&
    session &&
    session.__previous_status !== 'recovered'
  )

  if (status === 'recovered' && session) {
    cancelledJobs = await cancelPendingCartRecoveryJobs({
      userId,
      sessionIds: [session.id],
      externalCartIds: [session.external_cart_id],
      checkoutTokens: [session.checkout_token],
      reason: 'cart_recovered'
    })
  }

  return {
    session,
    context: session ? mapCartSessionToContext(session) : context,
    status,
    transitionedToRecovered,
    cancelledJobs
  }
}
