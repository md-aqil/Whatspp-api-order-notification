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
  const result = await query(
    `SELECT id, config FROM wa_config WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
    [userId]
  )

  return result?.rows?.[0] || null
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

    const connectionResult = await query(
      `SELECT * FROM wordpress_connections
       WHERE metadata->>'connect_token' = $1
       LIMIT 1`,
      [token]
    )

    const connection = connectionResult?.rows?.[0]
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

    const updated = await query(
      `UPDATE wordpress_connections
       SET site_name = $1,
           site_url = $2,
           webhook_secret = $3,
           plugin_version = $4,
           status = 'active',
           "updatedAt" = NOW(),
           metadata = (COALESCE(metadata, '{}'::jsonb) - 'connect_token' - 'connect_token_expires_at') || $5::jsonb
       WHERE id = $6
       RETURNING *`,
      [
        body.site_name || connection.site_name || null,
        normalizedSiteUrl || connection.site_url,
        webhookSecret,
        body.plugin_version || connection.plugin_version || null,
        JSON.stringify(metadataPatch),
        connection.id
      ]
    )

    const updatedConnection = updated?.rows?.[0]
    const storedWaConfig = await getStoredWaConfig(connection.userId || 'default')
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
          `UPDATE wa_config SET config = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
          [JSON.stringify(nextConfig), storedWaConfig.id]
        )
      } else {
        await query(
          `INSERT INTO wa_config ("userId", config, "createdAt", "updatedAt")
           VALUES ($1, $2::jsonb, NOW(), NOW())`,
          [connection.userId || 'default', JSON.stringify(nextConfig)]
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
