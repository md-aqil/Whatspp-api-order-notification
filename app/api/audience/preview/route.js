import { NextResponse } from 'next/server'
import { evaluateAudience } from '@/lib/segments/audience'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * POST /api/audience/preview
 * Body: { userId?, rules: [...], limit? }
 * Returns the list of matching customerPhone numbers without persisting.
 */
export async function POST(request) {
  try {
    const userId = requireRequestUserId(request)
    const body = await request.json().catch(() => ({}))
    const rules = Array.isArray(body.rules) ? body.rules : []
    const limit = body.limit || 1000

    const audience = await evaluateAudience({ userId, rules, limit })
    return NextResponse.json({
      success: true,
      count: audience.length,
      audience
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}