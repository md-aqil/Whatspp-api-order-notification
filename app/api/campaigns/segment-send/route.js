import { NextResponse } from 'next/server'
import { evaluateAudience } from '@/lib/segments/audience'
import { getStoredIntegrations } from '@/lib/db/integration-repository'
import { sendWithIdempotency } from '@/lib/outbound-idempotency'
import { buildOutboundIdempotencyKey } from '@/lib/webhook-security'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/mysql'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Send a templated WhatsApp message to every customer matching the supplied
 * audience rules.
 *
 *   POST /api/campaigns/segment-send
 *   {
 *     userId: 'default',
 *     template: { name: 'order_confirmation', language: 'en_US', components: [...] },
 *     rules: [{ field: 'lifetimeTier', op: 'in', value: ['gold','platinum'] }],
 *     fallbackText: '...',                       // optional text body if template omitted
 *     batchSize: 50,
 *     delayMsBetween: 300
 *   }
 *
 * Returns: { success, targeted, sent, failed, wamids: [...] }
 */
export async function POST(request) {
  try {
    const userId = requireRequestUserId(request)
    const body = await request.json().catch(() => ({}))
    const rules = Array.isArray(body.rules) ? body.rules : []
    const template = body.template
    const fallbackText = body.fallbackText || ''
    const batchSize = Math.min(parseInt(body.batchSize || 50, 10) || 50, 500)
    const delayMsBetween = Math.min(parseInt(body.delayMsBetween || 250, 10) || 250, 5000)
    const campaignTag = body.campaignTag || `segment_blast_${Date.now()}`

    if (!template && !fallbackText) {
      return NextResponse.json({ success: false, error: 'template or fallbackText is required' }, { status: 400 })
    }

    const audience = await evaluateAudience({ userId, rules, limit: batchSize })
    if (audience.length === 0) {
      return NextResponse.json({ success: true, targeted: 0, sent: 0, failed: 0 })
    }

    // Bulk-send safety: above the threshold we require an explicit confirmation
    // header so a leaked form, CSRF, or accidental click cannot silently spam
    // every matching customer. The header is a fixed string, not a user token.
    const CONFIRM_THRESHOLD = 50
    if (audience.length > CONFIRM_THRESHOLD) {
      const confirmed = request.headers.get('x-confirm-bulk') === 'yes'
      if (!confirmed) {
        return NextResponse.json(
          {
            success: false,
            error: 'confirmation_required',
            message: `Targeting ${audience.length} customers. Add 'X-Confirm-Bulk: yes' header to proceed.`
          },
          { status: 409 }
        )
      }
    }

    const integrations = await getStoredIntegrations(userId)
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return NextResponse.json({ success: false, error: 'whatsapp_not_configured' }, { status: 400 })
    }

    let sent = 0
    let failed = 0
    const wamids = []

    for (const member of audience) {
      const phone = String(member.customerPhone || '').replace(/\D/g, '')
      if (!phone) { failed++; continue }
      const idemKey = buildOutboundIdempotencyKey({
        userId, phoneNumberId: integrations.whatsapp.phoneNumberId,
        recipient: phone, stepType: 'segment_blast',
        resourceId: `${campaignTag}:${phone}`
      })

      const result = await sendWithIdempotency({
        idempotencyKey: idemKey,
        context: { campaignTag, phone },
        send: async () => {
          if (template) {
            const messageData = {
              type: 'template',
              template: {
                name: template.name,
                language: { code: template.language || 'en_US' },
                components: template.components || []
              }
            }
            return sendMetaMessage(integrations.whatsapp.phoneNumberId, integrations.whatsapp.accessToken, phone, messageData)
          } else {
            return sendMetaMessage(integrations.whatsapp.phoneNumberId, integrations.whatsapp.accessToken, phone, {
              type: 'text',
              text: { body: fallbackText }
            })
          }
        }
      })

      if (result.success) {
        sent++
        if (result.wamid) wamids.push({ phone, wamid: result.wamid })
      } else {
        failed++
      }

      // Best-effort log per recipient
      try {
        await query(
          `INSERT INTO messages (id, userId, recipient, phone, message, isCustomer, timestamp, status, sentAt)
           VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, NOW())`,
          [uuidv4(), userId, phone, phone, fallbackText || `[template ${template?.name || ''}]`, result.success ? 'sent' : 'failed']
        )
      } catch (e) { /* ignore */ }

      if (delayMsBetween > 0) await new Promise((r) => setTimeout(r, delayMsBetween))
    }

    return NextResponse.json({
      success: true,
      campaignTag,
      targeted: audience.length,
      sent,
      failed,
      wamids
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

async function sendMetaMessage(phoneNumberId, accessToken, to, messageData) {
  const sanitizedTo = String(to).replace(/\D/g, '')
  const payload = { messaging_product: 'whatsapp', to: sanitizedTo, ...messageData }
  const res = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Meta API error')
  }
  return data
}