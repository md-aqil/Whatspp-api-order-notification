import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

function buildOrigin(request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

function normalizeSiteUrl(siteUrl) {
  if (!siteUrl) return ''

  const parsed = new URL(siteUrl)
  parsed.hash = ''
  parsed.search = ''
  return parsed.toString().replace(/\/$/, '')
}

async function getStoredWaConfig(userId) {
  const [rows] = await query(
    `SELECT id, config FROM wa_config WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC LIMIT 1`,
    [userId]
  )

  return rows[0] || null
}

export async function POST(request) {
  try {
    await ensureSettingsTables()

    const url = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const token = body.token || url.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Connection token is required' }, { status: 400 })
    }

    const [rows] = await query(
      `SELECT * FROM wordpress_connections
       WHERE JSON_EXTRACT(metadata, '$.connect_token') = ?
       LIMIT 1`,
      [token]
    )

    const connection = rows[0]
    if (!connection) {
      return NextResponse.json({ error: 'Connection token is invalid or already used' }, { status: 404 })
    }

    const expiresAt = connection?.metadata?.connect_token_expires_at
    if (!expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) < Date.now()) {
      return NextResponse.json({ error: 'Connection token has expired' }, { status: 410 })
    }

    let normalizedSiteUrl = connection.site_url
    if (body.site_url) {
      try {
        normalizedSiteUrl = normalizeSiteUrl(body.site_url)
      } catch {
        return NextResponse.json({ error: 'Plugin reported an invalid site URL' }, { status: 400 })
      }
    }

    const webhookSecret = connection.webhook_secret || crypto.randomBytes(24).toString('hex')
    const metadataPatch = {
      connected_at: new Date().toISOString(),
      last_handshake_at: new Date().toISOString(),
      plugin_capabilities: body.capabilities && typeof body.capabilities === 'object' ? body.capabilities : {},
      plugin_site_snapshot: {
        site_name: body.site_name || connection.site_name || '',
        site_url: normalizedSiteUrl || connection.site_url || '',
        plugin_version: body.plugin_version || connection.plugin_version || ''
      }
    }

    await query(
      `UPDATE wordpress_connections
       SET site_name = ?,
           site_url = ?,
           webhook_secret = ?,
           plugin_version = ?,
           status = 'active',
           updatedAt = NOW(),
           metadata = JSON_REMOVE(JSON_SET(COALESCE(metadata, '{}'), '$.connect_token', NULL, '$.connect_token_expires_at', NULL), 'connect_token', 'connect_token_expires_at')
       WHERE id = ?`,
      [
        body.site_name || connection.site_name || null,
        normalizedSiteUrl || connection.site_url,
        webhookSecret,
        body.plugin_version || connection.plugin_version || null,
        connection.id
      ]
    )

    const [updatedRows] = await query(
      'SELECT * FROM wordpress_connections WHERE id = ?',
      [connection.id]
    )

    const updatedConnection = updatedRows[0]
    const connectionUserId = String(connection.userId || '').trim()
    if (!connectionUserId) {
      return NextResponse.json({ error: 'WordPress connection is missing a user owner' }, { status: 500 })
    }

    const storedWaConfig = await getStoredWaConfig(connectionUserId)
    const currentConfig = storedWaConfig?.config && typeof storedWaConfig.config === 'object'
      ? storedWaConfig.config
      : {}

    if (!currentConfig.selected_wordpress_connection_id) {
      const nextConfig = {
        ...currentConfig,
        wordpress_url: updatedConnection.site_url,
        selected_wordpress_connection_id: updatedConnection.id
      }

      if (storedWaConfig?.id) {
        await query(
          `UPDATE wa_config SET config = ?, updatedAt = NOW() WHERE id = ?`,
          [JSON.stringify(nextConfig), storedWaConfig.id]
        )
      } else {
        await query(
          `INSERT INTO wa_config (userId, config, createdAt, updatedAt)
           VALUES (?, ?, NOW(), NOW())`,
          [connectionUserId, JSON.stringify(nextConfig)]
        )
      }
    }

    const origin = buildOrigin(request)

    return NextResponse.json({
      success: true,
      connection_id: updatedConnection.id,
      site_id: updatedConnection.site_id,
      site_name: updatedConnection.site_name,
      site_url: updatedConnection.site_url,
      webhook_secret: updatedConnection.webhook_secret,
      webhook_url: `${origin}/api/webhook/custom`,
      selected_wordpress_connection_id: currentConfig.selected_wordpress_connection_id || updatedConnection.id
    })
  } catch (error) {
    console.error('Error completing WordPress handshake:', error)
    return NextResponse.json({ error: 'Failed to connect WordPress site' }, { status: 500 })
  }
}
