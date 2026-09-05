import { NextResponse } from 'next/server'
import { buildHandoffContext, summarizeHandoffForAgent } from '@/lib/handoff-context'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * GET /api/conversation/summary?userId=...&phone=...&format=agent
 *
 * Returns a structured handoff bundle (profile, recent orders, last 8 messages,
 * last CSAT, language) and (optionally) a ready-to-paste agent summary.
 */
export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const phone = url.searchParams.get('phone')
    const format = url.searchParams.get('format') || 'json'

    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 })
    }

    const ctx = await buildHandoffContext({ userId, customerPhone: phone })
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'no_data' }, { status: 404 })
    }

    if (format === 'agent') {
      return NextResponse.json({
        success: true,
        phone: ctx.customer.phone,
        summary: summarizeHandoffForAgent(ctx),
        raw: ctx
      })
    }
    return NextResponse.json({ success: true, context: ctx })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}