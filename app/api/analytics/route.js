import { NextResponse } from 'next/server'
import { queryMany, queryOne } from '@/lib/postgres'

export async function GET() {
  try {
    const userId = 'default' // In a real app, get from session

    // 1. Total Messages stats
    const totalMessages = await queryOne('SELECT COUNT(*) as count FROM messages WHERE userId = ?', [userId])
    const customerMessages = await queryOne('SELECT COUNT(*) as count FROM messages WHERE userId = ? AND isCustomer = true', [userId])
    const agentMessages = await queryOne('SELECT COUNT(*) as count FROM messages WHERE userId = ? AND isCustomer = false', [userId])

    // 2. Daily message volume (last 7 days)
    const dailyVolume = await queryMany(`
      SELECT DATE(createdAt) as date, COUNT(*) as count 
      FROM messages 
      WHERE userId = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, [userId])

    // 3. Top Templates used in campaigns
    const topTemplates = await queryMany(`
      SELECT template, COUNT(*) as count 
      FROM campaigns 
      WHERE userId = ?
      GROUP BY template
      ORDER BY count DESC
      LIMIT 5
    `, [userId])

    // 4. Automation triggers (mocking for now as we don't have a logs table for every trigger yet)
    const automationStats = [
      { name: 'Abandoned Cart Recovery', value: 124, growth: '+12%' },
      { name: 'Order Confirmation', value: 850, growth: '+5%' },
      { name: 'Zoho Lead Notification', value: 45, growth: '+18%' }
    ]

    return NextResponse.json({
      summary: {
        total: totalMessages?.count || 0,
        customer: customerMessages?.count || 0,
        agent: agentMessages?.count || 0
      },
      dailyVolume,
      topTemplates,
      automationStats
    })

  } catch (error) {
    console.error('Analytics API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
