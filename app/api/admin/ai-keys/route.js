import { NextResponse } from 'next/server'
import { resolveAIKey, saveAIKey, deleteAIKey, validateAIKey } from '@/lib/ai-provider'

/**
 * Manage per-tenant AI provider keys (BYO).
 *
 *   GET    /api/admin/ai-keys?userId=...                       → key status per provider
 *   POST   /api/admin/ai-keys                                  → { userId, provider, apiKey, validate? }
 *   DELETE /api/admin/ai-keys?userId=...&provider=...          → remove BYO key
 *
 * All endpoints require `?token=` matching ADMIN_TOKEN env (if set).
 * Stored keys are encrypted via `lib/encryption` before persisting.
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
  const out = {}
  for (const provider of ['openai', 'gemini']) {
    const resolved = await resolveAIKey({ provider, userId })
    out[provider] = {
      configured: !!resolved.apiKey,
      source: resolved.source,
      lastRotatedAt: resolved.lastRotatedAt
    }
  }
  return NextResponse.json({ success: true, userId, providers: out })
}

export async function POST(request) {
  const denied = await gate(request)
  if (denied) return denied
  try {
    const body = await request.json().catch(() => ({}))
    const userId = body.userId || 'default'
    const provider = String(body.provider || '').toLowerCase()
    const apiKey = String(body.apiKey || '').trim()
    if (!['openai', 'gemini'].includes(provider)) {
      return NextResponse.json({ success: false, error: 'invalid provider' }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'apiKey required' }, { status: 400 })
    }
    if (body.validate !== false) {
      const ok = await validateAIKey({ provider, apiKey })
      if (!ok.ok) {
        return NextResponse.json({ success: false, error: 'validation_failed', reason: ok.reason }, { status: 400 })
      }
    }
    await saveAIKey({ userId, provider, apiKey })
    return NextResponse.json({ success: true, userId, provider, validated: body.validate !== false })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const denied = await gate(request)
  if (denied) return denied
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const provider = String(url.searchParams.get('provider') || '').toLowerCase()
    if (!['openai', 'gemini'].includes(provider)) {
      return NextResponse.json({ success: false, error: 'invalid provider' }, { status: 400 })
    }
    await deleteAIKey({ userId, provider })
    return NextResponse.json({ success: true, userId, provider, removed: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}