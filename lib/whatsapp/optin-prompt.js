import { query, queryOne } from '../mysql'
import { sendWhatsAppInteractiveList } from './meta-api'
import { getStoredIntegrations } from '../db/integration-repository'
import { decrypt } from '../encryption'

/**
 * One-shot helper: send an opt-in list-message prompt the first time a
 * previously silent / win-backed customer messages us. The helper tracks
 * dedup in `optin_prompt_log` so the prompt is only ever sent once per
 * (userId, phone, promptKey) tuple.
 */
export async function maybeSendOptinPrompt({ userId = 'default', phone, promptKey = 'winback_reengagement', context = {} } = {}) {
  if (!userId || !phone) return { sent: false, reason: 'missing_args' }
  const normalized = String(phone).replace(/\D/g, '')
  if (!normalized) return { sent: false, reason: 'invalid_phone' }

  try {
    const dedup = await queryOne(
      `SELECT id FROM optin_prompt_log WHERE userId = ? AND phone = ? AND promptKey = ? LIMIT 1`,
      [userId, normalized, promptKey]
    )
    if (dedup) return { sent: false, reason: 'already_prompted' }
  } catch (e) {
    // table may not exist yet
  }

  const integrations = await getStoredIntegrations(userId)
  const wa = integrations?.whatsapp || {}
  if (!wa.phoneNumberId || !wa.accessToken) return { sent: false, reason: 'whatsapp_not_configured' }
  let token
  try { token = await decrypt(wa.accessToken) } catch (e) { return { sent: false, reason: 'token_decrypt_failed' } }

  try {
    await sendWhatsAppInteractiveList(wa.phoneNumberId, token, normalized, {
      body: context.body || 'Welcome back! 👋 Stay in the loop for order updates, restock alerts and exclusive offers. Subscribe?',
      buttonText: 'Choose',
      sections: [{
        title: 'Marketing',
        rows: [
          { id: 'opt_in_yes', title: '✅ Yes, subscribe' },
          { id: 'opt_in_no', title: '❌ No thanks' }
        ]
      }],
      footer: 'You can change this any time by replying STOP.'
    }, { stepType: 'optin_prompt', dedupeKey: `optin_prompt:${userId}:${normalized}:${promptKey}` })

    await query(
      `INSERT INTO optin_prompt_log (id, userId, phone, promptKey, sentAt)
       VALUES (UUID(), ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE sentAt = sentAt`,
      [userId, normalized, promptKey]
    ).catch(() => null)
    return { sent: true }
  } catch (err) {
    return { sent: false, reason: 'send_failed', error: err.message }
  }
}