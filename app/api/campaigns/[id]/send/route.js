import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'
import { query, queryMany, queryOne } from '@/lib/postgres'

async function ensureCampaignSchema() {
  try {
    await query('ALTER TABLE campaigns ADD COLUMN templateLanguage TEXT')
    await query('ALTER TABLE campaigns ADD COLUMN templateCategory TEXT')
    await query('ALTER TABLE campaigns ADD COLUMN templateHeaderImageUrl TEXT')
    await query('ALTER TABLE campaigns ADD COLUMN campaignType TEXT DEFAULT "template"')
    await query('ALTER TABLE campaigns ADD COLUMN productIds JSON DEFAULT "[]"')
    await query('ALTER TABLE campaigns ADD COLUMN variables JSON DEFAULT "[]"')
  } catch (e) {
    // Column might already exist
  }
}

async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(mapMetaAccessTokenError(data.error?.message || 'WhatsApp API request failed'))
  }

  return data
}

async function getApprovedTemplateDefinition(businessAccountId, accessToken, templateName) {
  const response = await fetch(`https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`, {
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(mapMetaAccessTokenError(data.error?.message || 'Failed to fetch WhatsApp template definition'))
  }

  const templates = Array.isArray(data.data) ? data.data : []
  const selectedTemplate = templates.find((template) => template.name === templateName && template.status === 'APPROVED')

  if (!selectedTemplate) {
    throw new Error(`Approved template "${templateName}" was not found in Meta`)
  }

  return selectedTemplate
}

async function getRecipientContext(recipient) {
  const phone = recipient.replace(/\D/g, '')
  const [chat, order] = await Promise.all([
    queryOne(
      `SELECT name
       FROM chats
       WHERE userId = ? AND REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', '') = ?
       ORDER BY timestamp DESC, createdAt DESC
       LIMIT 1`,
      ['default', phone]
    ),
    queryOne(
      `SELECT customerName, orderNumber
       FROM orders
       WHERE userId = ? AND REPLACE(REPLACE(REPLACE(customerPhone, '+', ''), '-', ''), ' ', '') = ?
       ORDER BY createdAt DESC
       LIMIT 1`,
      ['default', phone]
    )
  ])

  return {
    customer_name: chat?.name || order?.customerName || 'there',
    customer_phone: recipient,
    order_number: order?.orderNumber || ''
  }
}

async function getSelectedProducts(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return []

  const [rows] = await query(
    'SELECT products FROM products WHERE userId = ? ORDER BY updatedAt DESC, id DESC LIMIT 1',
    ['default']
  )

  const products = Array.isArray(rows[0]?.products) ? rows[0].products : []
  return products.filter((product) => productIds.includes(product.id))
}

function buildProductContext(products, shopify, whatsapp = null) {
  const firstProduct = products[0] || null
  const baseDomain = shopify?.shopDomain ? `https://${String(shopify.shopDomain).replace(/^https?:\/\//, '')}` : ''
  const whatsappCatalogLink = whatsapp?.businessAccountId || whatsapp?.phoneNumberId
    ? `https://wa.me/c/${whatsapp.businessAccountId || whatsapp.phoneNumberId}`
    : ''
  const productLink = firstProduct?.url || firstProduct?.metaCatalogUrl || (firstProduct?.handle && baseDomain ? `${baseDomain}/products/${firstProduct.handle}` : '')
  const catalogLink = baseDomain ? `${baseDomain}/collections/all` : whatsappCatalogLink
  const explicitRetailerIds = products
    .map((product) => String(product?.retailer_id || product?.retailerId || '').trim())
    .filter(Boolean)
  const retailerIds = products
    .map((product) => String(product?.retailer_id || product?.retailerId || product?.id || '').trim())
    .filter(Boolean)

  return {
    product_name: firstProduct?.title || firstProduct?.name || '',
    product_price: firstProduct?.price ? `${firstProduct.price}` : '',
    product_link: productLink,
    product_names: products.slice(0, 3).map((product) => product.title || product.name).filter(Boolean).join(', '),
    catalog_link: catalogLink,
    product_retailer_id: retailerIds[0] || '',
    product_retailer_ids: retailerIds,
    explicit_product_retailer_id: explicitRetailerIds[0] || '',
    explicit_product_retailer_ids: explicitRetailerIds
  }
}

function resolveCampaignVariable(value, context) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''

  const normalized = trimmed.toLowerCase()
  if (normalized === '{{customer_name}}') return context.customer_name || 'there'
  if (normalized === '{{customer_phone}}') return context.customer_phone || ''
  if (normalized === '{{order_number}}') return context.order_number || ''
  if (normalized === '{{product_name}}') return context.product_name || ''
  if (normalized === '{{product_price}}') return context.product_price || ''
  if (normalized === '{{product_link}}') return context.product_link || ''
  if (normalized === '{{product_names}}') return context.product_names || ''
  if (normalized === '{{catalog_link}}') return context.catalog_link || ''

  return trimmed
}

