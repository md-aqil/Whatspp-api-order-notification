import { NextResponse } from 'next/server'
import { queryOne, queryMany } from '@/lib/mysql'

/**
 * Per-customer AOV / next-order-value forecast.
 *
 *   GET /api/customers/forecast?userId=...&phone=...&limit=50
 *
 * If `phone` is supplied: returns a single customer's forecast + history.
 * Otherwise returns the top `limit` customers (by totalSpent) with their
 * predicted next order value + expected date.
 *
 * Heuristic: rolling 6-month mean with optional trend (last 90d vs prior
 * 90d). No ML — keeps the surface deterministic and inspectable.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const phone = url.searchParams.get('phone')
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 500)

    if (phone) {
      const forecast = await forecastForCustomer({ userId, customerPhone: phone })
      if (!forecast) return NextResponse.json({ success: false, error: 'no_history' }, { status: 404 })
      return NextResponse.json({ success: true, customer: forecast })
    }

    const top = await queryMany(
      `SELECT customerPhone, totalSpent, totalOrders, lifetimeTier, lastOrderAt
       FROM customer_segments
       WHERE userId = ? AND totalOrders > 0
       ORDER BY totalSpent DESC
       LIMIT ?`,
      [userId, limit]
    )

    const rows = []
    for (const c of top) {
      const f = await forecastForCustomer({ userId, customerPhone: c.customerPhone })
      if (f) rows.push(f)
    }
    return NextResponse.json({ success: true, customers: rows })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

async function forecastForCustomer({ userId, customerPhone }) {
  if (!customerPhone) return null
  const normalized = String(customerPhone).replace(/\D/g, '')

  const profile = await queryOne(
    `SELECT customerPhone, totalSpent, totalOrders, lifetimeTier, lastOrderAt, firstOrderAt
     FROM customer_segments WHERE userId = ? AND customerPhone = ?`,
    [userId, normalized]
  )
  if (!profile || Number(profile.totalOrders || 0) === 0) return null

  const orders = await queryMany(
    `SELECT id, total, createdAt
     FROM orders
     WHERE userId = ? AND customerPhone = ?
       AND createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     ORDER BY createdAt ASC`,
    [userId, normalized]
  )
  if (orders.length < 2) {
    return {
      phone: normalized,
      totalOrders: Number(profile.totalOrders),
      totalSpent: Number(profile.totalSpent),
      tier: profile.lifetimeTier,
      lastOrderAt: profile.lastOrderAt,
      predictedNextValue: null,
      predictedNextDate: null,
      confidence: 'low',
      reason: 'insufficient_history'
    }
  }

  // Cadence = median gap between consecutive orders, in days
  const gaps = []
  for (let i = 1; i < orders.length; i++) {
    const a = new Date(orders[i - 1].createdAt).getTime()
    const b = new Date(orders[i].createdAt).getTime()
    if (b > a) gaps.push((b - a) / (24 * 60 * 60 * 1000))
  }
  const medianGap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 90

  // AOV: trailing 6-month mean
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000
  const recent = orders.filter(o => new Date(o.createdAt).getTime() >= sixMonthsAgo)
  const recentMean = recent.length
    ? recent.reduce((acc, o) => acc + Number(o.total || 0), 0) / recent.length
    : Number(orders[orders.length - 1].total || 0)

  // Trend: last 90d mean vs prior 90d
  const now = Date.now()
  const last90 = orders.filter(o => {
    const t = new Date(o.createdAt).getTime()
    return t >= now - 90 * 24 * 60 * 60 * 1000
  })
  const prior90 = orders.filter(o => {
    const t = new Date(o.createdAt).getTime()
    return t >= now - 180 * 24 * 60 * 60 * 1000 && t < now - 90 * 24 * 60 * 60 * 1000
  })
  const lastMean = last90.length ? last90.reduce((a, o) => a + Number(o.total || 0), 0) / last90.length : recentMean
  const priorMean = prior90.length ? prior90.reduce((a, o) => a + Number(o.total || 0), 0) / prior90.length : recentMean
  const trendRatio = priorMean > 0 ? lastMean / priorMean : 1

  const predictedNextValue = Math.max(50, Math.round(recentMean * Math.min(Math.max(trendRatio, 0.6), 1.6)))
  const lastOrderMs = new Date(profile.lastOrderAt || orders[orders.length - 1].createdAt).getTime()
  const predictedNextDate = new Date(lastOrderMs + medianGap * 24 * 60 * 60 * 1000).toISOString()
  const confidence = orders.length < 3 ? 'low' : orders.length < 8 ? 'medium' : 'high'

  return {
    phone: normalized,
    totalOrders: Number(profile.totalOrders),
    totalSpent: Number(profile.totalSpent),
    tier: profile.lifetimeTier,
    lastOrderAt: profile.lastOrderAt,
    medianGapDays: Math.round(medianGap),
    recentAov: Number(recentMean.toFixed(2)),
    trendRatio: Number(trendRatio.toFixed(2)),
    predictedNextValue,
    predictedNextDate,
    confidence
  }
}