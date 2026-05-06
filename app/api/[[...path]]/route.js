import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError, sanitizeMetaAccessToken } from '@/lib/meta-auth'
import { buildAutomationTemplateComponents as buildAutomationTemplateComponentsShared } from '@/lib/automation-template'
import { validateWhatsAppPhoneNumberAccess } from '@/lib/whatsapp-meta'
import {
  buildCartRecoveryContext,
  cancelPendingCartRecoveryJobs,
  findCartSessionsReadyForAbandonment,
  mapCartSessionToContext,
  markCartSessionAbandoned,
  markCartSessionsRecovered,
  persistCartRecoveryEvent
} from '@/lib/cart-recovery'
import { getLocalIntegrationRecord, saveLocalIntegrationRecord } from '@/lib/local-settings-store'
import { requireRequestUserId, resolveRequestUserId } from '@/lib/request-user'
import { ensureSettingsTables } from '@/lib/settings-db'
import { generateAIResponse } from '@/lib/ai'
import { getPool, query, queryOne, queryMany, insertWebhookLog } from '@/lib/mysql'
import { 
  getStoredIntegrations, 
  saveStoredIntegration, 
  getStoredWhatsAppAccounts, 
  getWhatsAppAccountById,
  getUserIdByWhatsAppPhoneNumberId
} from '@/lib/db/integration-repository'
import { 
  getAutomationsForUser, 
  getAutomationById, 
  upsertAutomation, 
  ensureAutomationsTable,
  seedDefaultAutomationsForUser
} from '@/lib/db/automation-repository'
import { 
  getStoredChats,
  getStoredMessagesByPhone, 
  getStoredChatByPhone,
  upsertStoredChat,
  insertStoredMessage,
  saveIncomingMessage,
  buildIncomingWhatsAppAutomationContext
} from '@/lib/db/chat-repository'
import { fetchMetaCatalogProducts, validateMetaCatalogAccess } from '@/lib/integrations/meta-catalog'
import { 
  getShopifyAccessToken, 
  normalizeShopifyDomain, 
  extractShopifyHandleFromUrl,
} from '@/lib/integrations/shopify'
import {
  getLatestStoredOrderByPhone,
  getStoredOrders
} from '@/lib/db/order-repository'
import { getStoredProducts, saveStoredProducts } from '@/lib/db/product-repository'
import { enqueueAutomationEvent } from '@/lib/queue'
import { triggerAutomationEvent } from '@/lib/automation-engine'


// Automation State Helpers (To be moved to lib/automation-engine.js if needed)



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

// getStoredChats is now imported from @/lib/db/chat-repository


// getStoredMessagesByPhone is now imported


// getStoredChatByPhone is now imported


// upsertStoredChat is now imported


// insertStoredMessage is now imported


async function saveStoredWebhooks(webhooks) {
  await ensureSettingsTables()

  const pool = getPool()
  const existing = await queryOne(
    'SELECT id FROM webhooks WHERE userId = ? AND type = ? ORDER BY createdAt IS NULL, createdAt DESC, id DESC LIMIT 1',
    ['default', 'shopify']
  )

  if (existing) {
    await pool.execute(
      'UPDATE webhooks SET webhooks = ?, createdAt = NOW() WHERE id = ?',
      [JSON.stringify(webhooks), existing.id]
    )
    return
  }

  await pool.execute(
    'INSERT INTO webhooks (userId, type, webhooks, createdAt) VALUES (?, ?, ?, NOW())',
    ['default', 'shopify', JSON.stringify(webhooks)]
  )
}

async function getStoredWebhooks(type = 'shopify') {
  await ensureSettingsTables()

  const result = await getPool().execute(
    'SELECT id, type, webhooks, createdAt FROM webhooks WHERE userId = ? AND type = ? ORDER BY createdAt IS NULL, createdAt DESC, id DESC LIMIT 1',
    ['default', type]
  )
  return result[0][0] || null
}


