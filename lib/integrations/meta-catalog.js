import { buildMetaAuthHeaders } from '../meta-auth'

export async function fetchMetaCatalogProducts(whatsapp) {
  if (!whatsapp?.catalogId || !whatsapp?.accessToken) return []

  let url = `https://graph.facebook.com/v22.0/${whatsapp.catalogId}/products?fields=id,retailer_id,name,description,image_url,url,price`
  const products = []

  while (url) {
    const response = await fetch(url, {
      headers: {
        ...buildMetaAuthHeaders(whatsapp.accessToken),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    })

    const data = await response.json()
    if (!response.ok) {
      const metaMessage = data.error?.message || 'Meta catalog API error'
      throw new Error(metaMessage)
    }

    products.push(...(Array.isArray(data.data) ? data.data : []))
    url = data.paging?.next || ''
  }

  return products.map((product) => ({
    id: String(product.id || '').trim(),
    retailer_id: String(product.retailer_id || '').trim(),
    name: product.name || '',
    description: product.description || '',
    url: product.url || '',
    image_url: product.image_url || '',
    price: typeof product.price === 'object'
      ? `${product.price.amount || ''}`.trim()
      : String(product.price || '').trim()
  }))
}

export async function validateMetaCatalogAccess(whatsapp) {
  if (!whatsapp?.catalogId || !whatsapp?.accessToken) return
  const response = await fetch(`https://graph.facebook.com/v22.0/${whatsapp.catalogId}`, {
    headers: buildMetaAuthHeaders(whatsapp.accessToken)
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error?.message || 'Catalog access validation failed')
  }
}