function inferTemplateVariable(exampleText, index = 0) {
  const sample = String(exampleText || '').trim().toLowerCase()

  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('catalog') || sample.includes('collection')) return '{{catalog_link}}'
  if (sample.includes('product') && sample.includes('name')) return '{{product_name}}'
  if (sample.includes('product') && sample.includes('price')) return '{{product_price}}'
  if (sample.includes('product') && (sample.includes('link') || sample.includes('url'))) return '{{product_link}}'
  if (sample.includes('browse') || sample.includes('link') || sample.includes('url')) return '{{product_link}}'

  const fallbacks = ['{{customer_name}}', '{{catalog_link}}', '{{product_name}}', '{{product_link}}', '{{product_price}}']
  return fallbacks[index] || '{{catalog_link}}'
}

function getTemplateExamples(component, groupKey) {
  const examples = component?.example?.[groupKey]
  if (Array.isArray(examples) && Array.isArray(examples[0])) return examples[0]
  return []
}

function getTemplateParameterSlots(templateComponents = []) {
  const slots = []

  for (const component of templateComponents) {
    if (component?.type === 'HEADER' && component.format === 'TEXT') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateExamples(component, 'header_text')
      matches.forEach((_match, index) => {
        slots.push({
          componentType: 'HEADER',
          parameterType: 'text',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateExamples(component, 'body_text')
      matches.forEach((_match, index) => {
        slots.push({
          componentType: 'BODY',
          parameterType: 'text',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button) => {
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((_match, index) => {
          slots.push({
            componentType: 'BUTTON',
            parameterType: 'text',
            buttonType: String(button.type || '').toUpperCase(),
            example: button?.example?.[index] || ''
          })
        })
      })
    }
  }

  return slots
}

function templateHasProductActions(templateComponents = []) {
  return templateComponents.some((component) => (
    component?.type === 'BUTTONS' &&
    Array.isArray(component.buttons) &&
    component.buttons.some((button) => {
      const buttonType = String(button?.type || '').toUpperCase()
      return buttonType === 'MPM' || buttonType === 'CATALOG'
    })
  ))
}

function validatePublicMediaUrl(url, typeLabel) {
  const value = String(url || '').trim()
  if (!value) {
    throw new Error(`Template requires a ${typeLabel} header but no public ${typeLabel} URL was provided.`)
  }

  if (value.startsWith('http://localhost') || value.startsWith('http://0.0.0.0') || value.startsWith('http://127.0.0.1')) {
    throw new Error(`Template ${typeLabel} URL must be publicly accessible. "${value}" points to a local server.`)
  }

  return value
}

function buildCampaignTemplatePayload({ templateDefinition, templateName, templateLanguage, templateVariables = [], templateHeaderImageUrl = '', productContext, recipientContext }) {
  const mergedContext = { ...productContext, ...recipientContext }
  const templateComponents = Array.isArray(templateDefinition?.components) ? templateDefinition.components : []
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferTemplateVariable(slot.example, index)
  ))

  let cursor = 0
  const components = []

  for (const component of templateComponents) {
    if (component?.type === 'HEADER') {
      if (component.format === 'IMAGE') {
        const headerUrl = validatePublicMediaUrl(templateHeaderImageUrl, 'image')
        components.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: headerUrl }
            }
          ]
        })
      } else if (component.format === 'VIDEO') {
        const headerUrl = validatePublicMediaUrl(templateHeaderImageUrl, 'video')
        components.push({
          type: 'header',
          parameters: [
            {
              type: 'video',
              video: { link: headerUrl }
            }
          ]
        })
      } else if (component.format === 'TEXT') {
        const matches = component.text?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'header',
            parameters: matches.map(() => {
              const value = resolveCampaignVariable(resolvedVariableOrder[cursor] || '', mergedContext)
              cursor += 1
              return { type: 'text', text: value }
            })
          })
        }
      }
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      if (matches.length > 0) {
        components.push({
          type: 'body',
          parameters: matches.map(() => {
            const value = resolveCampaignVariable(resolvedVariableOrder[cursor] || '', mergedContext)
            cursor += 1
            return { type: 'text', text: value }
          })
        })
      }
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase()

        if (buttonType === 'MPM') {
          const retailerIds = Array.isArray(productContext.explicit_product_retailer_ids) ? productContext.explicit_product_retailer_ids : []
          if (retailerIds.length === 0) {
            throw new Error('This template requires Meta retailer IDs for the selected products. Sync or map your Meta catalog retailer_id values before sending MPM templates.')
          }

          components.push({
            type: 'button',
            sub_type: 'mpm',
            index: String(buttonIndex),
            parameters: [
              {
                type: 'action',
                action: {
                  thumbnail_product_retailer_id: retailerIds[0],
                  sections: [
                    {
                      title: 'Products',
                      product_items: retailerIds.slice(0, 30).map((productRetailerId) => ({
                        product_retailer_id: productRetailerId
                      }))
                    }
                  ]
                }
              }
            ]
          })
          return
        }

        if (buttonType === 'CATALOG') {
          if (!productContext.explicit_product_retailer_id) {
            throw new Error('This template requires a Meta retailer ID for the selected product. Sync or map the product retailer_id before sending catalog-button templates.')
          }

          components.push({
            type: 'button',
            sub_type: 'catalog',
            index: String(buttonIndex),
            parameters: [
              {
                type: 'action',
                action: {
                  thumbnail_product_retailer_id: productContext.explicit_product_retailer_id
                }
              }
            ]
          })
          return
        }

        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'button',
            sub_type: buttonType.toLowerCase(),
            index: String(buttonIndex),
            parameters: matches.map(() => {
              const value = resolveCampaignVariable(resolvedVariableOrder[cursor] || '', mergedContext)
              cursor += 1
              return { type: 'text', text: value }
            })
          })
        }
      })
    }
  }

  const payload = {
    name: templateName,
    language: {
      code: templateLanguage || templateDefinition?.language || 'en_US'
    }
  }

  if (components.length > 0) {
    payload.components = components
  }

  return payload
}

