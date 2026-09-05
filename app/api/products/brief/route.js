import { NextResponse } from 'next/server'
import { queryOne, queryMany } from '@/lib/mysql'

/**
 * 1-page product brief from order history.
 *
 *   GET /api/products/brief?userId=...&productId=...&days=180
 *
 * Returns a Markdown brief covering: top-line stats, seasonal trend,
 * repeat-buyer rate, geographic distribution, and "best for" tagline.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const productId = url.searchParams.get('productId')
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '180', 10) || 180, 7), 730)
    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 })
    }

    const overall = await queryOne(
      `SELECT ANY_VALUE(op.title) AS title,
              ANY_VALUE(op.handle) AS handle,
              ANY_VALUE(op.image) AS image,
              ANY_VALUE(op.price) AS price,
              SUM(op.quantity) AS unitsSold,
              COUNT(DISTINCT op.orderId) AS orders,
              COUNT(DISTINCT o.customerPhone) AS uniqueBuyers,
              SUM(CAST(op.price AS DECIMAL(12,2)) * op.quantity) AS revenue
       FROM order_products op
       JOIN orders o ON o.id = op.orderId
       WHERE op.userId = ? AND op.shopifyProductId = ?
         AND o.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, productId, days]
    )

    if (!overall || Number(overall.unitsSold) === 0) {
      return NextResponse.json({ success: false, error: 'no_data' }, { status: 404 })
    }

    const monthly = await queryMany(
      `SELECT DATE_FORMAT(o.createdAt, '%Y-%m') AS month,
              SUM(op.quantity) AS unitsSold,
              SUM(CAST(op.price AS DECIMAL(12,2)) * op.quantity) AS revenue
       FROM order_products op
       JOIN orders o ON o.id = op.orderId
       WHERE op.userId = ? AND op.shopifyProductId = ?
         AND o.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY month
       ORDER BY month ASC`,
      [userId, productId, days]
    )

    // Repeat-buyer rate: how many buyers bought this product >= 2 times in the window
    const repeat = await queryOne(
      `SELECT
         COUNT(*) AS totalBuyers,
         SUM(CASE WHEN orderCount >= 2 THEN 1 ELSE 0 END) AS repeatBuyers
       FROM (
         SELECT o.customerPhone, COUNT(DISTINCT o.id) AS orderCount
         FROM order_products op
         JOIN orders o ON o.id = op.orderId
         WHERE op.userId = ? AND op.shopifyProductId = ?
           AND o.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY o.customerPhone
       ) t`,
      [userId, productId, days]
    )
    const repeatRate = repeat?.totalBuyers > 0
      ? Number(((Number(repeat.repeatBuyers) / Number(repeat.totalBuyers)) * 100).toFixed(1))
      : 0

    const tier = await queryOne(
      `SELECT lifetimeTier, COUNT(*) AS cnt
       FROM customer_segments cs
       JOIN orders o ON o.customerPhone = cs.customerPhone AND o.userId = cs.userId
       JOIN order_products op ON op.orderId = o.id
       WHERE op.userId = ? AND op.shopifyProductId = ?
         AND o.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY lifetimeTier
       ORDER BY cnt DESC
       LIMIT 1`,
      [userId, productId, days]
    )

    // Best month
    const best = monthly.reduce((a, b) => (Number(b.unitsSold) > Number(a.unitsSold) ? b : a), monthly[0])

    const title = overall.title || `Product #${productId}`
    const price = Number(overall.price || 0)
    const unitsSold = Number(overall.unitsSold || 0)
    const uniqueBuyers = Number(overall.uniqueBuyers || 0)
    const revenue = Number(overall.revenue || 0)
    const aov = unitsSold ? Number((revenue / unitsSold).toFixed(2)) : 0

    const tagline = (() => {
      if (repeatRate >= 35) return `Loyalty magnet — ${repeatRate}% of buyers come back for more.`
      if (tier?.lifetimeTier === 'gold' || tier?.lifetimeTier === 'platinum') return 'A favourite of high-value (gold+) customers — premium positioning opportunity.'
      if (best && Number(best.unitsSold) > unitsSold * 0.4) return `Spiky demand — concentrated in ${best.month}. Plan inventory & promos around it.`
      if (unitsSold < 10) return 'Long-tail product — bundle it with bestsellers to lift AOV.'
      return 'Steady contributor — consider testing cross-sells or subscription pricing.'
    })()

    const md = []
    md.push(`# ${title}`)
    if (overall.image) md.push(`![hero](${overall.image})`)
    md.push(`> ${tagline}`)
    md.push('')
    md.push(`**Window:** last ${days} days`)
    md.push('')
    md.push(`## Snapshot`)
    md.push(`| Metric | Value |`)
    md.push(`|---|---|`)
    md.push(`| Units sold | ${unitsSold.toLocaleString()} |`)
    md.push(`| Orders | ${Number(overall.orders).toLocaleString()} |`)
    md.push(`| Unique buyers | ${uniqueBuyers.toLocaleString()} |`)
    md.push(`| Revenue | ₹${revenue.toLocaleString()} |`)
    md.push(`| Avg. effective price | ₹${aov.toLocaleString()} |`)
    md.push(`| List price | ${price ? '₹' + price.toLocaleString() : '—'} |`)
    md.push(`| Repeat-buyer rate | ${repeatRate}% |`)
    md.push(`| Top buyer tier | ${tier?.lifetimeTier || '—'} |`)
    md.push('')
    md.push(`## Monthly trend`)
    md.push(`| Month | Units | Revenue |`)
    md.push(`|---|---|---|`)
    for (const m of monthly) {
      md.push(`| ${m.month} | ${Number(m.unitsSold).toLocaleString()} | ₹${Number(m.revenue || 0).toLocaleString()} |`)
    }
    md.push('')
    if (best) {
      md.push(`**Peak month:** ${best.month} — ${Number(best.unitsSold).toLocaleString()} units.`)
    }
    md.push('')
    md.push(`## Talking points for sales / WhatsApp`)
    md.push(`- Lead with the **${tier?.lifetimeTier || 'core'}** customer segment when promoting.`)
    if (repeatRate >= 25) md.push(`- Mention the **${repeatRate}% repeat-buyer rate** to build social proof.`)
    md.push(`- Pair with related top-sellers (see /api/products/top-sellers?days=${days}).`)

    return NextResponse.json({
      success: true,
      productId,
      title,
      windowDays: days,
      stats: {
        unitsSold, uniqueBuyers, revenue, repeatRate,
        topTier: tier?.lifetimeTier || null,
        bestMonth: best?.month || null
      },
      tagline,
      markdown: md.join('\n')
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
