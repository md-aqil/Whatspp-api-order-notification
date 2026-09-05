import { NextResponse } from 'next/server'
import { queryMany, queryOne } from '@/lib/mysql'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Top-selling products across all customers.
 *
 *   GET /api/products/top-sellers?userId=...&days=90&limit=5
 *
 * Returns products the customer has not yet purchased, ordered by global
 * popularity (units sold * revenue). Used by the inactivity template.
 */
export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '90', 10) || 90, 1), 365)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10) || 5, 1), 50)
    const excludePhone = url.searchParams.get('excludePhone')

    const top = await queryMany(
      `SELECT op.shopifyProductId AS productId,
              ANY_VALUE(op.title) AS title,
              ANY_VALUE(op.image) AS image,
              ANY_VALUE(op.handle) AS handle,
              ANY_VALUE(op.variantId) AS variantId,
              ANY_VALUE(op.price) AS price,
              SUM(op.quantity) AS unitsSold,
              COUNT(DISTINCT op.orderId) AS orders,
              SUM(CAST(op.price AS DECIMAL(12,2)) * op.quantity) AS revenue
       FROM order_products op
       JOIN orders o ON o.id = op.orderId
       WHERE o.userId = ?
         AND o.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY op.shopifyProductId
       ORDER BY revenue DESC
       LIMIT ?`,
      [userId, days, limit * 4]
    )

    if (!excludePhone) {
      return NextResponse.json({
        success: true,
        products: top.slice(0, limit).map(p => ({
          productId: p.productId,
          title: p.title,
          image: p.image,
          handle: p.handle,
          variantId: p.variantId,
          price: Number(p.price),
          unitsSold: Number(p.unitsSold),
          orders: Number(p.orders),
          revenue: Number(Number(p.revenue || 0).toFixed(2))
        }))
      })
    }

    const normalized = String(excludePhone).replace(/\D/g, '')
    const purchased = await queryMany(
      `SELECT DISTINCT op.shopifyProductId AS productId
       FROM order_products op
       JOIN orders o ON o.id = op.orderId
       WHERE o.userId = ? AND o.customerPhone = ?`,
      [userId, normalized]
    )
    const purchasedSet = new Set(purchased.map(p => String(p.productId)))
    const filtered = top.filter(p => !purchasedSet.has(String(p.productId))).slice(0, limit)
    return NextResponse.json({
      success: true,
      products: filtered.map(p => ({
        productId: p.productId,
        title: p.title,
        image: p.image,
        handle: p.handle,
        variantId: p.variantId,
        price: Number(p.price),
        unitsSold: Number(p.unitsSold),
        orders: Number(p.orders),
        revenue: Number(Number(p.revenue || 0).toFixed(2))
      }))
    })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}