import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, queryMany } from '../mysql'
import { getStoredIntegrations } from '../db/integration-repository'
import { decrypt } from '../encryption'
import { sendWhatsAppMessage } from '../whatsapp/meta-api'

/**
 * Per-tenant notification preferences and the email/WhatsApp delivery helper.
 *
 * Backed by:
 *   - notification_prefs(userId, channel, address, kind, enabled)
 *   - notification_log(id, userId, channel, kind, subject, body, sentAt, status)
 *
 * Used by the webhook-secret-rotation helper and the AI-cost-alert.
 */

export async function getNotificationPrefs({ userId = 'default' } = {}) {
  return queryMany(
    `SELECT channel, kind, address, enabled
     FROM notification_prefs
     WHERE userId = ?`,
    [userId]
  ).catch(() => [])
}

export async function setNotificationPref({ userId = 'default', channel, kind, address, enabled = true }) {
  if (!['email', 'whatsapp'].includes(channel)) throw new Error('invalid channel')
  if (!address) throw new Error('address required')
  await query(
    `INSERT INTO notification_prefs (id, userId, channel, kind, address, enabled)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE address = VALUES(address), enabled = VALUES(enabled)`,
    [uuidv4(), userId, channel, kind, String(address).slice(0, 255), enabled ? 1 : 0]
  )
  return { userId, channel, kind, address, enabled }
}

/**
 * Send a notification: persists the row in `notification_log` and attempts
 * the actual delivery (delegates to the WhatsApp + email side if configured).
 */
export async function sendNotification({ userId = 'default', channel = 'email', kind, subject, body, addressHint = null } = {}) {
  const id = uuidv4()
  let address = addressHint
  if (!address) {
    const prefs = await getNotificationPrefs({ userId })
    const match = prefs.find(p => p.channel === channel && (p.kind === kind || p.kind === 'all') && p.enabled)
    address = match?.address || null
  }
  if (!address) {
    await query(
      `INSERT INTO notification_log (id, userId, channel, kind, subject, body, status)
       VALUES (?, ?, ?, ?, ?, ?, 'no_recipient')`,
      [id, userId, channel, kind, String(subject || '').slice(0, 255), String(body || '').slice(0, 4000)]
    ).catch(() => null)
    return { id, sent: false, reason: 'no_recipient' }
  }
  // Actually try to deliver.
  const result = await deliver({ userId, channel, address, subject, body, kind })
  await query(
    `INSERT INTO notification_log (id, userId, channel, kind, address, subject, body, status, error, sentAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, userId, channel, kind, address, String(subject || '').slice(0, 255), String(body || '').slice(0, 4000), result.status, result.error || null]
  ).catch(() => null)
  return { id, sent: result.status === 'sent', status: result.status, error: result.error, address }
}

async function deliver({ userId, channel, address, subject, body, kind }) {
  try {
    if (channel === 'whatsapp') {
      const integrations = await getStoredIntegrations(userId)
      const wa = integrations?.whatsapp
      if (!wa?.phoneNumberId || !wa?.accessToken) return { status: 'skipped_no_whatsapp' }
      const token = await decrypt(wa.accessToken)
      const text = `*${subject || 'Notification'}*\n\n${body || ''}`.slice(0, 4000)
      await sendWhatsAppMessage(wa.phoneNumberId, token, String(address).replace(/\D/g, ''), { type: 'text', text: { body: text } }, { stepType: 'notification', dedupeKey: `notif:${userId}:${kind}:${address}:${Date.now()}` })
      return { status: 'sent' }
    }
    if (channel === 'email') {
      // SMTP delivery via dynamic import — only loaded when actually used.
      const smtpUrl = process.env.SMTP_URL
      if (!smtpUrl) return { status: 'skipped_no_smtp' }
      const url = new URL(smtpUrl)
      // Indirected import so webpack doesn't try to resolve the dep at build
      // time — if nodemailer isn't installed, this returns null.
      const moduleName = 'nodemailer'
      const nodemailer = await import(/* webpackIgnore: true */ moduleName).catch(() => null)
      if (!nodemailer) return { status: 'skipped_no_nodemailer' }
      const transporter = nodemailer.createTransport({
        host: url.hostname,
        port: Number(url.port || 587),
        secure: url.protocol === 'smtps:',
        auth: url.username ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) } : undefined
      })
      const from = process.env.SMTP_FROM || 'noreply@chatflow.local'
      await transporter.sendMail({
        from, to: address, subject: subject || 'Notification', text: body || ''
      })
      return { status: 'sent' }
    }
    return { status: 'skipped_unknown_channel' }
  } catch (err) {
    return { status: 'failed', error: err.message }
  }
}