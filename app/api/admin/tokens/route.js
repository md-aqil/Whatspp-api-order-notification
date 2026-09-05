import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { query, queryOne, queryMany } from '@/lib/mysql'

/**
 * Admin-token rotation helper.
 *
 *   GET    /api/admin/tokens            → list tokens (hash + label + meta)
 *   POST   /api/admin/tokens            → { label }   → mint a new token, return plaintext ONCE
 *   DELETE /api/admin/tokens?id=...     → revoke (sets revokedAt)
 *
 * All endpoints require `?token=` matching `ADMIN_TOKEN` env OR a valid
 * previously-issued row in `admin_tokens`. The new plaintext token is
 * returned only in the POST response; subsequent requests identify the
 * token by its SHA-256 hash.
 */

function hashToken(t) {
  return createHash('sha256').update(String(t)).digest('hex')
}

async function requireCurrentToken(request) {
  const url = new URL(request.url)
  const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
  if (!provided) return null
  // Env-token wins (escape hatch for emergencies)
  const expected = process.env.ADMIN_TOKEN || ''
  if (expected && provided === expected) return { source: 'env' }
  try {
    const row = await queryOne(
      `SELECT id FROM admin_tokens WHERE tokenHash = ? AND revokedAt IS NULL LIMIT 1`,
      [hashToken(provided)]
    )
    if (row) {
      await query(`UPDATE admin_tokens SET lastUsedAt = NOW() WHERE id = ?`, [row.id]).catch(() => null)
      return { source: 'db', id: row.id }
    }
  } catch (e) {}
  return null
}

export async function GET(request) {
  const auth = await requireCurrentToken(request)
  if (!auth) return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
  const rows = await queryMany(
    `SELECT id, label, lastUsedAt, createdAt, revokedAt,
            SUBSTRING(tokenHash, 1, 12) AS tokenHashPrefix
     FROM admin_tokens ORDER BY createdAt DESC`
  ).catch(() => [])
  return NextResponse.json({ success: true, tokens: rows })
}

export async function POST(request) {
  const auth = await requireCurrentToken(request)
  if (!auth) return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const label = String(body.label || 'admin').slice(0, 64)
    const token = randomBytes(32).toString('base64url')
    const tokenHash = hashToken(token)
    await query(
      `INSERT INTO admin_tokens (label, tokenHash) VALUES (?, ?)`,
      [label, tokenHash]
    )
    return NextResponse.json({ success: true, label, token, tokenHash, note: 'Store this token — it will not be shown again.' })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const auth = await requireCurrentToken(request)
  if (!auth) return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
  const res = await query(
    `UPDATE admin_tokens SET revokedAt = NOW() WHERE id = ? AND revokedAt IS NULL`,
    [id]
  ).catch(() => null)
  return NextResponse.json({ success: true, revoked: res?.affectedRows || 0 })
}