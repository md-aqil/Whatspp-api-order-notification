import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'

/**
 * Per-template performance ranking.
 *
 *   GET /api/metrics/templates?userId=...&days=30&limit=50
 *
 * For each outbound template we report sent / read / response / order-attribution
 * counts and rates. "Order-attribution" = did the recipient place an order
 * within 7d of the send?
 *
 * Powers the "Template Leaderboard" widget in the dashboard.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200)
    const attributionWindow = 7

    const rows = await queryMany(
      `SELECT m.template,
              m.templateLanguage,
              m.messageType,
              COUNT(*) AS sent,
              SUM(CASE WHEN m.status = 'read' THEN 1 ELSE 0 END) AS read,
              SUM(CASE WHEN m.isCustomer = 1 THEN 1 ELSE 0 END) AS responses,
              COUNT(DISTINCT m.recipient) AS uniqueRecipients,
              COUNT(DISTINCT o.id) AS attributedOrders,
              COALESCE(SUM(CAST(o.total AS DECIMAL(12,2))), 0) AS attributedRevenue
       FROM messages m
       LEFT JOIN orders o
         ON o.userId = m.userId
        AND o.customerPhone = REGEXP_REPLACE(COALESCE(m.phone, m.recipient), '[^0-9]', '')
        AND o.createdAt BETWEEN m.sentAt AND DATE_ADD(m.sentAt, INTERVAL ? DAY)
       WHERE m.userId = ?
         AND m.isCustomer = 0
         AND m.template IS NOT NULL
         AND m.template <> ''
         AND m.sentAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY m.template, m.templateLanguage, m.messageType
       ORDER BY sent DESC
       LIMIT ?`,
      [attributionWindow, userId, days, limit]
    )

    const ranked = rows.map(r => {
      const sent = Number(r.sent || 0)
      const read = Number(r.read || 0)
      const responses = Number(r.responses || 0)
      const attributedOrders = Number(r.attributedOrders || 0)
      const attributedRevenue = Number(r.attributedRevenue || 0)
      return {
        template: r.template,
        templateLanguage: r.templateLanguage,
        messageType: r.messageType,
        sent,
        uniqueRecipients: Number(r.uniqueRecipients || 0),
        read,
        responses,
        attributedOrders,
        attributedRevenue: Number(attributedRevenue.toFixed(2)),
        readRate: sent ? Number((read / sent).toFixed(4)) : 0,
        responseRate: sent ? Number((responses / sent).toFixed(4)) : 0,
        conversionRate: sent ? Number((attributedOrders / sent).toFixed(4)) : 0,
        revenuePerSend: sent ? Number((attributedRevenue / sent).toFixed(2)) : 0
      }
    })

    // Simple composite "engagement score" = 0.4*readRate + 0.4*responseRate + 0.2*conversionRate
    const withScore = ranked.map(r => ({
      ...r,
      engagementScore: Number(((0.4 * r.readRate) + (0.4 * r.responseRate) + (0.2 * r.conversionRate)).toFixed(4))
    }))
    withScore.sort((a, b) => b.engagementScore - a.engagementScore)

    return NextResponse.json({
      success: true,
      days,
      attributionWindowDays: attributionWindow,
      total: ranked.length,
      templates: withScore
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
