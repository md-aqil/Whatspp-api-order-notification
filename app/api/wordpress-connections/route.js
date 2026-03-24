import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

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

function mapConnection(row) {
  if (!row) return null

  return {
    ...row,
    capabilities: normalizeJsonObject(row.capabilities),
    metadata: normalizeJsonObject(row.metadata),
  }
}

// GET - list connections, or a single connection by id
export async function GET(request) {
  try {
    await ensureSettingsTables()

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const id = url.searchParams.get('id')

    if (id) {
      const result = await query(
        'SELECT * FROM wordpress_connections WHERE id = $1 AND "userId" = $2 LIMIT 1',
        [id, userId]
      )

      if (!result.rows[0]) {
        return NextResponse.json({ error: 'WordPress connection not found' }, { status: 404 })
      }

      return NextResponse.json(mapConnection(result.rows[0]))
    }

    const result = await query(
      'SELECT * FROM wordpress_connections WHERE "userId" = $1 ORDER BY "createdAt" DESC',
      [userId]
    )

    return NextResponse.json(result.rows.map(mapConnection))
  } catch (error) {
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
      userId = 'default',
    } = body

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

    const result = await query(
      `INSERT INTO wordpress_connections (
        id,
        "userId",
        site_id,
        site_name,
        site_url,
        webhook_secret,
        status,
        plugin_version,
        capabilities,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
      RETURNING *`,
      [
        crypto.randomUUID(),
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

    return NextResponse.json(mapConnection(result.rows[0]), { status: 201 })
  } catch (error) {
    console.error('Error creating WordPress connection:', error)

    if (error?.code === '23505') {
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
    const {
      id,
      userId = 'default',
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
    let index = 1

    if (site_id !== undefined) {
      updates.push(`site_id = $${index++}`)
      values.push(site_id?.trim() || null)
    }
    if (site_name !== undefined) {
      updates.push(`site_name = $${index++}`)
      values.push(site_name?.trim() || null)
    }
    if (site_url !== undefined) {
      let normalizedSiteUrl
      try {
        normalizedSiteUrl = normalizeSiteUrl(site_url)
      } catch {
        return NextResponse.json({ error: 'Invalid site URL format' }, { status: 400 })
      }

      updates.push(`site_url = $${index++}`)
      values.push(normalizedSiteUrl)
    }
    if (webhook_secret !== undefined) {
      updates.push(`webhook_secret = $${index++}`)
      values.push(webhook_secret?.trim() || null)
    }
    if (status !== undefined) {
      updates.push(`status = $${index++}`)
      values.push(status)
    }
    if (plugin_version !== undefined) {
      updates.push(`plugin_version = $${index++}`)
      values.push(plugin_version?.trim() || null)
    }
    if (capabilities !== undefined) {
      updates.push(`capabilities = $${index++}::jsonb`)
      values.push(JSON.stringify(normalizeJsonObject(capabilities)))
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${index++}::jsonb`)
      values.push(JSON.stringify(normalizeJsonObject(metadata)))
    }
    if (lastSeenAt !== undefined) {
      updates.push(`"lastSeenAt" = $${index++}`)
      values.push(lastSeenAt)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`"updatedAt" = NOW()`)
    values.push(id, userId)

    const result = await query(
      `UPDATE wordpress_connections
       SET ${updates.join(', ')}
       WHERE id = $${index++} AND "userId" = $${index}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'WordPress connection not found' }, { status: 404 })
    }

    return NextResponse.json(mapConnection(result.rows[0]))
  } catch (error) {
    console.error('Error updating WordPress connection:', error)

    if (error?.code === '23505') {
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
    const userId = url.searchParams.get('userId') || 'default'

    if (!id) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    await query(
      'DELETE FROM wordpress_connections WHERE id = $1 AND "userId" = $2',
      [id, userId]
    )

    return NextResponse.json({ message: 'WordPress connection deleted successfully' })
  } catch (error) {
    console.error('Error deleting WordPress connection:', error)
    return NextResponse.json({ error: 'Failed to delete WordPress connection' }, { status: 500 })
  }
}
