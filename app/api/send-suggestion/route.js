import { NextResponse } from 'next/server'
import { queryMany } from '@/lib/mysql'

/**
 * Smart-send suggestions.
 *
 *   GET /api/send-suggestion?userId=...&phone=...&tz=Asia/Kolkata
 *
 * Returns:
 *   - bestHour:    the hour (0-23) the recipient typically engages
 *   - bestDay:     'mon' | 'tue' | ...
 *   - heatmap:     [{ day, hour, count }] 7d x 24h grid of engagement
 *   - confidence:  'low' | 'medium' | 'high' based on sample size
 *   - suggestion:  human-readable recommendation
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const phone = url.searchParams.get('phone')
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '60', 10) || 60, 7), 365)
    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 })
    }
    const normalized = String(phone).replace(/\D/g, '')

    const buckets = await queryMany(
      `SELECT DAYOFWEEK(timestamp) AS dow, HOUR(timestamp) AS hr, COUNT(*) AS cnt
       FROM messages
       WHERE userId = ? AND isCustomer = 1
         AND REGEXP_REPLACE(COALESCE(phone, recipient), '[^0-9]', '') = ?
         AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY dow, hr
       ORDER BY cnt DESC`,
      [userId, normalized, days]
    )

    if (buckets.length === 0) {
      return NextResponse.json({
        success: true,
        phone: normalized,
        bestHour: 10,
        bestDay: 'mon',
        heatmap: [],
        confidence: 'low',
        suggestion: 'No engagement history yet — default to Monday 10am.'
      })
    }

    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const top = buckets[0]
    const bestHour = Number(top.hr)
    const bestDay = dayNames[Number(top.dow) - 1] || 'mon'
    const total = buckets.reduce((acc, b) => acc + Number(b.cnt), 0)
    const confidence = total < 5 ? 'low' : total < 25 ? 'medium' : 'high'

    const heatmap = buckets.map(b => ({
      day: dayNames[Number(b.dow) - 1] || 'sun',
      hour: Number(b.hr),
      count: Number(b.cnt)
    }))

    return NextResponse.json({
      success: true,
      phone: normalized,
      bestHour,
      bestDay,
      heatmap,
      confidence,
      totalSamples: total,
      windowDays: days,
      suggestion: `Send around ${bestHour.toString().padStart(2, '0')}:00 on ${bestDay.toUpperCase()} — that's when this customer usually engages (${total} samples in ${days}d).`
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
