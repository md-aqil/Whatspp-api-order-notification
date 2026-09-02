import crypto from 'crypto'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'
import { saveStoredIntegration } from '@/lib/db/integration-repository'

const SESSION_TTL_MS = 15 * 60 * 1000

export function buildOrigin(request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const reqOrigin = new URL(request.url).origin
  if ((reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) && process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')
  }

  return reqOrigin
}

export function buildConnectUrl(origin, token) {
  return `${origin.replace(/\/$/, '')}/connect/${token}`
}

export async function createConnectSession(userId) {
  await ensureSettingsTables()

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await query(
    `INSERT INTO connect_sessions (id, userId, status, createdAt, updatedAt, expires_at)
     VALUES (?, ?, 'pending', NOW(), NOW(), ?)
     ON DUPLICATE KEY UPDATE userId = VALUES(userId), status = 'pending', expires_at = VALUES(expires_at), updatedAt = NOW()`,
    [token, String(userId || 'default'), expiresAt]
  )

  return { token, expiresAt: expiresAt.toISOString() }
}

export async function getConnectSession(token) {
  await ensureSettingsTables()
  if (!token) return null

  const [rows] = await query('SELECT * FROM connect_sessions WHERE id = ? LIMIT 1', [token])
  return rows[0] || null
}

export function isSessionValid(session) {
  if (!session) return false
  if (session.status === 'expired' || session.status === 'complete') {
    // 'complete' is still valid for read-only status polling, but not for new writes
  }
  if (session.status === 'expired') return false
  if (!session.expires_at) return false
  return new Date(session.expires_at).getTime() > Date.now()
}

export function deriveSessionStatus(session) {
  const shopifyDone = Boolean(session?.shopify)
  const whatsappDone = Boolean(session?.whatsapp)

  let status = 'pending'
  if (shopifyDone && whatsappDone) status = 'complete'
  else if (shopifyDone || whatsappDone) status = 'partial'

  return { status, shopifyConnected: shopifyDone, whatsappConnected: whatsappDone }
}

export async function saveShopifyForSession(session, shopify) {
  const userId = session.userId
  await saveStoredIntegration(
    'shopify',
    {
      shopDomain: shopify.shopDomain,
      accessToken: shopify.accessToken,
      scope: shopify.scope || '',
      connectedVia: 'qrcode'
    },
    userId
  )

  const nextStatus = deriveSessionStatus({ ...session, shopify: { connectedAt: new Date().toISOString() } }).status
  await query(
    `UPDATE connect_sessions
     SET shopify = ?, status = ?, updatedAt = NOW()
     WHERE id = ?`,
    [
      JSON.stringify({ shopDomain: shopify.shopDomain, connectedAt: new Date().toISOString() }),
      nextStatus,
      session.id
    ]
  )
}

export async function saveWhatsappForSession(session, whatsapp) {
  const userId = session.userId

  // Reuse existing integration persistence (also syncs whatsapp_accounts)
  await saveStoredIntegration(
    'whatsapp',
    {
      accountName: whatsapp.accountName,
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.accessToken,
      businessAccountId: whatsapp.businessAccountId,
      phoneNumber: whatsapp.phoneNumber || '',
      connectedVia: 'qrcode'
    },
    userId
  )

  const nextStatus = deriveSessionStatus({ ...session, whatsapp: { connectedAt: new Date().toISOString() } }).status
  await query(
    `UPDATE connect_sessions
     SET whatsapp = ?, status = ?, updatedAt = NOW()
     WHERE id = ?`,
    [
      JSON.stringify({
        phoneNumberId: whatsapp.phoneNumberId,
        accountName: whatsapp.accountName,
        connectedAt: new Date().toISOString()
      }),
      nextStatus,
      session.id
    ]
  )
}

export function requireConnectEnv(...keys) {
  const missing = keys.filter((k) => !process.env[k])
  if (missing.length > 0) {
    const err = new Error(`Missing required env vars: ${missing.join(', ')}`)
    err.status = 500
    err.code = 'MISSING_ENV'
    throw err
  }
}
