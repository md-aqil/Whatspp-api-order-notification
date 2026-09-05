import { NextResponse } from 'next/server'
import { getFeatureFlags, setFeatureFlag } from '@/lib/admin/feature-flags'

/**
 * Per-tenant feature flags.
 *
 *   GET  /api/admin/features?userId=...   → { userId, flags: {...} }
 *   POST /api/admin/features              → { userId, flagKey, enabled, rollout }
 *     body: { userId, flagKey, enabled, rollout }
 *
 * Gated by `?token=` matching ADMIN_TOKEN env (if set).
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
  const flags = await getFeatureFlags({ userId })
  return NextResponse.json({ success: true, userId, flags })
}

export async function POST(request) {
  const denied = await gate(request)
  if (denied) return denied
  try {
    const body = await request.json().catch(() => ({}))
    if (!body.flagKey) return NextResponse.json({ success: false, error: 'flagKey required' }, { status: 400 })
    const result = await setFeatureFlag({
      userId: body.userId || 'default',
      flagKey: body.flagKey,
      enabled: !!body.enabled,
      rollout: body.rollout === undefined ? (body.enabled ? 1 : 0) : Number(body.rollout)
    })
    return NextResponse.json({ success: true, flag: result })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}