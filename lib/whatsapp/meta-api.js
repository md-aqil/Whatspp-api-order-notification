import { buildMetaAuthHeaders } from '../meta-auth.js'
import { sendWithIdempotency } from '../outbound-idempotency.js'
import { buildOutboundIdempotencyKey } from '../webhook-security.js'
import { buildWhatsAppPayMessage, isWhatsAppPayEnabled } from './pay.js'

/**
 * Sends a raw WhatsApp message payload via Meta Graph API
 *
 * @param {object} args
 * @param {string} args.phoneNumberId
 * @param {string} args.accessToken
 * @param {string} args.to
 * @param {object} args.messageData
 * @param {string} [args.userId] - identifies the tenant
 * @param {string} [args.stepType] - identifies the originating step (e.g. order_confirmation)
 * @param {string} [args.resourceId] - e.g. shopify order id; used in idempotency hash
 */
export async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData, idempotencyOpts = {}) {
  const sanitizedTo = String(to).replace(/\D/g, '')

  // Outbound blocklist: if the phone is on the tenant's blocklist, never send.
  if (!idempotencyOpts.skipBlocklist) {
    try {
      const { isBlocked } = await import('../outbound-blocklist')
      const block = await isBlocked({ userId: idempotencyOpts.userId || 'default', phone: sanitizedTo })
      if (block.blocked) {
        const err = new Error(`blocked:${block.reason || 'manual'}`)
        err.blocked = true
        err.reason = block.reason
        err.source = block.source
        throw err
      }
    } catch (err) {
      if (err.blocked) throw err
      // any other blocklist error → don't block the send
    }
  }

  // Per-tenant + per-recipient throttle. Callers can opt out with
  // idempotencyOpts.skipThrottle === true (used by the replayer / admin).
  if (!idempotencyOpts.skipThrottle) {
    try {
      const { checkOutboundThrottle, recordOutboundSend } = await import('../outbound-throttle')
      const decision = await checkOutboundThrottle({
        userId: idempotencyOpts.userId || 'default',
        phone: sanitizedTo
      })
      if (!decision.allowed) {
        const err = new Error(`throttled:${decision.reason}`)
        err.throttled = true
        err.reason = decision.reason
        err.limit = decision.limit
        throw err
      }
    } catch (err) {
      if (err.throttled) throw err
      // any other throttle error → don't block the send
    }
  }

  const payload = {
    ...messageData,
    messaging_product: 'whatsapp',
    to: sanitizedTo
  }

  const idempotencyKey = buildOutboundIdempotencyKey({
    userId: idempotencyOpts.userId || 'default',
    phoneNumberId,
    recipient: sanitizedTo,
    stepType: idempotencyOpts.stepType || 'whatsapp_send',
    resourceId: idempotencyOpts.resourceId || ''
  })

  const result = await sendWithIdempotency({
    idempotencyKey,
    context: { to: sanitizedTo, type: messageData?.type, stepType: idempotencyOpts.stepType },
    send: async () => {
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...buildMetaAuthHeaders(accessToken),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.error?.message || data.error?.error_user_msg || 'WhatsApp API error'
        console.error('[WhatsApp API Error]:', JSON.stringify(data.error || data))
        throw new Error(errorMsg)
      }

      return data
    }
  })

  if (result.duplicate) {
    console.log(`[WhatsApp API] Idempotent replay for ${sanitizedTo} (wamid=${result.wamid})`)
  }

  if (!idempotencyOpts.skipThrottle) {
    try {
      const { recordOutboundSend } = await import('../outbound-throttle')
      await recordOutboundSend({
        userId: idempotencyOpts.userId || 'default',
        phone: sanitizedTo,
        dedupKey: idempotencyKey
      })
    } catch (err) {
      // best-effort
    }
  }

  return result.result
}

/**
 * Sends an interactive Quick Reply button message via Meta Cloud API
 * 
 * @param {string} phoneNumberId
 * @param {string} accessToken
 * @param {string} to
 * @param {object} options
 * @param {string} options.bodyText - Main body copy (required)
 * @param {Array<{ id: string, title: string }>} options.buttons - Max 3 buttons
 * @param {string} [options.headerText] - Optional header text
 * @param {string} [options.headerImageUrl] - Optional header image URL
 * @param {string} [options.footerText] - Optional footer text
 */
