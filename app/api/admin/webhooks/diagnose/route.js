import { NextResponse } from 'next/server'
import { queryMany, queryOne } from '@/lib/mysql'

/**
 * Self-healing webhook-error-resolver.
 *
 *   GET /api/admin/webhooks/diagnose?userId=...&hours=24
 *
 * Walks the recent `webhook_logs` rows whose payload indicates an error,
 * classifies the failure, and proposes a fix. Designed to be safe to call
 * from a cron / on-call runbook.
 *
 * Returns:
 *   {
 *     summary: { total, errors, errorRate, hmacFailures, rateLimited, unknownPayloads, lastErrorAt },
 *     findings: [{ id, type, topic, receivedAt, classifier, severity, message, suggestedFix, canAutoFix }],
 *     canAutoFix: <count>
 *   }
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const hours = Math.min(Math.max(parseInt(url.searchParams.get('hours') || '24', 10) || 24, 1), 168)
    const since = `DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`

    const total = await queryOne(
      `SELECT COUNT(*) AS total FROM webhook_logs WHERE receivedAt >= ${since}`
    ).catch(() => ({ total: 0 }))
    const errored = await queryMany(
      `SELECT id, type, topic, payload, receivedAt
       FROM webhook_logs
       WHERE receivedAt >= ${since}
         AND (
           JSON_EXTRACT(payload, '$.error') IS NOT NULL
           OR JSON_EXTRACT(payload, '$.status') IN ('error', 'failed')
           OR JSON_EXTRACT(payload, '$.hmacValid') = false
         )
       ORDER BY receivedAt DESC
       LIMIT 200`
    )

    const findings = []
    let hmacFailures = 0
    let rateLimited = 0
    let unknownPayloads = 0
    let lastErrorAt = null

    for (const row of errored) {
      const payload = typeof row.payload === 'string' ? safeJson(row.payload) : row.payload
      const { classifier, severity, message, suggestedFix, canAutoFix } = classify(row, payload)
      if (classifier === 'hmac_failure') hmacFailures++
      else if (classifier === 'rate_limited') rateLimited++
      else if (classifier === 'unknown') unknownPayloads++
      if (!lastErrorAt || new Date(row.receivedAt) > new Date(lastErrorAt)) lastErrorAt = row.receivedAt
      findings.push({
        id: row.id,
        type: row.type,
        topic: row.topic,
        receivedAt: row.receivedAt,
        classifier,
        severity,
        message,
        suggestedFix,
        canAutoFix: !!canAutoFix
      })
    }

    const errorCount = findings.length
    const errorRate = total.total > 0 ? errorCount / total.total : 0

    return NextResponse.json({
      success: true,
      hours,
      userId,
      summary: {
        total: Number(total.total || 0),
        errors: errorCount,
        errorRate: Number(errorRate.toFixed(4)),
        hmacFailures,
        rateLimited,
        unknownPayloads,
        lastErrorAt
      },
      findings,
      canAutoFix: findings.filter(f => f.canAutoFix).length
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function safeJson(s) { try { return JSON.parse(s) } catch (e) { return {} } }

function classify(row, payload = {}) {
  // 1) HMAC verification failed
  if (payload.hmacValid === false || payload.error === 'invalid_signature' || /invalid_signature|hmac/i.test(String(payload.error || ''))) {
    return {
      classifier: 'hmac_failure',
      severity: 'high',
      message: 'Webhook HMAC signature did not match. Either the secret was rotated on the source side or a key is wrong.',
      suggestedFix: 'Re-authorize the integration in Settings → Integrations to fetch a fresh webhook secret, or paste the new secret manually. If failures are persistent, /api/admin/integrations/disable will auto-disable the integration after 5 failures within 30 minutes.',
      canAutoFix: false
    }
  }
  // 2) Rate-limited by the source
  if (payload.status === 429 || payload.error === 'rate_limited' || /too many requests|rate limit/i.test(String(payload.error || payload.message || ''))) {
    return {
      classifier: 'rate_limited',
      severity: 'medium',
      message: 'The source is rate-limiting us. Backoff and retry.',
      suggestedFix: 'The delivery worker will retry automatically. If this persists, contact the source platform (Shopify / Meta) or reduce webhook burstiness with our internal queue.',
      canAutoFix: false
    }
  }
  // 3) 5xx from our handler
  if (Number(payload.status) >= 500) {
    return {
      classifier: 'handler_5xx',
      severity: 'high',
      message: 'Our webhook handler returned a 5xx. Likely a code-level bug or transient DB error.',
      suggestedFix: 'Check /api/health and /api/webhooks/health. The webhook is replayable via /api/admin/webhooks/replay once fixed.',
      canAutoFix: false
    }
  }
  // 4) Customer / product not found
  if (/no_such_customer|no such customer|customer_not_found/i.test(String(payload.error || ''))) {
    return {
      classifier: 'unknown_customer',
      severity: 'low',
      message: 'The webhook refers to a customer that does not exist locally yet.',
      suggestedFix: 'Run a one-shot backfill: fetch missing customers from the source and replay the webhook. Usually self-resolves within an hour.',
      canAutoFix: true
    }
  }
  // 5) Order already processed
  if (/already_processed|duplicate|order_exists/i.test(String(payload.error || ''))) {
    return {
      classifier: 'duplicate',
      severity: 'low',
      message: 'This order was already processed (duplicate webhook delivery). Safe to ignore.',
      suggestedFix: 'No action needed — outbound dedupe layer prevented duplicate sends.',
      canAutoFix: true
    }
  }
  // 6) Unknown — surface to a human
  return {
    classifier: 'unknown',
    severity: 'medium',
    message: payload.error || payload.message || 'Unknown error',
    suggestedFix: 'Inspect the raw payload in /dashboard/webhook-logs and file a ticket if reproducible.',
    canAutoFix: false
  }
}