import { NextResponse } from 'next/server'
import { runCartRecoveryRegressionCheck } from '@/lib/metrics/regression-check'

/**
 * POST/GET /api/cron/regression-check?userId=...&dropPct=20
 *
 * One-shot regression check for cart-recovery revenue.
 * Idempotent per ISO week per userId.
 */
export async function POST(request) {
  return run(request)
}
export async function GET(request) {
  return run(request)
}

async function run(request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const dropPct = Math.min(Math.max(parseInt(url.searchParams.get('dropPct') || '20', 10) || 20, 5), 90)
  const result = await runCartRecoveryRegressionCheck({ userId, dropPct })
  return NextResponse.json({ success: true, userId, dropPct, ...result })
}