export async function sendWhatsAppInteractiveButtons(phoneNumberId, accessToken, to, {
  bodyText,
  buttons = [],
  headerText = '',
  headerImageUrl = '',
  footerText = ''
}, idempotencyOpts = {}) {
  const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${index}`,
      title: String(btn.title || '').substring(0, 20)
    }
  }))

  const interactive = {
    type: 'button',
    body: {
      text: bodyText
    },
    action: {
      buttons: formattedButtons
    }
  }

  if (headerImageUrl) {
    interactive.header = {
      type: 'image',
      image: { link: headerImageUrl }
    }
  } else if (headerText) {
    interactive.header = {
      type: 'text',
      text: headerText.substring(0, 60)
    }
  }

  if (footerText) {
    interactive.footer = {
      text: footerText.substring(0, 60)
    }
  }

  const messageData = {
    type: 'interactive',
    interactive
  }

  try {
    return await sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData, idempotencyOpts)
  } catch (error) {
    // If interactive fails (e.g. outside 24h window), fall back to text message
    console.warn('[WhatsApp Interactive Failed, falling back to text]:', error.message)
    return await sendWhatsAppMessage(phoneNumberId, accessToken, to, {
      type: 'text',
      text: { body: bodyText }
    }, { ...idempotencyOpts, stepType: (idempotencyOpts.stepType || 'whatsapp') + ':fallback_text' })
  }
}

/**
 * Sends an interactive LIST message (max 10 items across up to 10 sections).
 * Used for opt-in flows, FAQ pickers, product discovery, etc.
 *
 * @param {string} phoneNumberId  Meta phone number id
 * @param {string} accessToken    Decrypted access token
 * @param {string} to             E.164 recipient
 * @param {string} body           Header / leading text shown above the list
 * @param {string} buttonText     CTA button text (≤ 20 chars, e.g. "Choose")
 * @param {Array<{ title: string, rows: Array<{ id: string, title: string, description?: string }> }>} sections
 * @param {string} [footer]       Optional small footer text
 * @param {{ stepType?: string, dedupeKey?: string }} idempotencyOpts
 */
export async function sendWhatsAppInteractiveList(phoneNumberId, accessToken, to, {
  body,
  buttonText = 'Choose',
  sections = [],
  footer
} = {}, idempotencyOpts = {}) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('at least one section with rows is required')
  }
  // Cap per Meta spec: 10 sections, 10 rows per section
  const safeSections = sections.slice(0, 10).map(s => ({
    title: String(s.title || '').slice(0, 24) || undefined,
    rows: (s.rows || []).slice(0, 10).map(r => ({
      id: String(r.id).slice(0, 200),
      title: String(r.title).slice(0, 24),
      description: r.description ? String(r.description).slice(0, 72) : undefined
    }))
  })).filter(s => s.rows.length > 0)

  const interactive = {
    type: 'list',
    body: { text: String(body || '').slice(0, 1024) },
    action: {
      button: String(buttonText).slice(0, 20),
      sections: safeSections
    }
  }
  if (footer) interactive.footer = { text: String(footer).slice(0, 60) }

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, {
    type: 'interactive',
    interactive
  }, { ...idempotencyOpts, stepType: (idempotencyOpts.stepType || 'whatsapp') + ':list' })
}

/**
 * Sends a Meta-Approved WhatsApp Template message (required for 24h compliance)
 */
export async function sendWhatsAppTemplate(phoneNumberId, accessToken, to, templateName, languageCode = 'en_US', components = [], idempotencyOpts = {}) {
  const messageData = {
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: components && components.length > 0 ? components : undefined
    }
  }

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData, idempotencyOpts)
}

/**
 * Sends a high-converting, interactive COD Verification message
 */
export async function sendCODVerificationNotification(phoneNumberId, accessToken, to, order, idempotencyOpts = {}) {
  const customerName = order.customerName || 'Valued Customer'
  const orderNumber = order.orderNumber || order.id
  const total = `${order.currency || 'USD'} ${order.total || '0.00'}`
  const shopifyOrderId = order.shopifyOrderId || order.id

  const bodyText = `👋 Hello *${customerName}*!\n\n` +
    `Thank you for placing Cash on Delivery order *#${orderNumber}* for *${total}*.\n\n` +
    `📦 *Items:* ${order.lineItems?.map(i => `${i.quantity}x ${i.title}`).join(', ') || '1 item'}\n\n` +
    `Please tap below to confirm your order and delivery address so we can dispatch it right away! 🚚`

  const buttons = [
    { id: `cod_confirm:${shopifyOrderId}`, title: '✅ Confirm Order' },
    { id: `cod_cancel:${shopifyOrderId}`, title: '❌ Cancel Order' }
  ]

  return sendWhatsAppInteractiveButtons(phoneNumberId, accessToken, to, {
    headerText: '🛍️ Order Verification',
    bodyText,
    buttons,
    footerText: 'Shopify Store Notification'
  }, { ...idempotencyOpts, resourceId: shopifyOrderId })
}

