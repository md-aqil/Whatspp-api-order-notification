import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'

/**
 * Per-campaign AI cost attribution.
 *
 *   GET /api/metrics/ai-cost/by-campaign?userId=...&days=30
 *
 * Returns one row per campaignId showing calls, tokens, cost, and the
 * top features (the engine's "feature" label we already record).
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365)

    const since = `DATE_SUB(NOW(), INTERVAL ${days} DAY)`
    const rows = await queryMany(
      `SELECT COALESCE(campaignId, '__unattributed__') AS campaignId,
              COUNT(*) AS calls,
              SUM(inputTokens) AS inputTokens,
              SUM(outputTokens) AS outputTokens,
              SUM(costUsd) AS costUsd,
              MAX(occurredAt) AS lastUsedAt
       FROM ai_usage
       WHERE userId = ? AND occurredAt >= ${since}
       GROUP BY campaignId
       ORDER BY costUsd DESC
       LIMIT 100`,
      [userId]
    )

    return NextResponse.json({
      success: true,
      days,
      userId,
      campaigns: rows.map(r => ({
        campaignId: r.campaignId,
        calls: Number(r.calls || 0),
        inputTokens: Number(r.inputTokens || 0),
        outputTokens: Number(r.outputTokens || 0),
        costUsd: Number(Number(r.costUsd || 0).toFixed(4)),
        lastUsedAt: r.lastUsedAt
      }))
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}