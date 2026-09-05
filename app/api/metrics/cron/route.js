import { NextResponse } from 'next/server'
import { queryOne, queryMany } from '@/lib/mysql'

/**
 * Cron latency dashboard.
 *
 *   GET /api/metrics/cron?userId=...&days=7&kind=run-all
 *
 * For each cron kind returns:
 *   - runCount
 *   - avgMs / p50Ms / p95Ms / maxMs
 *   - histogram: [{ bucket: '0-1s', count }, '1-5s', '5-15s', '15-60s', '60s+']
 *   - lastRun / lastDurationMs
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7', 10) || 7, 1), 90)
    const kind = url.searchParams.get('kind') || null

    const where = ['userId = ?', 'ranAt >= DATE_SUB(NOW(), INTERVAL ? DAY)']
    const params = [userId, days]
    if (kind) {
      where.push('kind = ?')
      params.push(kind)
    }
    const whereSql = where.join(' AND ')

    const kinds = await queryMany(
      `SELECT kind,
              COUNT(*) AS runCount,
              AVG(durationMs) AS avgMs,
              MAX(durationMs) AS maxMs
       FROM cron_runs
       WHERE ${whereSql}
       GROUP BY kind
       ORDER BY kind`,
      params
    )

    const buckets = [
      { id: '0-1s', min: 0, max: 1000 },
      { id: '1-5s', min: 1000, max: 5000 },
      { id: '5-15s', min: 5000, max: 15000 },
      { id: '15-60s', min: 15000, max: 60000 },
      { id: '60s+', min: 60000, max: 9_999_999 }
    ]

    const perKind = []
    for (const k of kinds) {
      const r = k
      // Pull durations for this kind so we can compute p50/p95 + histogram
      const durations = await queryMany(
        `SELECT durationMs
         FROM cron_runs
         WHERE ${whereSql} AND kind = ?
         ORDER BY durationMs ASC`,
        [...params, r.kind]
      )
      const ms = durations.map(d => Number(d.durationMs || 0))
      const p = percentile(ms, [50, 95])
      const histogram = buckets.map(b => ({
        bucket: b.id,
        count: ms.filter(x => x >= b.min && x < b.max).length
      }))

      const last = await queryOne(
        `SELECT ranAt, durationMs
         FROM cron_runs
         WHERE ${whereSql} AND kind = ?
         ORDER BY ranAt DESC LIMIT 1`,
        [...params, r.kind]
      )

      perKind.push({
        kind: r.kind,
        runCount: Number(r.runCount || 0),
        avgMs: Math.round(Number(r.avgMs || 0)),
        p50Ms: p[0],
        p95Ms: p[1],
        maxMs: Number(r.maxMs || 0),
        lastRun: last?.ranAt || null,
        lastDurationMs: last?.durationMs ? Number(last.durationMs) : null,
        histogram
      })
    }

    return NextResponse.json({ success: true, days, kind, perKind })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function percentile(sortedAsc, ps) {
  if (!sortedAsc.length) return ps.map(() => 0)
  return ps.map(p => {
    const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length))
    return Math.round(sortedAsc[idx])
  })
}