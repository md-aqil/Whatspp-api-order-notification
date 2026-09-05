import { NextResponse } from 'next/server'
import { queryOne, queryMany } from '@/lib/mysql'

/**
 * Health summary for incoming webhooks and outbound idempotency.
 *
 *   GET /api/webhooks/health?userId=...&hours=24
 *
 * Returns:
 *   - lastByType: last delivery per webhook type
 *   - counts: total received per type in the window
 *   - failures: rows whose status indicates an error
 *   - outboundIdempotency: hit/miss counters for the outbound dedupe layer
 *   - health: 'ok' | 'degraded' | 'unknown'
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const hours = Math.min(Math.max(parseInt(url.searchParams.get('hours') || '24', 10) || 24, 1), 168)

    const since = `DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`

    const lastByType = await queryMany(
      `SELECT type, MAX(receivedAt) AS lastReceivedAt, COUNT(*) AS total
       FROM webhook_logs
       WHERE receivedAt >= ${since}
       GROUP BY type
       ORDER BY lastReceivedAt DESC`
    )

    const failures = await queryMany(
      `SELECT type, COUNT(*) AS failures
       FROM webhook_logs
       WHERE receivedAt >= ${since}
         AND (
           JSON_EXTRACT(payload, '$.error') IS NOT NULL
           OR JSON_EXTRACT(payload, '$.status') IN ('error', 'failed')
         )
       GROUP BY type
       ORDER BY failures DESC`
    ).catch(() => [])

    const idempotency = await queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(usedCount > 1) AS duplicatesSuppressed,
         MAX(lastUsedAt) AS lastUsedAt
       FROM outbound_idempotency
       WHERE lastUsedAt >= ${since}`
    ).catch(() => null)

    const latest = lastByType[0]?.lastReceivedAt
    const stalenessMs = latest ? (Date.now() - new Date(latest).getTime()) : null
    let health = 'ok'
    if (!latest) health = 'unknown'
    else if (stalenessMs > 6 * 60 * 60 * 1000) health = 'degraded'

    return NextResponse.json({
      success: true,
      windowHours: hours,
      health,
      stalenessMs,
      lastByType: lastByType.map(r => ({
        type: r.type,
        lastReceivedAt: r.lastReceivedAt,
        total: Number(r.total || 0)
      })),
      failures: failures.map(r => ({ type: r.type, failures: Number(r.failures || 0) })),
      outboundIdempotency: idempotency ? {
        total: Number(idempotency.total || 0),
        duplicatesSuppressed: Number(idempotency.duplicatesSuppressed || 0),
        lastUsedAt: idempotency.lastUsedAt
      } : null
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
