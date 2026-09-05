import crypto from 'crypto'

/**
 * Verify a Shopify webhook HMAC signature.
 * Shopify sends `x-shopify-hmac-sha256` (base64) computed with HMAC-SHA256
 * over the RAW request body using the webhook's shared secret.
 *
 * Returns true when the signature is valid OR when no secret is configured
 * (dev environments where signature verification would block all events).
 */
export function verifyShopifyWebhookHmac(rawBody, hmacHeader, webhookSecret) {
  if (!webhookSecret) {
    // No secret configured: accept (lets merchants opt in later without breaking flow).
    return { valid: true, skipped: true }
  }

  if (!hmacHeader || !rawBody) {
    return { valid: false, reason: 'missing_signature_or_body' }
  }

  try {
    const computed = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('base64')

    const a = Buffer.from(computed, 'utf8')
    const b = Buffer.from(String(hmacHeader), 'utf8')
    if (a.length !== b.length) {
      return { valid: false, reason: 'length_mismatch' }
    }
    const valid = crypto.timingSafeEqual(a, b)
    return { valid, reason: valid ? null : 'mismatch' }
  } catch (err) {
    return { valid: false, reason: 'verify_error', error: err.message }
  }
}

/**
 * Build a deterministic idempotency key from event identity.
 * Format: `${userId}:${platform}:${topic}:${resourceId}:${status}`
 */
export function buildIdempotencyKey({ userId = 'default', platform, topic, resourceId, status = '' }) {
  const parts = [userId, platform, topic || '', resourceId || '', status || '']
  const raw = parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48)
}

/**
 * Build an idempotency key for outbound WhatsApp sends so we never
 * double-send the same message after a retry or duplicate trigger.
 */
export function buildOutboundIdempotencyKey({ userId, phoneNumberId, recipient, stepType, resourceId }) {
  const raw = [userId, phoneNumberId, recipient, stepType, resourceId].map((p) => String(p || '')).join('::')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48)
}