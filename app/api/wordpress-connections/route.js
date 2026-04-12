import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'
import { requireRequestUserId } from '@/lib/request-user'

function normalizeSiteUrl(siteUrl) {
  const parsed = new URL(siteUrl)
  parsed.hash = ''
  parsed.search = ''
  return parsed.toString().replace(/\/$/, '')
}

function createSiteId(siteUrl) {
  try {
    const hostname = new URL(siteUrl).hostname || 'wordpress-site'
    return hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'wordpress-site'
  } catch {
    return 'wordpress-site'
  }
}

function createWebhookSecret() {
  return crypto.randomBytes(24).toString('hex')
}

function normalizeJsonObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback
  }
  return value
}

function parseDateValue(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildConnectionHealth(row, metadata) {
  const now = Date.now()
  const lastSeenAt = parseDateValue(metadata.last_webhook_at || row.lastSeenAt)
  const lastHandshakeAt = parseDateValue(metadata.last_handshake_at || metadata.connected_at)
  const connectTokenExpiresAt = parseDateValue(metadata.connect_token_expires_at)
  const cachedPluginConfigAt = parseDateValue(metadata.cached_plugin_config_at)
  const hasSecret = Boolean(row.webhook_secret)
  const hasHandshake = Boolean(lastHandshakeAt)

  let state = 'saved'
  let label = 'Saved'
  let tone = 'neutral'
  let reason = 'Site is saved in the platform but the plugin handshake has not completed yet.'

  if (connectTokenExpiresAt && connectTokenExpiresAt.getTime() < now && !hasHandshake) {
    state = 'needs_reconnect'
    label = 'Needs Reconnect'
    tone = 'warning'
    reason = 'The previous connect link expired before the plugin completed the handshake.'
  } else if (row.status === 'active' && hasHandshake && hasSecret && lastSeenAt) {
    const daysSinceLastWebhook = (now - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceLastWebhook > 14) {
      state = 'inactive'
      label = 'Inactive'
      tone = 'warning'
      reason = 'The site connected earlier, but no webhook has been received in the last 14 days.'
    } else {
      state = 'verified'
      label = 'Verified'
      tone = 'success'
      reason = 'The plugin handshake completed and signed webhooks have been received recently.'
    }
  } else if (row.status === 'active' && hasHandshake) {
    state = 'connected'
    label = 'Connected'
    tone = 'info'
    reason = 'The plugin handshake completed. Waiting for a recent webhook to verify live delivery.'
  } else if (connectTokenExpiresAt && connectTokenExpiresAt.getTime() >= now) {
    state = 'pending_handshake'
    label = 'Awaiting Plugin'
    tone = 'info'
    reason = 'A connect link has been generated. Complete the handshake in the WordPress plugin.'
  }

  return {
    state,
    label,
    tone,
    reason,
    has_secret: hasSecret,
    last_handshake_at: lastHandshakeAt?.toISOString() || null,
    last_webhook_at: lastSeenAt?.toISOString() || null,
    last_webhook_topic: metadata.last_webhook_topic || null,
    cached_plugin_config_at: cachedPluginConfigAt?.toISOString() || null,
    connect_token_expires_at: connectTokenExpiresAt?.toISOString() || null
  }
}

function mapConnection(row) {
  if (!row) return null

  const capabilities = normalizeJsonObject(row.capabilities)
  const metadata = normalizeJsonObject(row.metadata)

  return {
    ...row,
    capabilities,
    metadata,
    health: buildConnectionHealth(row, metadata),
  }
}

// GET - list connections, or a single connection by id
export async function GET(request) {
  try {
    await ensureSettingsTables()

    const url = new URL(request.url)
    const userId = requireRequestUserId(request)
    const id = url.searchParams.get('id')

    if (id) {
      const [rows] = await query(
        'SELECT * FROM wordpress_connections WHERE id = ? AND userId = ? LIMIT 1',
        [id, userId]
      )

      if (!rows[0]) {
        return NextResponse.json({ error: 'WordPress connection not found' }, { status: 404 })
      }

      return NextResponse.json(mapConnection(rows[0]))
    }

    const [rows] = await query(
      'SELECT * FROM wordpress_connections WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    )

    return NextResponse.json(rows.map(mapConnection))
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error fetching WordPress connections:', error)
    return NextResponse.json([])
  }
}

// POST - create a new connection
export async function POST(request) {
  try {
    await ensureSettingsTables()

    const body = await request.json()
    const {
      site_id,
      site_name,
      site_url,
      webhook_secret,
      status = 'pending',
      plugin_version,
      capabilities = {},
      metadata = {},
    } = body
    const userId = requireRequestUserId(request)

    if (!site_url) {
      return NextResponse.json({ error: 'Site URL is required' }, { status: 400 })
    }

    let normalizedSiteUrl
    try {
      normalizedSiteUrl = normalizeSiteUrl(site_url)
    } catch {
      return NextResponse.json({ error: 'Invalid site URL format' }, { status: 400 })
    }

    const normalizedSiteId = (site_id || createSiteId(normalizedSiteUrl)).trim()
    if (!normalizedSiteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    const connectionId = crypto.randomUUID()
    await query(
      `INSERT INTO wordpress_connections (
        id,
        userId,
        site_id,
        site_name,
        site_url,
        webhook_secret,
        status,
        plugin_version,
        capabilities,
        metadata,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        connectionId,
        userId,
        normalizedSiteId,
        site_name?.trim() || null,
        normalizedSiteUrl,
        webhook_secret?.trim() || createWebhookSecret(),
        status,
        plugin_version?.trim() || null,
        JSON.stringify(normalizeJsonObject(capabilities)),
        JSON.stringify(normalizeJsonObject(metadata)),
      ]
    )

    const [insertedRow] = await query(
      'SELECT * FROM wordpress_connections WHERE id = ?',
      [connectionId]
    )

    return NextResponse.json(mapConnection(insertedRow[0]), { status: 201 })
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error creating WordPress connection:', error)

    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'A WordPress connection with this site ID or site URL already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to create WordPress connection' }, { status: 500 })
  }
}

// PUT - update a connection
export async function PUT(request) {
  try {
    await ensureSettingsTables()

    const body = await request.json()
    const userId = requireRequestUserId(request)
    const {
      id,
      site_id,
      site_name,
      site_url,
      webhook_secret,
      status,
      plugin_version,
      capabilities,
      metadata,
      lastSeenAt,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    const updates = []
    const values = []

    if (site_id !== undefined) {
      updates.push('site_id = ?')
      values.push(site_id?.trim() || null)
    }
    if (site_name !== undefined) {
      updates.push('site_name = ?')
      values.push(site_name?.trim() || null)
    }
    if (site_url !== undefined) {
      let normalizedSiteUrl
      try {
        normalizedSiteUrl = normalizeSiteUrl(site_url)
      } catch {
        return NextResponse.json({ error: 'Invalid site URL format' }, { status: 400 })
      }

      updates.push('site_url = ?')
      values.push(normalizedSiteUrl)
    }
    if (webhook_secret !== undefined) {
      updates.push('webhook_secret = ?')
      values.push(webhook_secret?.trim() || null)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (plugin_version !== undefined) {
      updates.push('plugin_version = ?')
      values.push(plugin_version?.trim() || null)
    }
    if (capabilities !== undefined) {
      updates.push('capabilities = ?')
      values.push(JSON.stringify(normalizeJsonObject(capabilities)))
    }
    if (metadata !== undefined) {
      updates.push('metadata = ?')
      values.push(JSON.stringify(normalizeJsonObject(metadata)))
    }
    if (lastSeenAt !== undefined) {
      updates.push('lastSeenAt = ?')
      values.push(lastSeenAt)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updatedAt = NOW()')
    values.push(id, userId)

    await query(
      `UPDATE wordpress_connections
       SET ${updates.join(', ')}
       WHERE id = ? AND userId = ?`,
      values
    )

    const [rows] = await query(
      'SELECT * FROM wordpress_connections WHERE id = ? AND userId = ?',
      [id, userId]
    )

    if (!rows[0]) {
      return NextResponse.json({ error: 'WordPress connection not found' }, { status: 404 })
    }

    return NextResponse.json(mapConnection(rows[0]))
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error updating WordPress connection:', error)

    if (error?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'A WordPress connection with this site ID or site URL already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to update WordPress connection' }, { status: 500 })
  }
}

// DELETE - remove a connection
export async function DELETE(request) {
  try {
    await ensureSettingsTables()

    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const userId = requireRequestUserId(request)

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    await query(
      'DELETE FROM wordpress_connections WHERE id = ? AND userId = ?',
      [id, userId]
    )

    return NextResponse.json({ message: 'WordPress connection deleted successfully' })
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error deleting WordPress connection:', error)
    return NextResponse.json({ error: 'Failed to delete WordPress connection' }, { status: 500 })
  }
}
