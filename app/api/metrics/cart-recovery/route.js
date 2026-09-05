import { NextResponse } from 'next/server'
import { queryMany, queryOne } from '@/lib/mysql'

/**
 * Cart-recovery uplift calculator.
 *
 *   GET /api/metrics/cart-recovery?userId=...&days=30
 *
 * Compares carts that were abandoned vs. recovered, computes revenue
 * captured by the automation, weekly trend, and a $/week headline number
 * for the dashboard.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 7), 365)

    const summary = await queryOne(
      `SELECT
         COUNT(*) AS totalCarts,
         SUM(status = 'abandoned') AS abandoned,
         SUM(status = 'recovered') AS recovered,
         SUM(recovered_at IS NOT NULL) AS recoveredAny,
         COALESCE(AVG(CASE WHEN status = 'recovered' AND recovered_at IS NOT NULL
           THEN TIMESTAMPDIFF(MINUTE, abandoned_at, recovered_at) END), 0) AS avgMinutesToRecover
       FROM cart_recovery_sessions
       WHERE userId = ?
         AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days]
    )

    const weekly = await queryMany(
      `SELECT
         DATE_FORMAT(createdAt, '%x-W%v') AS week,
         COUNT(*) AS total,
         SUM(status = 'recovered') AS recovered
       FROM cart_recovery_sessions
       WHERE userId = ?
         AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY week
       ORDER BY week ASC`,
      [userId, days]
    )

    // Estimated revenue saved = sum of recovered-order totals that fall in window
    const revenueRow = await queryOne(
      `SELECT COALESCE(SUM(CAST(o.total AS DECIMAL(12,2))), 0) AS recoveredRevenue,
              COUNT(DISTINCT o.id) AS recoveredOrders
       FROM orders o
       JOIN cart_recovery_sessions crs
         ON crs.userId = o.userId
        AND crs.recovered_order_id = o.id
       WHERE o.userId = ?
         AND crs.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days]
    )

    const total = Number(summary?.totalCarts || 0)
    const recovered = Number(summary?.recovered || 0)
    const recoveryRate = total > 0 ? recovered / total : 0

    // If we have at least 4 weekly data points, compute the trailing delta
    let trend = null
    if (weekly.length >= 2) {
      const last = weekly[weekly.length - 1]
      const prev = weekly[weekly.length - 2]
      const delta = Number(last.recovered || 0) - Number(prev.recovered || 0)
      trend = { current: Number(last.recovered || 0), previous: Number(prev.recovered || 0), delta }
    }

    return NextResponse.json({
      success: true,
      days,
      summary: {
        totalCarts: total,
        abandoned: Number(summary?.abandoned || 0),
        recovered,
        recoveryRate: Number(recoveryRate.toFixed(4)),
        avgMinutesToRecover: Number(summary?.avgMinutesToRecover || 0),
        recoveredOrders: Number(revenueRow?.recoveredOrders || 0),
        recoveredRevenue: Number(Number(revenueRow?.recoveredRevenue || 0).toFixed(2)),
        revenuePerWeek: Number((Number(revenueRow?.recoveredRevenue || 0) / Math.max(1, Math.ceil(days / 7))).toFixed(2))
      },
      trend,
      weekly: weekly.map(w => ({
        week: w.week,
        total: Number(w.total || 0),
        recovered: Number(w.recovered || 0)
      }))
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}