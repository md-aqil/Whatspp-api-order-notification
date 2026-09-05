import { NextResponse } from 'next/server'
import { query, queryMany } from '@/lib/mysql'

/**
 * Webhook replayer.
 *
 *   POST /api/admin/webhooks/replay
 *     body: {
 *       webhookType: 'shopify' | 'whatsapp' | 'all',
 *       since?: ISO date string (default: 24h ago),
 *       until?: ISO date string (default: now),
 *       ids?:   string[]  (optional — replay specific webhook_logs rows)
 *       limit?: number    (default 100, max 1000)
 *       dryRun?: boolean  (default false)
 *     }
 *
 * Re-dispatches rows from `webhook_logs` to the same handler that originally
 * processed them. Useful for:
 *   - post-incident replay after a code-fix rollout
 *   - migrating a tenant from a sandbox to prod shop
 *   - back-filling analytics when a cron missed a window
 *
 * Requires `?token=` matching ADMIN_TOKEN env (if set).
 *
 * Note: re-running the same handler is safe — most side effects are
 * idempotent (HMAC verify, outbound dedupe, order upsert).
 */
export async function POST(request) {
  return run(request)
}

export async function GET(request) {
  return run(request)
}

async function run(request) {
  const url = new URL(request.url)
  const expected = process.env.ADMIN_TOKEN || ''
  if (expected) {
    const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
    if (provided !== expected) {
      return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
    }
  }

  try {
    const body = await request.json().catch(() => ({}))
    const webhookType = body.webhookType || 'shopify'
    const since = body.since ? new Date(body.since) : new Date(Date.now() - 24 * 60 * 60 * 1000)
    const until = body.until ? new Date(body.until) : new Date()
    const limit = Math.min(parseInt(body.limit || 100, 10) || 100, 1000)
    const dryRun = body.dryRun === true
    const ids = Array.isArray(body.ids) ? body.ids : null

    const where = ['receivedAt BETWEEN ? AND ?']
    const params = [since, until]
    if (ids && ids.length) {
      const placeholders = ids.map(() => '?').join(',')
      where.push(`id IN (${placeholders})`)
      params.push(...ids)
    } else if (webhookType !== 'all') {
      where.push('type = ?')
      params.push(webhookType)
    }
    const whereSql = where.join(' AND ')

    const rows = await queryMany(
      `SELECT id, type, topic, payload, receivedAt
       FROM webhook_logs
       WHERE ${whereSql}
       ORDER BY receivedAt ASC
       LIMIT ?`,
      [...params, limit]
    )

    if (dryRun || rows.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        scanned: rows.length,
        preview: rows.slice(0, 5).map(r => ({ id: r.id, type: r.type, topic: r.topic, receivedAt: r.receivedAt }))
      })
    }

    let succeeded = 0
    let failed = 0
    const failures = []
    for (const row of rows) {
      try {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
        const path = pathForWebhookType(row.type)
        if (!path) {
          failed++
          failures.push({ id: row.id, reason: 'no_handler' })
          continue
        }
        const res = await fetch(`${url.origin}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Replay-Id': row.id,
            'X-Replay-Source': 'webhook-replayer'
          },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          succeeded++
          await query(
            `UPDATE webhook_logs
             SET payload = JSON_SET(COALESCE(payload, '{}'), '$.replayCount', COALESCE(JSON_EXTRACT(payload, '$.replayCount'), 0) + 1)
             WHERE id = ?`,
            [row.id]
          )
        } else {
          failed++
          failures.push({ id: row.id, status: res.status })
        }
      } catch (err) {
        failed++
        failures.push({ id: row.id, error: err.message })
      }
    }

    return NextResponse.json({
      success: true,
      scanned: rows.length,
      succeeded,
      failed,
      failures: failures.slice(0, 50)
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function pathForWebhookType(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('shopify')) return '/api/webhook/shopify'
  if (t.includes('whatsapp')) return '/api/[[...path]]' // catch-all is the Meta inbound handler
  return null
}