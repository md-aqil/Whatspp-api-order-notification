import { NextResponse } from 'next/server'
import { pickModel, getCatalog } from '@/lib/ai-router'

/**
 * GET /api/admin/ai-router?feature=chat&minQuality=0.5
 *   → returns the picked model + the catalog (with prices + quality).
 *
 * POST /api/admin/ai-router
 *   body: { feature, minQuality, preferCheapWithin, expectedOutputTokens }
 *   → same as GET but with the request body (handy for dashboards).
 */
export async function GET(request) {
  const url = new URL(request.url)
  const feature = url.searchParams.get('feature') || 'chat'
  const minQuality = Number(url.searchParams.get('minQuality') || 0.5)
  const preferCheapWithin = Number(url.searchParams.get('preferCheapWithin') || 0.10)
  const expectedOutputTokens = Number(url.searchParams.get('expectedOutputTokens') || 200)
  const decision = pickModel({ feature, minQuality, preferCheapWithin, expectedOutputTokens })
  return NextResponse.json({ success: true, feature, minQuality, preferCheapWithin, expectedOutputTokens, catalog: getCatalog(), decision })
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const decision = pickModel({
      feature: body.feature || 'chat',
      minQuality: Number(body.minQuality || 0.5),
      preferCheapWithin: Number(body.preferCheapWithin || 0.10),
      expectedOutputTokens: Number(body.expectedOutputTokens || 200)
    })
    return NextResponse.json({ success: true, ...decision, catalog: getCatalog() })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}