async function getRecipients(campaign) {
  if (campaign.audience === 'custom') {
    return Array.isArray(campaign.recipients) ? campaign.recipients : []
  }

  if (campaign.audience === 'recent_buyers') {
    const [rows] = await query(
      `SELECT DISTINCT customerPhone
       FROM orders
       WHERE userId = ?
         AND customerPhone IS NOT NULL
         AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      ['default']
    )
    return (rows || []).map((row) => row.customerPhone).filter(Boolean)
  }

  const [rows] = await query(
    `SELECT DISTINCT phone
     FROM chats
     WHERE userId = ? AND phone IS NOT NULL`,
    ['default']
  )

  return (rows || []).map((row) => row.phone).filter(Boolean)
}

export async function POST(request, { params }) {
  try {
    await ensureCampaignSchema()
    const [campaignRows] = await query(
      `SELECT id, name, template, templateLanguage, templateCategory, templateHeaderImageUrl, campaignType, productIds, message, variables, audience, recipients, status
       FROM campaigns
       WHERE id = ? AND userId = ?`,
      [params.id, 'default']
    )

    const campaign = campaignRows[0]

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'sent') {
      return NextResponse.json(
        { error: `Campaign "${campaign.name}" was already sent on this saved record. Create a new campaign to send again.` },
        { status: 409 }
      )
    }

    const [integrationsRows] = await query(
      `SELECT whatsapp, shopify FROM integrations
       WHERE userId = ?
       ORDER BY updatedAt DESC, id DESC
       LIMIT 1`,
      ['default']
    )

    const integrations = integrationsRows[0]

    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
    }

    // Fetch the live template definition from WhatsApp API
    const templateDefinition = await getApprovedTemplateDefinition(
      integrations.whatsapp.businessAccountId,
      integrations.whatsapp.accessToken,
      campaign.template
    )

    const storedVariables = Array.isArray(campaign.variables) ? campaign.variables : []
    const hasProductActions = templateHasProductActions(templateDefinition.components || [])
    const selectedProducts = await getSelectedProducts(campaign.productIds)

    if (hasProductActions && selectedProducts.length === 0) {
      return NextResponse.json(
        { error: `Campaign template "${campaign.template}" includes a catalog product button. Campaigns without selected products cannot send this template. Use a template without MPM/catalog buttons or add campaign product selection support.` },
        { status: 400 }
      )
    }

    const productContext = buildProductContext(selectedProducts, integrations.shopify, integrations.whatsapp)

    const recipients = await getRecipients(campaign)
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found for this campaign' }, { status: 400 })
    }

    const results = []
    for (const recipient of recipients) {
      try {
        const recipientContext = await getRecipientContext(recipient)
        const messageTemplate = buildCampaignTemplatePayload({
          templateDefinition,
          templateName: campaign.template,
          templateLanguage: campaign.templateLanguage,
          templateVariables: storedVariables,
          templateHeaderImageUrl: campaign.templateHeaderImageUrl,
          productContext,
          recipientContext
        })

        const result = await sendWhatsAppMessage(
          integrations.whatsapp.phoneNumberId,
          integrations.whatsapp.accessToken,
          recipient,
          {
            messaging_product: 'whatsapp',
            to: recipient.replace(/\D/g, ''),
            type: 'template',
            template: messageTemplate
          }
        )

        await query(
          `INSERT INTO messages (id, userId, campaignId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, template, sentAt, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW(), NOW())`,
          [
            crypto.randomUUID(),
            'default',
            campaign.id,
            recipient,
            recipient,
            campaign.message || campaign.template,
            false,
            result.messages?.[0]?.id || null,
            'sent',
            campaign.template
          ]
        )

        results.push({ recipient, success: true, messageId: result.messages?.[0]?.id || null })
      } catch (error) {
        results.push({ recipient, success: false, error: error.message })
      }
    }

    const anySuccess = results.some((item) => item.success)

    await query(
      `UPDATE campaigns
       SET status = ?, results = ?, sentAt = CASE WHEN ? = 'sent' THEN NOW() ELSE sentAt END,
           failedAt = CASE WHEN ? = 'failed' THEN NOW() ELSE failedAt END
       WHERE id = ?`,
      [anySuccess ? 'sent' : 'failed', JSON.stringify(results), anySuccess ? 'sent' : 'failed', anySuccess ? 'sent' : 'failed', campaign.id]
    )

    return NextResponse.json({
      success: anySuccess,
      message: anySuccess ? 'Campaign sent successfully using the approved template' : 'Campaign failed',
      results
    })
  } catch (error) {
    console.error('Error sending campaign:', error)
    return NextResponse.json({ error: error.message || 'Failed to send campaign' }, { status: 500 })
  }
}
