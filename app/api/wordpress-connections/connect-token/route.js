import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'
import { requireRequestUserId } from '@/lib/request-user'

function buildOrigin(request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export async function POST(request) {
  try {
    await ensureSettingsTables()

    const body = await request.json()
    const connectionId = body.connection_id || body.connectionId
    const userId = requireRequestUserId(request)

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    const [rows] = await query(
      'SELECT id FROM wordpress_connections WHERE id = ? AND userId = ? LIMIT 1',
      [connectionId, userId]
    )

    if (!rows[0]) {
      return NextResponse.json({ error: 'WordPress connection not found' }, { status: 404 })
    }

    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await query(
      `UPDATE wordpress_connections
       SET metadata = JSON_MERGE_PATCH(COALESCE(metadata, '{}'), ?),
           updatedAt = NOW()
       WHERE id = ?`,
      [
        JSON.stringify({
          connect_token: token,
          connect_token_expires_at: expiresAt
        }),
        connectionId
      ]
    )

    const origin = buildOrigin(request)

    return NextResponse.json({
      connection_id: connectionId,
      token,
      expires_at: expiresAt,
      connect_url: `${origin}/api/wordpress-connections/handshake?token=${token}`
    })
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error generating WordPress connect token:', error)
    return NextResponse.json({ error: 'Failed to generate connect token' }, { status: 500 })
  }
}
