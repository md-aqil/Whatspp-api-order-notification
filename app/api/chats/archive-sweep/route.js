import { NextResponse } from 'next/server'
import { query, queryMany } from '@/lib/mysql'

/**
 * Conversation auto-archive sweep.
 *
 *   POST /api/chats/archive-sweep?userId=...&days=60&limit=500&dryRun=true
 *
 * Marks chats as archived (=1, archivedAt = NOW()) when their last
 * inbound message is older than `days` AND there is no open order / cart
 * for the same customer.
 */
export async function POST(request) {
  return GET(request)
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const days = Math.max(parseInt(url.searchParams.get('days') || '60', 10) || 60, 7)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 5000)
    const dryRun = url.searchParams.get('dryRun') === 'true'

    const candidates = await queryMany(
      `SELECT c.id, c.userId, c.phone, c.timestamp, c.name
       FROM chats c
       WHERE c.userId = ?
         AND (c.archived IS NULL OR c.archived = 0)
         AND (c.timestamp IS NULL OR c.timestamp < DATE_SUB(NOW(), INTERVAL ? DAY))
         AND NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o.userId = c.userId
             AND o.customerPhone = c.phone
             AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         )
         AND NOT EXISTS (
           SELECT 1 FROM cart_recovery_sessions cs
           WHERE cs.userId = c.userId
             AND cs.customer_phone = c.phone
             AND cs.status IN ('active', 'abandoned')
         )
       LIMIT ?`,
      [userId, days, limit]
    )

    if (dryRun || candidates.length === 0) {
      return NextResponse.json({ success: true, dryRun, candidates: candidates.length, sample: candidates.slice(0, 20) })
    }

    const ids = candidates.map(c => c.id)
    if (ids.length === 0) {
      return NextResponse.json({ success: true, archived: 0 })
    }
    // MySQL doesn't support array params; batch into 100-row IN clauses
    let archived = 0
    for (let i = 0; i < ids.length; i += 100) {
      const slice = ids.slice(i, i + 100)
      const placeholders = slice.map(() => '?').join(',')
      const res = await query(
        `UPDATE chats SET archived = 1, archivedAt = NOW()
         WHERE userId = ? AND id IN (${placeholders})`,
        [userId, ...slice]
      )
      archived += res?.affectedRows || 0
    }

    return NextResponse.json({ success: true, archived, scanned: candidates.length })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}