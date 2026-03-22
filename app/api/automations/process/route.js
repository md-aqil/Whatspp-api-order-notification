import { NextResponse } from 'next/server'
import { query, queryMany, queryOne } from '@/lib/postgres'

function interpolateTemplateText(template, context) {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function resolveAutomationVariable(value, context) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''

  const directMap = {
    '{{customer_name}}': context.customer_name || '',
    '{{customer_phone}}': context.customer_phone || context.customerPhone || '',
    '{{customer_message}}': context.customer_message || '',
    '{{order_number}}': context.order_number || '',
    '{{tracking_number}}': context.tracking_number || '',
    '{{tracking_url}}': context.tracking_url || '',
    '{{review_link}}': context.review_link || '',
    '{{order_total}}': context.order_total || '',
    '{{currency}}': context.currency || '',
    '{{financial_status}}': context.financial_status || '',
    '{{shopify.customer.first_name}}': context.customer_name || '',
    '{{shopify.total_price}}': context.order_total || ''
  }

  const normalized = trimmed.toLowerCase()
  const normalizedMap = Object.fromEntries(Object.entries(directMap).map(([key, val]) => [key.toLowerCase(), val]))
  if (normalizedMap[normalized] !== undefined) {
    return normalizedMap[normalized]
  }

  return interpolateTemplateText(trimmed, context)
}

function buildAutomationTemplateComponents(templateComponents, variableMappings, context) {
  const bodyComponent = Array.isArray(templateComponents)
    ? templateComponents.find((component) => component.type === 'BODY')
    : null

  const placeholders = bodyComponent?.text?.match(/\{\{\d+\}\}/g) || []
  if (placeholders.length === 0) return undefined

  return [
    {
      type: 'body',
      parameters: placeholders.map((_, index) => ({
        type: 'text',
        text: String(resolveAutomationVariable(variableMappings?.[index]?.value || '', context) || '')
      }))
    }
  ]
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

export async function POST() {
  try {
    const integrations = await queryOne(
      'SELECT whatsapp FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
      ['default']
    )

    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
    }

    const jobs = await queryMany(
      `SELECT id, "automationId", recipient, message, template, payload
       FROM automation_jobs
       WHERE status = 'pending' AND "runAt" <= NOW()
       ORDER BY "runAt" ASC
       LIMIT 25`
    )

    let processed = 0

    for (const job of jobs) {
      try {
        const templateComponents = buildAutomationTemplateComponents(job.payload?.templateComponents, job.payload?.variableMappings, job.payload || {})
        const messageData = job.template
          ? {
              messaging_product: 'whatsapp',
              to: job.recipient.replace(/\D/g, ''),
              type: 'template',
              template: {
                name: job.template,
                language: {
                  code: job.payload?.templateLanguage || 'en_US'
                },
                ...(templateComponents ? { components: templateComponents } : {})
              }
            }
          : {
              messaging_product: 'whatsapp',
              to: job.recipient.replace(/\D/g, ''),
              type: 'text',
              text: {
                body: job.message
              }
            }

        const result = await sendWhatsAppMessage(
          integrations.whatsapp.phoneNumberId,
          integrations.whatsapp.accessToken,
          job.recipient,
          messageData
        )

        await query(
          `INSERT INTO messages (id, "userId", recipient, phone, message, "isCustomer", timestamp, "whatsappMessageId", status, template, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, NOW())`,
          [
            crypto.randomUUID(),
            'default',
            job.recipient,
            job.recipient,
            job.message,
            false,
            result.messages?.[0]?.id || null,
            'sent',
            job.template || null
          ]
        )

        await query(
          `UPDATE automation_jobs
           SET status = 'sent', "processedAt" = NOW()
           WHERE id = $1`,
          [job.id]
        )

        await query(
          `UPDATE automations
           SET metrics = jsonb_set(COALESCE(metrics, '{}'::jsonb), '{sent}', to_jsonb(COALESCE((metrics->>'sent')::int, 0) + 1), true),
               "updatedAt" = NOW()
           WHERE id = $1`,
          [job.automationId]
        )

        processed += 1
      } catch (error) {
        await query(
          `UPDATE automation_jobs
           SET status = 'failed', "processedAt" = NOW(), payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{error}', to_jsonb($2::text), true)
           WHERE id = $1`,
          [job.id, error.message]
        )
      }
    }

    return NextResponse.json({ success: true, processed })
  } catch (error) {
    console.error('Error processing automation jobs:', error)
    return NextResponse.json({ error: 'Failed to process automation jobs' }, { status: 500 })
  }
}
