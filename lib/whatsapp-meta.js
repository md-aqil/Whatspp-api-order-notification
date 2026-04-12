import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'

export async function validateWhatsAppPhoneNumberAccess(phoneNumberId, accessToken, businessAccountId = '') {
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
