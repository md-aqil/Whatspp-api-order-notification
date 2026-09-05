import { NextResponse } from 'next/server'
import { getAIUsageSummary } from '@/lib/ai-usage'
import { checkOutboundThrottle } from '@/lib/outbound-throttle'
import { getHmacFailureStats } from '@/lib/security/hmac-failures'
import { getDefaultsVersion } from '@/lib/automation-defaults'
import { getDefaultsFingerprint } from '@/lib/automation-defaults-fingerprint'
import { queryOne } from '@/lib/mysql'

/**
 * GET /api/dashboard?userId=default
 *
 * One-shot unified roll-up for the operator dashboard. Aggregates:
 *   - service health
 *   - webhook delivery freshness + failures
 *   - cron run freshness
 *   - per-tenant AI cost (last 7 / 30d)
 *   - outbound throttle state
 *   - HMAC failure counts
 *   - default-automation fingerprint drift
 *
 * Intended to be called once on dashboard load and cached client-side.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'

    const startedAt = Date.now()
    const [healthRow, cronLast, webhooks, ai7, ai30, throttle, hmac] = await Promise.all([
      queryOne('SELECT 1 AS ok').catch(() => null),
      queryOne(`SELECT kind, ranAt, TIMESTAMPDIFF(MINUTE, ranAt, NOW()) AS ageMin FROM cron_runs ORDER BY ranAt DESC LIMIT 1`).catch(() => null),
      queryOne(
        `SELECT MAX(receivedAt) AS lastAt,
                COUNT(*) AS total7d,
                SUM(CASE WHEN JSON_EXTRACT(payload, '$.error') IS NOT NULL THEN 1 ELSE 0 END) AS errors7d
         FROM webhook_logs WHERE receivedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      ).catch(() => null),
      getAIUsageSummary({ userId, days: 7 }).catch(() => null),
      getAIUsageSummary({ userId, days: 30 }).catch(() => null),
      checkOutboundThrottle({ userId }).catch(() => ({ allowed: true, reason: 'unknown' })),
      getHmacFailureStats({ userId, windowMinutes: 60 }).catch(() => [])
    ])

    const totalMinutes = Math.round((Date.now() - startedAt) / 600) / 100

    return NextResponse.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      userId,
      durationMs: totalMinutes,
      health: {
        db: !!healthRow,
        defaultsVersion: getDefaultsVersion(),
        defaultsFingerprint: getDefaultsFingerprint()
      },
      webhooks: {
        lastAt: webhooks?.lastAt || null,
        total7d: Number(webhooks?.total7d || 0),
        errors7d: Number(webhooks?.errors7d || 0)
      },
      cron: cronLast
        ? { kind: cronLast.kind, ranAt: cronLast.ranAt, ageMinutes: Number(cronLast.ageMin || 0) }
        : null,
      ai: {
        last7d: ai7 ? { calls: ai7.calls, costUsd: ai7.costUsd } : null,
        last30d: ai30 ? { calls: ai30.calls, costUsd: ai30.costUsd, costPerDay: ai30.costPerDay } : null
      },
      throttle,
      hmac: {
        windowMinutes: 60,
        stats: hmac.map(r => ({ kind: r.kind, count: Number(r.cnt || 0), lastAt: r.lastAt }))
      }
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}