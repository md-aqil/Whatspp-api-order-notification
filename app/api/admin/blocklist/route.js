import { NextResponse } from 'next/server'
import { isBlocked, addToBlocklist, removeFromBlocklist, listBlocklist } from '@/lib/outbound-blocklist'

/**
 * Per-tenant outbound blocklist admin.
 *
 *   GET    /api/admin/blocklist?userId=...&phone=...       → isBlocked + listing
 *   POST   /api/admin/blocklist
 *           body: { userId, phone, reason?, source?, expiresAt? }
 *   DELETE /api/admin/blocklist?userId=...&phone=...        → remove
 *
 * Requires `?token=` matching ADMIN_TOKEN env (if set).
 */
async function gate(request) {
  const url = new URL(request.url)
  const expected = process.env.ADMIN_TOKEN || ''
  if (!expected) return null
  const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
  return provided === expected ? null : NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
}

export async function GET(request) {
  const denied = await gate(request)
  if (denied) return denied
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const phone = url.searchParams.get('phone')
  const listing = await listBlocklist({ userId, limit: 200 })
  if (phone) {
    const block = await isBlocked({ userId, phone })
    return NextResponse.json({ success: true, userId, phone: String(phone).replace(/\D/g, ''), block, count: listing.length, listing })
  }
  return NextResponse.json({ success: true, userId, count: listing.length, listing })
}

export async function POST(request) {
  const denied = await gate(request)
  if (denied) return denied
  try {
    const body = await request.json().catch(() => ({}))
    const result = await addToBlocklist({
      userId: body.userId || 'default',
      phone: body.phone,
      reason: body.reason || 'manual',
      source: body.source || 'admin',
      expiresAt: body.expiresAt || null
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}

export async function DELETE(request) {
  const denied = await gate(request)
  if (denied) return denied
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const phone = url.searchParams.get('phone')
    const result = await removeFromBlocklist({ userId, phone })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}