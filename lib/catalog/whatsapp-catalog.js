import { fetchShopifyProducts, fetchShopifyProductByHandle, normalizeShopifyDomain } from '../integrations/shopify.js'

/**
 * Normalize a single Shopify product (Admin API shape) into the slim shape
 * WhatsApp expects for interactive product list / carousel sections.
 *
 * Required fields per Meta docs:
 *  - product_id (string in Meta catalog)
 *  - title (max 24 chars in lists, 30 in carousel)
 *  - description (max 72 chars)
 *
 * For images, only the URL is required and must be HTTPS.
 */
export function shapeProductForWhatsApp(product) {
  if (!product) return null
  const image = product.images?.[0]?.src || product.image?.src || ''
  const variant = product.variants?.[0]
  const price = variant?.price || product.price || product.variants?.[0]?.compare_at_price || ''

  return {
    product_id: `shopify_${product.id}`,
    title: String(product.title || '').substring(0, 24),
    description: String(product.body_html || product.description || product.title || '')
      .replace(/<[^>]+>/g, '')
      .substring(0, 72),
    image_url: image,
    price: price ? `${product.currency || ''} ${price}`.trim() : '',
    handle: product.handle,
    shopify_product_id: product.id,
    shopify_variant_id: variant?.id || null,
    currency: product.currency || ''
  }
}

/**
 * Build a WhatsApp Multi-Product interactive message (Meta "product_list").
 * Up to 30 sections, up to 30 products total.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/messages-templates#product-list
 */
export function buildProductListMessage({
  bodyText,
  headerText = '',
  footerText = '',
  sections = []
}) {
  const normalizedSections = sections.map((section) => ({
    title: String(section.title || 'Products').substring(0, 24),
    product_items: (section.product_items || []).slice(0, 30).map((p) => ({
      product_retailer_id: String(p.product_retailer_id || p.product_id).substring(0, 50)
    }))
  }))

  return {
    type: 'interactive',
    interactive: {
      type: 'product_list',
      header: headerText ? { type: 'text', text: headerText.substring(0, 60) } : undefined,
      body: { text: bodyText.substring(0, 1024) },
      footer: footerText ? { text: footerText.substring(0, 60) } : undefined,
      action: {
        catalog_id: undefined, // filled at send time
        sections: normalizedSections
      }
    }
  }
}

/**
 * Build a WhatsApp Single-Product carousel message with up to 10 cards.
 * Cards are simple product cards (no buttons), each with image + body.
 */
export function buildProductCarouselMessage({
  bodyText,
  headerText = '',
  footerText = '',
  cards = []
}) {
  return {
    type: 'interactive',
    interactive: {
      type: 'carousel',
      header: headerText ? { type: 'text', text: headerText.substring(0, 60) } : undefined,
      body: { text: bodyText.substring(0, 1024) },
      footer: footerText ? { text: footerText.substring(0, 60) } : undefined,
      action: {
        cards: cards.slice(0, 10).map((card) => ({
          card_index: card.card_index || 0,
          header: card.image_url
            ? {
                type: 'image',
                image: { link: card.image_url }
              }
            : undefined,
          body: { text: (card.description || card.title || '').substring(0, 200) },
          footer: card.price
            ? { text: card.price.substring(0, 60) }
            : undefined,
          buttons: (card.buttons || []).slice(0, 2).map((btn, idx) => ({
            type: btn.type === 'url' ? 'url' : 'reply',
            text: String(btn.text || btn.title || `Action ${idx + 1}`).substring(0, 20),
            ...(btn.type === 'url'
              ? { url: btn.url }
              : { reply: { id: btn.id || `card_${idx}` } })
          }))
        }))
      }
    }
  }
}

/**
 * Resolve a Meta Commerce catalog ID for a given Shopify shop.
 * Requires `metaCatalogId` in the shopify integration blob.
 */
export function resolveCatalogIdForShop(shopifyIntegration) {
  return (
    shopifyIntegration?.metaCatalogId ||
    shopifyIntegration?.catalogId ||
    shopifyIntegration?.commerceCatalogId ||
    ''
  )
}

/**
 * Helper: fetch products from Shopify and shape them for WhatsApp.
 */
export async function fetchAndShapeProducts(shopifyIntegration, { limit = 30 } = {}) {
  const products = await fetchShopifyProducts({ ...shopifyIntegration, limit })
  return products.map(shapeProductForWhatsApp).filter(Boolean)
}