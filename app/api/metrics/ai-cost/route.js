import { NextResponse } from 'next/server'
import { getAIUsageSummary, getGlobalAIUsage } from '@/lib/ai-usage'

/**
 * Per-tenant AI cost dashboard.
 *
 *   GET /api/metrics/ai-cost?userId=...&days=30&scope=tenant
 *
 * scope:
 *   - 'tenant' (default): summary for the given userId
 *   - 'global': top 100 tenants by cost
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365)
    const scope = url.searchParams.get('scope') || 'tenant'
    const expected = process.env.ADMIN_TOKEN || ''
    if (scope === 'global') {
      if (expected) {
        const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
        if (provided !== expected) {
          return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
        }
      }
      const tenants = await getGlobalAIUsage({ days })
      return NextResponse.json({ success: true, days, scope, tenants })
    }
    const userId = url.searchParams.get('userId') || 'default'
    const summary = await getAIUsageSummary({ userId, days })
    return NextResponse.json({ success: true, days, scope, userId, ...summary })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}