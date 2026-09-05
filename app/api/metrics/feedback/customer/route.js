import { NextResponse } from 'next/server'
import { query, queryMany, queryOne } from '@/lib/mysql'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Per-customer feedback history & trend.
 *
 *   GET /api/metrics/feedback/customer?userId=...&phone=...&limit=20
 *
 * Returns the feedback timeline plus a trend (avg score by month).
 */
export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const phone = url.searchParams.get('phone')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100)

    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 })
    }
    const normalized = String(phone).replace(/\D/g, '')

    const history = await queryMany(
      `SELECT id, feedbackType, score, comment, shopifyOrderId, orderNumber, automationId, context, createdAt
       FROM customer_feedback
       WHERE userId = ? AND customerPhone = ?
       ORDER BY createdAt DESC
       LIMIT ?`,
      [userId, normalized, limit]
    )

    const [summary] = await queryMany(
      `SELECT COUNT(*) AS total,
              AVG(score) AS avgScore,
              MAX(score) AS maxScore,
              MIN(score) AS minScore
       FROM customer_feedback
       WHERE userId = ? AND customerPhone = ?`,
      [userId, normalized]
    )

    const trend = await queryMany(
      `SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month,
              AVG(score) AS avgScore,
              COUNT(*) AS count
       FROM customer_feedback
       WHERE userId = ? AND customerPhone = ?
       GROUP BY month
       ORDER BY month ASC
       LIMIT 12`,
      [userId, normalized]
    )

    return NextResponse.json({
      success: true,
      phone: normalized,
      total: Number(summary?.total) || 0,
      averageScore: Number(Number(summary?.avgScore || 0).toFixed(2)),
      maxScore: Number(summary?.maxScore || 0),
      minScore: Number(summary?.minScore || 0),
      trend: trend.map(r => ({
        month: r.month,
        averageScore: Number(Number(r.avgScore).toFixed(2)),
        count: Number(r.count)
      })),
      history: history.map(h => ({
        id: h.id,
        feedbackType: h.feedbackType,
        score: Number(h.score),
        comment: h.comment,
        shopifyOrderId: h.shopifyOrderId,
        orderNumber: h.orderNumber,
        automationId: h.automationId,
        context: h.context ? safeJson(h.context) : null,
        createdAt: h.createdAt
      }))
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function safeJson(v) {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch (e) { return v }
}