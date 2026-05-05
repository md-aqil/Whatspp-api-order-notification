import { buildMetaAuthHeaders } from '../meta-auth'

export async function sendWhatsAppMessage(to, text, whatsapp) {
  if (!whatsapp?.accessToken || !whatsapp?.phoneNumberId) {
    throw new Error('WhatsApp configuration is missing')
  }

  const response = await fetch(`https://graph.facebook.com/v22.0/${whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(whatsapp.accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text }
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to send WhatsApp message')
  }
  return data
}

export async function sendWhatsAppMedia(to, mediaType, mediaUrl, whatsapp) {
  // ... extracted media sending logic ...
  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: mediaType,
    [mediaType]: { link: mediaUrl }
  }

  const response = await fetch(`https://graph.facebook.com/v22.0/${whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(whatsapp.accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  return response.json()
}
