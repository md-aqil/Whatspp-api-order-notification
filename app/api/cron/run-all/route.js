import { NextResponse } from 'next/server'
import { getClvTrend } from '@/lib/metrics/clv'
import { queryOne } from '@/lib/mysql'

/**
 * GET /api/cron/run-all?userId=...&token=...
 *
 * One-shot endpoint that runs every scheduled sweep in sequence:
 *   1. customer.silence-sweep
 *   2. customer.sweep (win_back / birthday / tier_upgrade)
 *   3. reorder.sweep (with ?optimize=true to defer to each customer's optimal hour)
 *   4. CLV-milestone AOV rollup
 *
 * Token auth: optional `?token=` param, must match CRON_TOKEN env (if set).
 * Designed to be called by a single external cron entry, e.g. every 6 hours.
 */
export async function GET(request) {
  return runAll(request)
}

export async function POST(request) {
  return runAll(request)
}

async function runAll(request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const token = url.searchParams.get('token') || ''

  const expected = process.env.CRON_TOKEN || ''
  if (expected && token !== expected) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
  }

  const origin = url.origin
  const results = {}

  const call = async (path) => {
    try {
      const res = await fetch(`${origin}${path}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, data }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  results.silence = await call(`/api/customer/silence-sweep?userId=${encodeURIComponent(userId)}&days=24`)
  results.customer = await call(`/api/customer/sweep?userId=${encodeURIComponent(userId)}&types=win_back,birthday,tier_upgrade`)
  results.reorder = await call(`/api/reorder/sweep?userId=${encodeURIComponent(userId)}&optimize=true&limit=100`)

  try {
    const trend = await getClvTrend({ userId, months: 6 })
    const last = trend[trend.length - 1] || null
    const prev = trend[trend.length - 2] || null
    const aov = last ? Number(last.aov) : 0
    const prevAov = prev ? Number(prev.aov) : 0
    results.clv = {
      months: trend.length,
      lastMonth: last?.month || null,
      aov,
      aovDelta: aov && prevAov ? Number((aov - prevAov).toFixed(2)) : 0
    }
  } catch (err) {
    results.clv = { error: err.message }
  }

  try {
    const started = Date.now()
    const sweepRun = await queryOne(
      `INSERT INTO cron_runs (userId, kind, payload, durationMs, ranAt) VALUES (?, ?, ?, ?, NOW())`,
      [userId, 'run-all', JSON.stringify(results), Date.now() - started]
    )
    results.runId = sweepRun?.insertId || null
  } catch (err) {
    // table may not exist yet; non-fatal
  }

  return NextResponse.json({ success: true, ranAt: new Date().toISOString(), userId, results })
}