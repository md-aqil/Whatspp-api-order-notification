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
    const [intRows] = await query(
      'SELECT whatsapp FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
      ['default']
    )

    const whatsappConfig = intRows[0]?.whatsapp 
      ? (typeof intRows[0].whatsapp === 'string' ? JSON.parse(intRows[0].whatsapp) : intRows[0].whatsapp)
      : null

    if (!whatsappConfig?.phoneNumberId || !whatsappConfig?.accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
    }

    const jobs = await queryMany(
      `SELECT id, automationId, recipient, message, template, payload
       FROM automation_jobs
       WHERE status = 'pending' AND runAt <= NOW()
       ORDER BY runAt ASC
       LIMIT 25`
    )

    let processed = 0

    for (const job of jobs) {
      try {
        const cartSessionId = job.payload?.cart_session_id || null
        const cartExternalId = job.payload?.external_cart_id || job.payload?.cart_id || null
        const cartCheckoutToken = job.payload?.checkout_token || null
        const cartPlatform = job.payload?.platform || null

        if (cartSessionId || cartExternalId || cartCheckoutToken) {
          const cartSession = await queryOne(
            `SELECT id, status
             FROM cart_recovery_sessions
             WHERE (
               (? IS NOT NULL AND id = ?)
               OR (? IS NOT NULL AND external_cart_id = ?)
               OR (? IS NOT NULL AND checkout_token = ?)
             )
             AND (? IS NULL OR platform = ?)
             ORDER BY updatedAt IS NULL, updatedAt DESC
             LIMIT 1`,
            [cartSessionId, cartSessionId, cartExternalId, cartExternalId, cartCheckoutToken, cartCheckoutToken, cartPlatform, cartPlatform]
          )

          if (cartSession && cartSession.status !== 'abandoned') {
            await query(
              `UPDATE automation_jobs
               SET status = 'cancelled',
                   processedAt = NOW(),
                   payload = JSON_SET(COALESCE(payload, '{}'), '$.cancelled_reason', ?)
               WHERE id = ?`,
              ['cart_not_abandoned', job.id]
            )
            continue
          }
        }

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
          `INSERT INTO messages (id, userId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, template, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW())`,
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
           SET status = 'sent', processedAt = NOW()
           WHERE id = ?`,
          [job.id]
        )

        await query(
          `UPDATE automations
           SET metrics = JSON_SET(COALESCE(metrics, '$.sent', 0), '$.sent', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.sent')), 0) + 1),
               updatedAt = NOW()
           WHERE id = ?`,
          [job.automationId]
        )

        processed += 1
      } catch (error) {
        await query(
          `UPDATE automation_jobs
           SET status = 'failed', processedAt = NOW(), payload = JSON_SET(COALESCE(payload, '{}'), '$.error', ?)
           WHERE id = ?`,
          [error.message, job.id]
        )
      }
    }

    return NextResponse.json({ success: true, processed })
  } catch (error) {
    console.error('Error processing automation jobs:', error)
    return NextResponse.json({ error: 'Failed to process automation jobs' }, { status: 500 })
  }
}