async function getWebhookLogs(limit = 10) {
  await ensureSettingsTables()

  const [rows] = await getPool().query(
    `SELECT id, type, topic, payload, receivedAt, createdAt
     FROM webhook_logs
     ORDER BY receivedAt DESC
     LIMIT ${parseInt(limit, 10) || 10}`
  )

  return rows || []
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

function extractShopifyOrderCartIdentifiers(orderPayload = {}) {
  const checkoutToken = String(
    orderPayload.checkout_token ||
    orderPayload.checkoutToken ||
    orderPayload.token ||
    ''
  ).trim()

  const externalCartId = String(
    orderPayload.checkout_id ||
    orderPayload.checkoutId ||
    orderPayload.cart_token ||
    orderPayload.cartToken ||
    orderPayload.token ||
    ''
  ).trim()

  return {
    checkoutToken,
    externalCartId
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
      components.push({
        type: 'body',
        parameters: matches.map(() => {
          const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
          cursor += 1
          return { type: 'text', text: value }
        })
      })
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, bIdx) => {
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: String(bIdx),
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

  return {
    messaging_product: 'whatsapp',
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components
    }
  }
}

/**
 * Enterprise Asynchronous Automation Handler
 * Replaces the legacy 800-line synchronous executeAutomationsForEvent function.
 */
async function triggerAutomationEvent(event, context, integrations, userId = 'default') {
  console.log(`[Queue] Enqueuing automation event: ${event} for user ${userId}`)
  await enqueueAutomationEvent(event, context, integrations, userId)
}


// Legacy executeAutomationsForEvent removed. Using triggerAutomationEvent queue instead.

// Legacy processDueAutomationJobs removed. BullMQ handles delays now.

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
  return handleCORS(new NextResponse('', { status: 200 }))
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
    const metaMessage = mapMetaAccessTokenError(data.error?.message || `WhatsApp API error: ${response.status} ${response.statusText}`)
    const unsupportedPost = /unsupported post request/i.test(metaMessage)
    if (unsupportedPost || data.error?.code === 100) {
      throw new Error('Phone Number ID is invalid, inaccessible for this token, or you pasted a Business Account ID instead of a Phone Number ID.')
    }
    throw new Error(metaMessage)
  }

  // Additional validation that the message was accepted
  if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
    console.error('Unexpected WhatsApp API response:', data);
    throw new Error('WhatsApp API returned unexpected response format')
  }

  return data
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
  const currentUserId = resolveRequestUserId(request)

  // Add debugging for route matching
  console.log(`Processing route: ${route}, method: ${method}, path array:`, path)
  console.log(`Full params:`, params)

  try {
    // WhatsApp webhook verification - MUST BE FAST to avoid Meta timeout
    if (route === '/webhook/whatsapp' && method === 'GET') {
      const verifyToken = request.nextUrl.searchParams.get('hub.verify_token')
      const challenge = request.nextUrl.searchParams.get('hub.challenge')

      if (verifyToken) {
        const envToken = process.env.WHATSAPP_VERIFY_TOKEN
        const fallbackToken = '41ddad7ee4b44d0418876d444b36f4ac817c042c36265b5d'
        
        let isVerified = (verifyToken === envToken) || (verifyToken === fallbackToken)
        
        if (!isVerified) {
          try {
            const defaultIntegrations = await getStoredIntegrations()
            const storedToken = defaultIntegrations?.whatsapp?.webhookVerifyToken
            if (storedToken && verifyToken === storedToken) {
              isVerified = true
            }
          } catch (e) {
            // Ignore DB errors for speed, if tokens match fallback it's fine
          }
        }

        if (isVerified) {
          console.log('WhatsApp webhook verification successful')
          return new NextResponse(challenge, {
            headers: { 'Content-Type': 'text/plain' }
          })
        } else {
          console.warn('WhatsApp webhook verification failed: Token mismatch')
          return new NextResponse('Forbidden', { status: 403 })
        }
      }

      // If no verify token provided, return a message indicating endpoint is configured
      return handleCORS(NextResponse.json({
        message: "WhatsApp webhook endpoint is configured. Provide hub.verify_token for verification.",
        status: "ready"
      }))
    }

    // WhatsApp webhook POST - incoming messages
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
                // Handle incoming messages
                if (change.field === 'messages') {
                  const incomingPhoneNumberId = change.value?.metadata?.phone_number_id || ''
                  const incomingUserId = await getUserIdByWhatsAppPhoneNumberId(incomingPhoneNumberId)
                  
                  const contactsByWaId = new Map(
                    (change.value?.contacts || [])
                      .filter((contact) => contact?.wa_id)
                      .map((contact) => [contact.wa_id, contact])
                  )

                  if (change.value?.messages && Array.isArray(change.value.messages)) {
                    const integrations = await getStoredIntegrations(incomingUserId)
                    
                    for (const message of change.value.messages) {
                      // Save incoming message to database
                      const contact = contactsByWaId.get(message.from)
                      const savedMessage = await saveIncomingMessage(message, incomingUserId)
                      
                      const context = buildIncomingWhatsAppAutomationContext(message, savedMessage, contact)
                      
                      // Trigger automation asynchronously via Queue
                      await triggerAutomationEvent(
                        'whatsapp.message_received',
                        context,
                        integrations,
                        incomingUserId
                      )
                    }
                  }
                }
              }
            }
          }
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('WhatsApp Webhook POST error:', error)
        return handleCORS(NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 }))
      }
    }

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "WhatsApp Commerce Hub API" }))
    }

    // Integrations endpoints
    if (route === '/integrations' && method === 'GET') {
      let integrations = null

      try {
        integrations = await getStoredIntegrations(currentUserId)
      } catch (error) {
        console.error('Failed to load stored integrations:', error)
      }

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
        // getStoredIntegrations now returns parsed objects
        console.log('[GET /integrations] Integrations:', JSON.stringify(integrations))

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
        }

        if (type === 'whatsapp' && data.catalogId) {
          try {
            await validateMetaCatalogAccess({
              catalogId: data.catalogId,
              accessToken: data.accessToken,
              businessAccountId: data.businessAccountId,
              phoneNumberId: data.phoneNumberId
            })
          } catch (error) {
            warning = `Catalog validation failed: ${error.message}. Catalog ID has been saved but may not work until the access token is refreshed.`
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
        // Force use of environment token to prevent mismatch with Meta configuration
        data.webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || ''

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
      try {
        await saveStoredIntegration(type, data, currentUserId)
      } catch (saveError) {
        console.error('Failed to save integration:', saveError)
        return handleCORS(NextResponse.json(
          { error: `Failed to save integration: ${saveError.message}` },
          { status: saveError.status || 500 }
        ))
      }

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
          { topic: 'checkouts/create', address: webhookUrl },
          { topic: 'checkouts/update', address: webhookUrl },
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
          { status: error.status || 500 }
        ))
      }
    }

    // Webhooks endpoint - get registered webhooks
    if (route === '/webhooks' && method === 'GET') {
      const webhookUrl = new URL(request.url)
      const type = webhookUrl.searchParams.get('type') || 'shopify'
      let webhooks = null

      try {
        webhooks = await getStoredWebhooks(type)
      } catch (error) {
        console.error(`Failed to load stored ${type} webhooks:`, error)
      }

      return handleCORS(NextResponse.json({
        type,
        webhooks: webhooks?.webhooks || [],
        createdAt: webhooks?.createdAt || null
      }))
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
          { status: error.status || 500 }
        ))
      }
    }

    if (route === '/cart-recovery/capture' && method === 'POST') {
      try {
        const body = await request.json()
        const eventType = typeof body.event === 'string'
          ? body.event
          : (typeof body.event_type === 'string' ? body.event_type : '')

        if (!eventType || !eventType.includes('.cart_')) {
          return handleCORS(NextResponse.json(
            { error: 'event or event_type is required and must look like shopify.cart_updated' },
            { status: 400 }
          ))
        }

        const persistedCart = await persistCartRecoveryEvent({
          userId: 'default',
          eventType,
          payload: body,
          platformHint: body.platform || eventType,
          metadata: {
            source: 'cart-recovery-capture-api'
          }
        })

        const context = {
          ...buildCartRecoveryContext(body, body.platform || eventType),
          ...(persistedCart?.context || {})
        }

        if (persistedCart?.session?.id) {
          context.cart_session_id = persistedCart.session.id
        }

        const shouldTriggerAutomation = (
          body.triggerAutomation !== false &&
          (eventType !== 'shopify.cart_recovered' && eventType !== 'woocommerce.cart_recovered'
            ? true
            : Boolean(persistedCart?.transitionedToRecovered))
        )

        if (shouldTriggerAutomation) {
          const integrations = await getStoredIntegrations()
          await triggerAutomationEvent(eventType, context, integrations)
        }

        return handleCORS(NextResponse.json({
          success: true,
          event: eventType,
          session: persistedCart?.session || null,
          cancelledJobs: persistedCart?.cancelledJobs || 0,
          context
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to capture cart recovery event: ${error.message}` },
          { status: error.status || 500 }
        ))
      }
    }

    if (route === '/cart-recovery/process' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}))
        const thresholdMinutes = parseInt(String(body.thresholdMinutes || 60), 10) || 60
        const limit = parseInt(String(body.limit || 25), 10) || 25
        const dryRun = Boolean(body.dryRun)
        const platform = typeof body.platform === 'string' ? body.platform : ''

        const sessions = await findCartSessionsReadyForAbandonment({
          userId: 'default',
          thresholdMinutes,
          limit,
          platform
        })

        if (dryRun) {
          return handleCORS(NextResponse.json({
            success: true,
            dryRun: true,
            thresholdMinutes,
            limit,
            ready: sessions.length,
            sessions: sessions.map((session) => ({
              id: session.id,
              platform: session.platform,
              external_cart_id: session.external_cart_id,
              customer_phone: session.customer_phone,
              last_activity_at: session.last_activity_at
            }))
          }))
        }

        if (sessions.length === 0) {
          return handleCORS(NextResponse.json({
            success: true,
            processed: 0,
            failed: 0,
            message: 'No cart sessions are ready for abandonment processing.'
          }))
        }

        const integrations = await getStoredIntegrations()
        let processed = 0
        let failed = 0
        const errors = []

        for (const session of sessions) {
          try {
            const abandonedSession = await markCartSessionAbandoned(session.id)
            const activeSession = abandonedSession || session
            const eventPlatform = String(activeSession.platform || '').toLowerCase()

            if (eventPlatform !== 'shopify' && eventPlatform !== 'woocommerce') {
              continue
            }

            const context = {
              ...mapCartSessionToContext(activeSession),
              cart_session_id: activeSession.id,
              status: 'abandoned'
            }

            await triggerAutomationEvent(
              `${eventPlatform}.cart_abandoned`,
              context,
              integrations
            )

            processed += 1
          } catch (error) {
            failed += 1
            errors.push({
              sessionId: session.id,
              error: error.message
            })
          }
        }

        return handleCORS(NextResponse.json({
          success: true,
          processed,
          failed,
          errors
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to process cart recovery sessions: ${error.message}` },
          { status: error.status || 500 }
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
          { status: error.status || 500 }
        ));
      }
    }

    // Get automation logs/state
    if (route === '/automations/logs' && method === 'GET') {
      try {
        const automationId = request.nextUrl.searchParams.get('automationId')
        if (!automationId) {
          return handleCORS(NextResponse.json({ error: 'automationId is required' }, { status: 400 }))
        }

        const states = await queryMany(
          `SELECT id, recipient, state, payload, updatedAt
           FROM automation_conversation_state
           WHERE userId = ? AND automationId = ?
           ORDER BY updatedAt DESC
           LIMIT 10`,
          [currentUserId, automationId]
        )

        return handleCORS(NextResponse.json(states || []))
      } catch (error) {
        console.error('Failed to fetch automation logs:', error)
        return handleCORS(NextResponse.json({ error: 'Failed to fetch automation logs' }, { status: error.status || 500 }))
      }
    }

    // Automations PUT handler - delegate to separate route file or handle here
    if (route === '/automations' && method === 'PUT') {
      try {
        await ensureAutomationsTable()
        const body = await request.json()
        const automations = Array.isArray(body) ? body : body.automations

        if (!Array.isArray(automations)) {
          return handleCORS(NextResponse.json({ error: 'Automations array is required' }, { status: 400 }))
        }

        const connection = await getPool().getConnection()

        try {
          await connection.beginTransaction()

          const automationIds = []

          for (const automation of automations) {
            const automationId = automation.id || `auto-${Date.now()}`
            const steps = typeof automation.steps === 'string' ? JSON.parse(automation.steps) : automation.steps
            const metrics = typeof automation.metrics === 'string' ? JSON.parse(automation.metrics) : (automation.metrics || { sent: 0, openRate: 0, conversions: 0 })

            automationIds.push(automationId)

            await connection.execute(
              `INSERT INTO automations (id, userId, name, status, source, summary, steps, metrics, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), source = VALUES(source),
               summary = VALUES(summary), steps = VALUES(steps), metrics = VALUES(metrics), updatedAt = NOW()`,
              [
                automationId,
                currentUserId,
                automation.name || 'Unnamed',
                automation.status !== undefined ? (automation.status ? 1 : 0) : 0,
                automation.source || 'Custom',
                automation.summary || '',
                JSON.stringify(steps || []),
                JSON.stringify(metrics)
              ]
            )
          }

          if (automationIds.length > 0) {
            const placeholders = automationIds.map(() => '?').join(', ')
            await connection.execute(
              `DELETE FROM automations
               WHERE userId = ?
               AND id NOT IN (${placeholders})`,
              [currentUserId, ...automationIds]
            )
          } else {
            await connection.execute('DELETE FROM automations WHERE userId = ?', [currentUserId])
          }

          await connection.commit()
        } catch (error) {
          await connection.rollback()
          throw error
        } finally {
          connection.release()
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('Error saving automations:', error)
        return handleCORS(NextResponse.json({ error: 'Failed to save automations', details: error.message }, { status: error.status || 500 }))
      }
    }

    // Automations GET handler
    if (route === '/automations' && method === 'GET') {
      try {
        await ensureAutomationsTable()
        await seedDefaultAutomationsForUser(currentUserId)

        let [rows] = await query(
          `SELECT id, name, status, source, summary, steps, metrics, createdAt, updatedAt
           FROM automations
           WHERE userId = ?
           ORDER BY updatedAt DESC, createdAt DESC`,
          [currentUserId]
        )

        // Parse JSON columns
        const parsedRows = (rows || []).map(row => ({
          ...row,
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
          metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics
        }))
        console.log('Returning automations:', parsedRows.map(a => ({ id: a.id, stepsCount: a.steps?.length })))

        return handleCORS(NextResponse.json(parsedRows || []))
      } catch (error) {
        console.error('Error fetching automations:', error)
        return handleCORS(NextResponse.json(
          { error: error.status === 401 ? 'Not authenticated' : 'Failed to fetch automations' }, 
          { status: error.status || 500 }
        ))
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
          { status: error.status || 500 }
        ));
      }
    }

    // New endpoint to send WhatsApp messages from the dashboard
    if (route === '/send-whatsapp-message' && method === 'POST') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
        const body = await request.json()
        const { to, message, accountId } = body

        if (!to || !message) {
          return handleCORS(NextResponse.json(
            { error: "Recipient and message are required" },
            { status: 400 }
          ))
        }

        let phoneNumberId, accessToken, businessAccountId

        // Get WhatsApp account - use accountId if provided, otherwise fallback to legacy integration
        if (accountId) {
          const waAccount = await getWhatsAppAccountById(accountId, authenticatedUserId)
          if (!waAccount) {
            return handleCORS(NextResponse.json(
              { error: "WhatsApp account not found" },
              { status: 404 }
            ))
          }
          phoneNumberId = waAccount.phoneNumberId
          accessToken = waAccount.accessToken
          businessAccountId = waAccount.businessAccountId || ''
        } else {
          // Legacy: Get from single integration
          const integrations = await getStoredIntegrations(authenticatedUserId)
          const waIntegration = typeof integrations?.whatsapp === 'string' 
            ? JSON.parse(integrations.whatsapp) 
            : integrations?.whatsapp

          if (!waIntegration?.phoneNumberId || !waIntegration?.accessToken) {
            return handleCORS(NextResponse.json(
              { error: "WhatsApp not configured. Please add a WhatsApp account first." },
              { status: 400 }
            ))
          }
          phoneNumberId = waIntegration.phoneNumberId
          accessToken = waIntegration.accessToken
          businessAccountId = waIntegration.businessAccountId || ''
        }

        await validateWhatsAppPhoneNumberAccess(phoneNumberId, accessToken, businessAccountId)

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
          phoneNumberId,
          accessToken,
          to,
          messageData
        )

        // Save message to database
        const savedMessage = await saveOutgoingMessage(to, message, result, authenticatedUserId)

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
        const authenticatedUserId = requireRequestUserId(request)
        const chats = await getStoredChats(authenticatedUserId)
        console.log('[GET /chats] user:', authenticatedUserId, 'chatCount:', chats.length)

        const cleanedChats = chats.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedChats))
      } catch (error) {
        console.error('Failed to fetch chats:', error)
        return handleCORS(NextResponse.json(
          { error: error.status === 401 ? 'Not authenticated' : 'Failed to fetch chats' },
          { status: error.status || 500 }
        ))
      }
    }

    // New endpoint to get messages for a specific chat
    if (route.startsWith('/chats/') && route.endsWith('/messages') && method === 'GET') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
        const phone = route.split('/')[2]; // Extract phone number from route

        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Fetch all messages for this phone number (both incoming from customer and outgoing to customer)
        const messages = await getStoredMessagesByPhone(phone, authenticatedUserId);
        console.log('[GET /chats/:phone/messages] user:', authenticatedUserId, 'phone:', phone, 'messageCount:', messages.length)
        if (messages[0]) {
          console.log('[GET /chats/:phone/messages] newest message snapshot:', JSON.stringify(messages[messages.length - 1]))
        }

        // Transform messages to ensure consistent structure for the frontend
        const transformedMessages = messages.map(msg => {
          // Robustly determine if this is a customer message
          const isCustomer = Boolean(msg.isCustomer === true || msg.isCustomer === 1 || msg.isCustomer === '1' || msg.isCustomer === 'true');
          
          if (isCustomer) {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: true,
              timestamp: msg.timestamp || new Date(),
              phone: msg.phone || phone
            };
          } else {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: false,
              timestamp: msg.timestamp || new Date(),
              phone: msg.recipient || phone
            };
          }
        });

        console.log('[GET /chats/:phone/messages] transformedCount:', transformedMessages.length)
        return handleCORS(NextResponse.json(transformedMessages));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch messages' },
          { status: error.status || 500 }
        ));
      }
    }

    // New endpoint to create a new chat
    if (route === '/chats' && method === 'POST') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
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
        const existingChat = await getStoredChatByPhone(formattedPhone, authenticatedUserId);

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
        }, authenticatedUserId);

        const { _id, ...cleanedChat } = newChat;
        return handleCORS(NextResponse.json(cleanedChat));
      } catch (error) {
        console.error('Failed to create chat:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to create chat' },
          { status: error.status || 500 }
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
    const status = error.status || 500
    const message = status === 500 ? "Internal server error" : error.message
    return handleCORS(NextResponse.json(
      { error: message },
      { status }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
