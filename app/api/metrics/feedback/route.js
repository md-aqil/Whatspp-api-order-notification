import { NextResponse } from 'next/server'
import { query, queryOne, queryMany } from '@/lib/mysql'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Aggregates feedback (CSAT / NPS) over a date range.
 *
 * Query params:
 *   userId    — tenant id (default 'default')
 *   type      — 'csat' | 'nps' | 'all'
 *   from      — ISO date (default: 30 days ago)
 *   to        — ISO date (default: now)
 *
 * Returns:
 *   {
 *     total, averageScore, distribution: { '1': n, ... },
 *     promoters, passives, detractors, nps_score,        // for nps type
 *     trend: [{ date, averageScore, count }, ...]
 *   }
 */
export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'all'
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const to = toParam ? new Date(toParam) : new Date()

    const where = ['userId = ?', 'createdAt BETWEEN ? AND ?']
    const values = [userId, from, to]
    if (type !== 'all') {
      where.push('feedbackType = ?')
      values.push(type)
    }

    const [summary] = await queryMany(
      `SELECT COUNT(*) AS total,
              AVG(score) AS avgScore
       FROM customer_feedback
       WHERE ${where.join(' AND ')}`,
      values
    )

    const distribution = await queryMany(
      `SELECT score, COUNT(*) AS count
       FROM customer_feedback
       WHERE ${where.join(' AND ')}
       GROUP BY score
       ORDER BY score ASC`,
      values
    )

    const trend = await queryMany(
      `SELECT DATE(createdAt) AS day,
              AVG(score) AS avgScore,
              COUNT(*) AS count
       FROM customer_feedback
       WHERE ${where.join(' AND ')}
       GROUP BY DATE(createdAt)
       ORDER BY day ASC`,
      values
    )

    const total = Number(summary?.total) || 0
    const averageScore = Number(summary?.avgScore) || 0

    let promoters = 0
    let passives = 0
    let detractors = 0
    for (const row of distribution) {
      const score = Number(row.score)
      const count = Number(row.count)
      if (score >= 9) promoters += count
      else if (score >= 7) passives += count
      else detractors += count
    }
    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0

    return NextResponse.json({
      success: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      total,
      averageScore: Number(averageScore.toFixed(2)),
      distribution: distribution.reduce((acc, r) => {
        acc[String(r.score)] = Number(r.count)
        return acc
      }, {}),
      nps: { promoters, passives, detractors, score: npsScore },
      trend: trend.map(r => ({
        date: r.day,
        averageScore: Number(Number(r.avgScore).toFixed(2)),
        count: Number(r.count)
      }))
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}