/**
 * Sends a rich Order Confirmation with Live Tracking & Support Quick Actions
 */
export async function sendOrderConfirmationNotification(phoneNumberId, accessToken, to, order, idempotencyOpts = {}) {
  const customerName = order.customerName || 'Valued Customer'
  const orderNumber = order.orderNumber || order.id
  const total = `${order.currency || 'USD'} ${order.total || '0.00'}`
  const shopifyOrderId = order.shopifyOrderId || order.id

  const bodyText = `🎉 *Order Confirmed!*\n\n` +
    `Thank you for shopping with us, *${customerName}*!\n\n` +
    `📋 *Order:* #${orderNumber}\n` +
    `💰 *Total:* ${total}\n` +
    `📦 *Items:* ${order.lineItems?.map(i => `${i.quantity}x ${i.title}`).join(', ') || 'Your order'}\n\n` +
    `We are preparing your package. We will notify you with live tracking as soon as it ships! 🚀`

  const buttons = [
    { id: `order_status:${shopifyOrderId}`, title: '📦 Track Order' },
    { id: `need_support:${shopifyOrderId}`, title: '💬 Chat Support' }
  ]

  return sendWhatsAppInteractiveButtons(phoneNumberId, accessToken, to, {
    headerText: '✨ Order Received',
    bodyText,
    buttons,
    footerText: 'Thank you for your business!'
  }, { ...idempotencyOpts, resourceId: shopifyOrderId })
}

/**
 * Sends an order status update notification via WhatsApp with interactive quick reply
 */
export async function sendOrderStatusUpdate(phoneNumberId, accessToken, to, order, newStatus, idempotencyOpts = {}) {
  const statusUpper = String(newStatus || 'UPDATED').toUpperCase()
  const statusMessage = `📦 *Order Update*\n\n` +
    `Your order *#${order.orderNumber}* status is now: *${statusUpper}*\n\n` +
    `Thank you for your patience! 🙏`

  const buttons = [
    { id: `order_status:${order.shopifyOrderId || order.id}`, title: '🔍 View Details' },
    { id: `need_support:${order.shopifyOrderId || order.id}`, title: '💬 Need Help' }
  ]

  return sendWhatsAppInteractiveButtons(phoneNumberId, accessToken, to, {
    headerText: `🚚 ${statusUpper}`,
    bodyText: statusMessage,
    buttons,
    footerText: 'Live Order Tracker'
  }, { ...idempotencyOpts, resourceId: `${order.shopifyOrderId || order.id}:${newStatus}` })
}

/**
 * Builds the product context for order-related messages
 */
export function buildOrderProductContext(order) {
  const items = order?.lineItems || order?.line_items || []
  if (!order || !items || items.length === 0) {
    return {
      product_name: '',
      product_price: '',
      product_image: '',
      product_description: '',
      all_products: ''
    }
  }

  const firstItem = items[0]
  const allItems = items.map(item => `${item.quantity || 1}x ${item.title || item.name || 'Product'}`).join(', ')

  return {
    product_name: firstItem.title || firstItem.name || '',
    product_price: `${order.currency || ''} ${firstItem.price || ''}`.trim(),
    product_image: firstItem.image_url || firstItem.image?.src || '',
    product_description: '',
    all_products: allItems
  }
}

/**
 * Sends a WhatsApp Pay interactive payment message (CONDITIONAL).
 * Returns null when WhatsApp Pay is not enabled for this WABA — caller can
 * fall back to a plain checkout link message.
 */
export async function sendWhatsAppPayCheckout(phoneNumberId, accessToken, to, {
  referenceId,
  amount,
  currency,
  description,
  merchantName = 'Store',
  type = 'physical_goods'
}, idempotencyOpts = {}) {
  if (!isWhatsAppPayEnabled({ paymentsEnabled: true })) {
    console.log('[WhatsApp Pay] Skipped: PAYMENTS_ENABLED env is not true.')
    return null
  }

  const messageData = buildWhatsAppPayMessage({
    referenceId,
    type,
    payment: {
      amount: { value: amount, offset: 100 },
      currency,
      description
    },
    merchantName
  })

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData, idempotencyOpts)
}
