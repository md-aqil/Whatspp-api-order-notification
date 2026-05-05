import { buildMetaAuthHeaders } from '../meta-auth'

/**
 * Sends a WhatsApp message via Meta Graph API
 */
export async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
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
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'WhatsApp API error')
  }

  return data
}

/**
 * Sends an order status update notification via WhatsApp
 */
export async function sendOrderStatusUpdate(phoneNumberId, accessToken, to, order, newStatus) {
  const statusMessage = `📦 *Order Update*\n\n` +
    `Your order #${order.orderNumber} status has been updated to: *${newStatus.toUpperCase()}*\n\n` +
    `Thank you for your patience! 🙏`

  const messageData = {
    messaging_product: "whatsapp",
    to: to.replace(/\D/g, ''),
    type: "text",
    text: {
      body: statusMessage
    }
  }

  return sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData)
}

/**
 * Builds the product context for order-related messages
 */
export function buildOrderProductContext(order) {
  if (!order || !order.lineItems || order.lineItems.length === 0) {
    return {
      product_name: '',
      product_price: '',
      product_image: '',
      product_description: '',
      all_products: ''
    }
  }

  const firstItem = order.lineItems[0]
  const allItems = order.lineItems.map(item => `${item.quantity}x ${item.title}`).join(', ')

  return {
    product_name: firstItem.title,
    product_price: `${order.currency} ${firstItem.price}`,
    product_image: firstItem.image_url || '',
    product_description: '',
    all_products: allItems
  }
}
