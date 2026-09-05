import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'

/**
 * GET /api/cron/last-run?userId=...&limit=20
 *
 * Returns the most recent `cron_runs` rows for a quick "is it alive?" check.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 200)

    const rows = await queryMany(
      `SELECT id, kind, payload, ranAt,
              TIMESTAMPDIFF(SECOND, ranAt, NOW()) AS ageSeconds
       FROM cron_runs
       WHERE userId = ?
       ORDER BY ranAt DESC
       LIMIT ?`,
      [userId, limit]
    )

    return NextResponse.json({
      success: true,
      lastRun: rows[0] || null,
      runs: rows.map(r => ({
        id: r.id,
        kind: r.kind,
        ranAt: r.ranAt,
        ageSeconds: r.ageSeconds,
        summary: r.payload ? safeSummary(r.payload) : null
      }))
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function safeSummary(payload) {
  try {
    const obj = typeof payload === 'string' ? JSON.parse(payload) : payload
    return {
      silence: obj?.silence?.ok,
      customer: obj?.customer?.ok,
      reorder: obj?.reorder?.ok,
      aov: obj?.clv?.aov
    }
  } catch (e) {
    return null
  }
}