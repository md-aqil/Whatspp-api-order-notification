import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * AOV / CLV metrics with monthly trend.
 *
 *   GET /api/metrics/aov?userId=...&months=6
 *
 * Returns:
 *   - aov (avg order value, all-time)
 *   - monthly: [{ month, orders, revenue, aov, uniqueCustomers, newCustomers }]
 *   - topCustomers: [{ phone, totalSpent, totalOrders }]
 */
export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const months = Math.min(Math.max(parseInt(url.searchParams.get('months') || '6', 10) || 6, 1), 24)

    const monthly = await queryMany(
      `SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month,
              COUNT(*) AS orders,
              SUM(CAST(total AS DECIMAL(12,2))) AS revenue,
              AVG(CAST(total AS DECIMAL(12,2))) AS aov,
              COUNT(DISTINCT REGEXP_REPLACE(COALESCE(customerPhone, ''), '[^0-9]', '')) AS uniqueCustomers
       FROM orders
       WHERE userId = ?
         AND createdAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month ASC`,
      [userId, months]
    )

    const newCustomers = await queryMany(
      `SELECT DATE_FORMAT(firstOrderAt, '%Y-%m') AS month,
              COUNT(*) AS newCustomers
       FROM customer_segments
       WHERE userId = ?
         AND firstOrderAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       GROUP BY month`,
      [userId, months]
    )
    const newMap = Object.fromEntries(newCustomers.map(r => [r.month, Number(r.newCustomers)]))

    const overall = monthly.reduce((acc, r) => {
      acc.orders += Number(r.orders)
      acc.revenue += Number(r.revenue || 0)
      return acc
    }, { orders: 0, revenue: 0 })
    const aov = overall.orders > 0 ? overall.revenue / overall.orders : 0

    const topCustomers = await queryMany(
      `SELECT customerPhone, totalSpent, totalOrders, lifetimeTier, lastOrderAt
       FROM customer_segments
       WHERE userId = ? AND totalOrders > 0
       ORDER BY totalSpent DESC
       LIMIT 20`,
      [userId]
    )

    return NextResponse.json({
      success: true,
      months,
      aov: Number(aov.toFixed(2)),
      totalRevenue: Number(overall.revenue.toFixed(2)),
      totalOrders: overall.orders,
      monthly: monthly.map(r => ({
        month: r.month,
        orders: Number(r.orders),
        revenue: Number(Number(r.revenue || 0).toFixed(2)),
        aov: Number(Number(r.aov || 0).toFixed(2)),
        uniqueCustomers: Number(r.uniqueCustomers),
        newCustomers: newMap[r.month] || 0
      })),
      topCustomers: topCustomers.map(c => ({
        phone: c.customerPhone,
        totalSpent: Number(Number(c.totalSpent).toFixed(2)),
        totalOrders: Number(c.totalOrders),
        lifetimeTier: c.lifetimeTier,
        lastOrderAt: c.lastOrderAt
      }))
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}