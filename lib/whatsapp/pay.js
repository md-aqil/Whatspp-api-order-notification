/**
 * WhatsApp Pay helpers.
 *
 * WhatsApp Pay is a Meta-approved country-specific payment rail (India, Brazil, Singapore).
 * Merchants must:
 *   1. Have a Meta-approved Payments merchant account linked to their WABA
 *   2. Have `payments_enabled` set in the WhatsApp Manager
 *   3. Use an approved PAYMENT-type template (or in-session interactive payment message)
 *
 * These helpers are CONDITIONAL: if the WABA does not have payments enabled we
 * return null so callers can gracefully fall back to a checkout link.
 */

/**
 * Returns true if the WABA claims to support WhatsApp Pay for this shop.
 * Detection is best-effort — the env var PAYMENTS_ENABLED is the master switch
 * because Meta does not expose a public payments-availability endpoint per WABA.
 */
export function isWhatsAppPayEnabled(whatsappIntegration) {
  if (process.env.PAYMENTS_ENABLED === 'true') return true
  if (whatsappIntegration?.paymentsEnabled === true) return true
  return false
}

/**
 * Build a payment-type interactive message for WhatsApp Pay.
 *
 * @param {object} args
 * @param {string} args.referenceId - unique id (e.g. cart_session_id)
 * @param {string} args.type - 'digital_goods' | 'physical_goods' | 'service'
 * @param {object} args.payment - { amount: { value: number, offset: number }, currency, description }
 * @param {string} args.merchantName
 * @returns {object} Meta Cloud API message payload
 */
export function buildWhatsAppPayMessage({ referenceId, type = 'physical_goods', payment, merchantName = 'Store' }) {
  return {
    type: 'interactive',
    interactive: {
      type: 'payment',
      header: { type: 'text', text: 'Complete your purchase' },
      body: { text: merchantName },
      action: {
        name: 'review_and_pay',
        payment: {
          reference_id: String(referenceId).substring(0, 60),
          type,
          payment_configuration: merchantName,
          currency: payment?.currency || 'INR',
          amount: {
            value: Math.round((payment?.amount?.value || 0) * 1000),
            offset: payment?.amount?.offset || 100
          },
          ...(payment?.description ? { description: String(payment.description).substring(0, 200) } : {})
        }
      }
    }
  }
}

/**
 * Helper: detect whether a context contains WhatsApp Pay-eligible info.
 * Used by automation steps to decide whether to attach a Pay button.
 */
export function canOfferWhatsAppPay({ whatsappIntegration, context }) {
  if (!isWhatsAppPayEnabled(whatsappIntegration)) return false
  // Currently the supported countries per Meta docs: IN, BR, SG
  const supportedCountries = (process.env.WHATSAPP_PAY_COUNTRIES || 'IN,BR,SG')
    .split(',').map((c) => c.trim().toUpperCase())
  const country = (context?.shipping_country || context?.country || '').toUpperCase()
  if (country && !supportedCountries.includes(country)) return false
  return true
}

/**
 * Build a "Single Product" interactive message (type: 'product') with an
 * optional Pay button when WhatsApp Pay is available.
 *
 * The Single Product format lets merchants showcase one item with a large
 * product card. When `enablePay` is true and the WABA supports pay, we attach
 * a `payment` type action to the card.
 */
export function buildSingleProductMessage({
  productId,
  bodyText,
  footerText = '',
  catalogId,
  enablePay = false,
  referenceId,
  payment
}) {
  const action = {
    catalog_id: catalogId,
    product_retailer_id: String(productId)
  }
  if (enablePay && payment) {
    action.payment = {
      reference_id: String(referenceId || productId).substring(0, 60),
      type: payment.type || 'physical_goods',
      payment_configuration: payment.merchantName || 'Store',
      currency: payment.currency || 'INR',
      amount: {
        value: Math.round((payment.amount?.value || 0) * 1000),
        offset: payment.amount?.offset || 100
      },
      ...(payment.description ? { description: String(payment.description).substring(0, 200) } : {})
    }
  }

  return {
    type: 'interactive',
    interactive: {
      type: 'product',
      body: { text: String(bodyText || '').substring(0, 1024) },
      footer: footerText ? { text: footerText.substring(0, 60) } : undefined,
      action
    }
  }
}