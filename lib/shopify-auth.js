import crypto from 'crypto';

/**
 * Verifies the Shopify webhook signature (HMAC)
 * @param {string} payload Raw request body
 * @param {string} signature X-Shopify-Hmac-Sha256 header
 * @param {string} webhookSecret Shopify App Webhook Secret
 * @returns {boolean}
 */
export function verifyShopifySignature(payload, signature, webhookSecret) {
  if (!signature || !webhookSecret) return false;

  try {
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('base64');

    // Use timingSafeEqual to prevent timing attacks
    // Shopify uses base64 for HMAC
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    );
  } catch (error) {
    console.error('Shopify signature verification failed:', error.message);
    return false;
  }
}
