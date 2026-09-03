import { buildMetaAuthHeaders } from '../meta-auth.js'

/**
 * Sends a raw WhatsApp message payload via Meta Graph API
 */
export async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
  const sanitizedTo = String(to).replace(/\D/g, '')

  const payload = {
    ...messageData,
    messaging_product: 'whatsapp',
    to: sanitizedTo
  }

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
}) {
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
    return await sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData)
  } catch (error) {
    // If interactive fails (e.g. outside 24h window), fall back to text message
    console.warn('[WhatsApp Interactive Failed, falling back to text]:', error.message)
    return await sendWhatsAppMessage(phoneNumberId, accessToken, to, {
      type: 'text',
      text: { body: bodyText }
    })
  }
}

/**
 * Sends a Meta-Approved WhatsApp Template message (required for 24h compliance)
 */
export async function sendWhatsAppTemplate(phoneNumberId, accessToken, to, templateName, languageCode = 'en_US', components = []) {
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

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData)
}

/**
 * Sends a high-converting, interactive COD Verification message
 */
export async function sendCODVerificationNotification(phoneNumberId, accessToken, to, order) {
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
  })
}

/**
 * Sends a rich Order Confirmation with Live Tracking & Support Quick Actions
 */
export async function sendOrderConfirmationNotification(phoneNumberId, accessToken, to, order) {
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
  })
}

/**
 * Sends an order status update notification via WhatsApp with interactive quick reply
 */
export async function sendOrderStatusUpdate(phoneNumberId, accessToken, to, order, newStatus) {
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
  })
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
