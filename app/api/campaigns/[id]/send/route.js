import { NextResponse } from 'next/server'
import { query, queryMany, queryOne } from '@/lib/postgres'

async function ensureCampaignSchema() {
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateCategory" TEXT')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "templateHeaderImageUrl" TEXT')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "campaignType" TEXT DEFAULT \'template\'')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "productIds" JSONB DEFAULT \'[]\'::jsonb')
  await query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT \'[]\'::jsonb')
}

async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || 'WhatsApp API request failed')
  }

  return data
}

async function getApprovedTemplateDefinition(businessAccountId, accessToken, templateName) {
  const response = await fetch(`https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch WhatsApp template definition')
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
       WHERE "userId" = $1 AND regexp_replace(phone, '\D', '', 'g') = $2
       ORDER BY timestamp DESC NULLS LAST, "createdAt" DESC NULLS LAST
       LIMIT 1`,
      ['default', phone]
    ),
    queryOne(
      `SELECT "customerName", "orderNumber"
       FROM orders
       WHERE "userId" = $1 AND regexp_replace("customerPhone", '\D', '', 'g') = $2
       ORDER BY "createdAt" DESC NULLS LAST
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

  const row = await queryOne(
    'SELECT products FROM products WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
    ['default']
  )

  const products = Array.isArray(row?.products) ? row.products : []
  return products.filter((product) => productIds.includes(product.id))
}

function buildProductContext(products, shopify) {
  const firstProduct = products[0] || null
  const baseDomain = shopify?.shopDomain ? `https://${String(shopify.shopDomain).replace(/^https?:\/\//, '')}` : ''
  const productLink = firstProduct?.handle && baseDomain ? `${baseDomain}/products/${firstProduct.handle}` : ''
  const catalogLink = baseDomain ? `${baseDomain}/collections/all` : ''

  return {
    product_name: firstProduct?.title || '',
    product_price: firstProduct?.price ? `${firstProduct.price}` : '',
    product_link: productLink,
    product_names: products.slice(0, 3).map((product) => product.title).join(', '),
    catalog_link: catalogLink
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

async function getRecipients(campaign) {
  if (campaign.audience === 'custom') {
    return Array.isArray(campaign.recipients) ? campaign.recipients : []
  }

  if (campaign.audience === 'recent_buyers') {
    const rows = await queryMany(
      `SELECT DISTINCT "customerPhone"
       FROM orders
       WHERE "userId" = $1
         AND "customerPhone" IS NOT NULL
         AND "createdAt" >= NOW() - INTERVAL '30 days'`,
      ['default']
    )
    return rows.map((row) => row.customerPhone).filter(Boolean)
  }

  const rows = await queryMany(
    `SELECT DISTINCT phone
     FROM chats
     WHERE "userId" = $1 AND phone IS NOT NULL`,
    ['default']
  )

  return rows.map((row) => row.phone).filter(Boolean)
}

export async function POST(request, { params }) {
  try {
    await ensureCampaignSchema()
    const campaign = await queryOne(
      `SELECT id, name, template, "templateLanguage", "templateCategory", "templateHeaderImageUrl", "campaignType", "productIds", message, variables, audience, recipients, status
       FROM campaigns
       WHERE id = $1 AND "userId" = $2`,
      [params.id, 'default']
    )

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const integrations = await queryOne(
      `SELECT whatsapp, shopify FROM integrations
       WHERE "userId" = $1
       ORDER BY "updatedAt" DESC NULLS LAST, id DESC
       LIMIT 1`,
      ['default']
    )

    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
    }

    const templateDefinition = await getApprovedTemplateDefinition(
      integrations.whatsapp.businessAccountId,
      integrations.whatsapp.accessToken,
      campaign.template
    )
    const bodyComponent = templateDefinition.components?.find((component) => component.type === 'BODY')
    const hasImageHeader = templateDefinition.components?.some((component) => component.type === 'HEADER' && component.format === 'IMAGE')
    const placeholderMatches = bodyComponent?.text?.match(/\{\{\d+\}\}/g) || []
    const selectedProducts = await getSelectedProducts(campaign.productIds)
    const productContext = buildProductContext(selectedProducts, integrations.shopify)

    const recipients = await getRecipients(campaign)
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found for this campaign' }, { status: 400 })
    }

    const results = []
    for (const recipient of recipients) {
      try {
        const recipientContext = await getRecipientContext(recipient)
        const storedVariables = Array.isArray(campaign.variables) ? campaign.variables : []
        const mergedContext = { ...recipientContext, ...productContext }
        const resolvedVariables = storedVariables.map((value) => resolveCampaignVariable(value, mergedContext))

        if (placeholderMatches.length > resolvedVariables.length) {
          throw new Error(`Template "${campaign.template}" expects ${placeholderMatches.length} parameters but only ${resolvedVariables.length} campaign variables were saved`)
        }

        const messageTemplate = {
          name: campaign.template,
          language: {
            code: campaign.templateLanguage || templateDefinition.language || 'en_US'
          }
        }

        if (placeholderMatches.length > 0 || (hasImageHeader && campaign.templateHeaderImageUrl)) {
          messageTemplate.components = []
        }

        if (hasImageHeader && campaign.templateHeaderImageUrl) {
          messageTemplate.components.push({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: campaign.templateHeaderImageUrl
                }
              }
            ]
          })
        }

        if (placeholderMatches.length > 0) {
          messageTemplate.components.push({
            type: 'body',
            parameters: placeholderMatches.map((_match, index) => ({
              type: 'text',
              text: resolvedVariables[index] || ''
            }))
          })
        }

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
          `INSERT INTO messages (id, "userId", "campaignId", recipient, phone, message, "isCustomer", timestamp, "whatsappMessageId", status, template, "sentAt", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW(), NOW())`,
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
       SET status = $2, results = $3::jsonb, "sentAt" = CASE WHEN $2 = 'sent' THEN NOW() ELSE "sentAt" END,
           "failedAt" = CASE WHEN $2 = 'failed' THEN NOW() ELSE "failedAt" END
       WHERE id = $1`,
      [campaign.id, anySuccess ? 'sent' : 'failed', JSON.stringify(results)]
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
