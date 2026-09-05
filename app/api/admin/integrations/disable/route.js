import { NextResponse } from 'next/server'
import { getHmacFailureStats, runHmacFailureSweep } from '@/lib/security/hmac-failures'

/**
 * GET /api/admin/integrations/disable?userId=...&windowMinutes=60
 *   → returns the failure counts per (userId, kind) inside the window.
 *
 * POST /api/admin/integrations/disable?threshold=5&windowMinutes=30
 *   → runs the auto-disable sweep across all tenants.
 *
 * Both require `?token=` matching ADMIN_TOKEN env (if set).
 */
async function gate(request) {
  const url = new URL(request.url)
  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    // Fail-closed: if no admin token is configured, do not allow the route.
    return NextResponse.json({ success: false, error: 'admin_disabled' }, { status: 503 })
  }
  const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
  return provided === expected ? null : NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
}

export async function GET(request) {
  const denied = await gate(request)
  if (denied) return denied
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const windowMinutes = Math.min(Math.max(parseInt(url.searchParams.get('windowMinutes') || '60', 10) || 60, 5), 1440)
  const stats = await getHmacFailureStats({ userId, windowMinutes })
  return NextResponse.json({ success: true, userId, windowMinutes, stats })
}

export async function POST(request) {
  const denied = await gate(request)
  if (denied) return denied
  const url = new URL(request.url)
  const threshold = Math.min(Math.max(parseInt(url.searchParams.get('threshold') || '5', 10) || 5, 2), 100)
  const windowMinutes = Math.min(Math.max(parseInt(url.searchParams.get('windowMinutes') || '30', 10) || 30, 5), 1440)
  const result = await runHmacFailureSweep({ threshold, windowMinutes })
  return NextResponse.json({ success: true, threshold, windowMinutes, ...result })
}