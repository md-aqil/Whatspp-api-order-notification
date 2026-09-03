/**
 * International Country Dialing Code Mappings (ISO 3166-1 alpha-2 -> Dialing code)
 */
const COUNTRY_DIALING_CODES = {
  US: '1',
  CA: '1',
  GB: '44',
  UK: '44',
  IN: '91',
  AE: '971',
  SA: '966',
  PK: '92',
  BD: '880',
  AU: '61',
  NZ: '64',
  DE: '49',
  FR: '33',
  IT: '39',
  ES: '34',
  BR: '55',
  MX: '52',
  SG: '65',
  MY: '60',
  ID: '62',
  PH: '63',
  ZA: '27',
  EG: '20',
  NG: '234',
  KE: '254',
  KW: '965',
  QA: '974',
  BH: '973',
  OM: '968'
}

/**
 * Normalizes any phone number into an international E.164 standard string (digits only, e.g. "919876543210" or "15551234567").
 * 
 * @param {string|number} rawPhone - The phone number entered by customer or provided in webhook.
 * @param {string} [countryCode] - Optional 2-letter ISO country code (e.g. 'IN', 'US', 'AE') from shipping/billing address.
 * @returns {string|null} - Cleaned digits suitable for WhatsApp Meta Cloud API, or null if invalid.
 */
export function normalizePhoneNumber(rawPhone, countryCode = '') {
  if (!rawPhone) return null

  let cleaned = String(rawPhone).trim()

  // Remove common prefix like 'tel:', 'whatsapp:', etc.
  cleaned = cleaned.replace(/^(tel:|whatsapp:)/i, '')

  // Remove all non-digit characters except leading plus
  const hasPlus = cleaned.startsWith('+')
  let digits = cleaned.replace(/\D/g, '')

  if (!digits || digits.length < 7) {
    return null
  }

  // Remove leading zeros (e.g., UK 07123456789 -> 7123456789, IN 09876543210 -> 9876543210)
  const iso = String(countryCode || '').trim().toUpperCase()
  const dialingCode = COUNTRY_DIALING_CODES[iso] || ''

  // If user provided a '+' or already has the dialing code prefix
  if (hasPlus) {
    return digits
  }

  // If dialing code is known and digits don't already start with it
  if (dialingCode) {
    // If digits start with leading zero, strip it
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '')
    }

    // If it doesn't already start with the country dialing code, prepend it
    if (!digits.startsWith(dialingCode)) {
      digits = `${dialingCode}${digits}`
    }
    return digits
  }

  // Fallback: If 10 digits and looks like Indian mobile (starts with 6, 7, 8, 9) and no country specified, default to 91 if probable
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    // If country is explicitly US, leave or prepend 1; otherwise if ambiguous in South Asia / India:
    if (iso === 'US' || iso === 'CA') {
      return `1${digits}`
    }
    // Default standard fallback
    return `91${digits}`
  }

  // If 10 digits in North America (starts with 2-9)
  if (digits.length === 10 && (iso === 'US' || iso === 'CA')) {
    return `1${digits}`
  }

  // If it's already a full international number (11-15 digits)
  if (digits.length >= 11 && digits.length <= 15) {
    // If it has leading zero, strip it
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '')
    }
    return digits
  }

  return digits
}

/**
 * Extracts and normalizes customer phone number from a Shopify order or customer payload.
 * 
 * @param {object} order - Shopify order or customer object.
 * @returns {string|null}
 */
export function extractAndNormalizeShopifyPhone(order = {}) {
  const countryCode =
    order.shipping_address?.country_code ||
    order.billing_address?.country_code ||
    order.customer?.default_address?.country_code ||
    ''

  const candidatePhones = [
    order.customer?.phone,
    order.shipping_address?.phone,
    order.billing_address?.phone,
    order.phone,
    order.customer?.default_address?.phone
  ]

  for (const phone of candidatePhones) {
    if (phone) {
      const normalized = normalizePhoneNumber(phone, countryCode)
      if (normalized) return normalized
    }
  }

  // Check address string fields for embedded phone numbers
  const addressFields = [
    order.shipping_address?.first_name,
    order.shipping_address?.last_name,
    order.shipping_address?.address1,
    order.shipping_address?.address2,
    order.billing_address?.first_name,
    order.billing_address?.last_name,
    order.customer?.note
  ]

  for (const field of addressFields) {
    if (field && typeof field === 'string') {
      const phoneMatch = field.match(/(\+?\d{10,15})|(\b0?[6-9]\d{9}\b)/)
      if (phoneMatch) {
        const normalized = normalizePhoneNumber(phoneMatch[0], countryCode)
        if (normalized) return normalized
      }
    }
  }

  return null
}
