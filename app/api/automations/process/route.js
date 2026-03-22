import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'
import { buildAutomationTemplateComponents } from '@/lib/automation-template'
import { query, queryMany, queryOne } from '@/lib/postgres'

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
