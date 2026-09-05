import { query, queryOne, queryMany } from './mysql'

/**
 * AI usage meter.
 *
 * Records every billable AI call (Gemini + OpenAI) into `ai_usage` and
 * exposes a roll-up API for the dashboard.
 *
 * Pricing (USD per 1K tokens, configurable via env):
 *   GEMINI_INPUT_USD  = 0.000075   (gemini-1.5-flash input)
 *   GEMINI_OUTPUT_USD = 0.0003
 *   OPENAI_INPUT_USD  = 0.0025     (gpt-4o-mini input)
 *   OPENAI_OUTPUT_USD = 0.01
 *
 * Records are inserted fire-and-forget by the caller so the meter never
 * blocks the request path. If `ai_usage` is missing, all calls become
 * no-ops (we don't want a missing table to take down the AI).
 */

const PRICING = {
  gemini: {
    input: Number(process.env.GEMINI_INPUT_USD || 0.000075),
    output: Number(process.env.GEMINI_OUTPUT_USD || 0.0003)
  },
  openai: {
    input: Number(process.env.OPENAI_INPUT_USD || 0.0025),
    output: Number(process.env.OPENAI_OUTPUT_USD || 0.01)
  }
}

export function pricePer1kTokens(provider) {
  return PRICING[provider] || PRICING.gemini
}

export async function recordAIUsage({
  userId = 'default',
  provider = 'gemini',
  model = null,
  feature = null,
  campaignId = null,
  inputTokens = 0,
  outputTokens = 0
} = {}) {
  try {
    const pricing = pricePer1kTokens(provider)
    const cost = (Number(inputTokens) / 1000) * pricing.input + (Number(outputTokens) / 1000) * pricing.output
    await query(
      `INSERT INTO ai_usage (userId, provider, model, feature, campaignId, inputTokens, outputTokens, costUsd, occurredAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, provider, model ? String(model).slice(0, 64) : null, feature ? String(feature).slice(0, 64) : null,
       campaignId ? String(campaignId).slice(0, 255) : null,
       Math.max(0, Number(inputTokens) || 0), Math.max(0, Number(outputTokens) || 0), Number(cost.toFixed(6))]
    )
  } catch (e) {
    // ai_usage missing or other transient error — swallow
  }
}

/**
 * Per-tenant roll-up for a given window.
 */
export async function getAIUsageSummary({ userId = 'default', days = 30 } = {}) {
  const since = `DATE_SUB(NOW(), INTERVAL ${Math.max(1, Math.min(days, 365))} DAY)`
  const summary = await queryOne(
    `SELECT
       COUNT(*) AS calls,
       COALESCE(SUM(inputTokens), 0) AS inputTokens,
       COALESCE(SUM(outputTokens), 0) AS outputTokens,
       COALESCE(SUM(costUsd), 0) AS costUsd
     FROM ai_usage
     WHERE userId = ? AND occurredAt >= ${since}`,
    [userId]
  ).catch(() => null)

  const byProvider = await queryMany(
    `SELECT provider, model,
            COUNT(*) AS calls,
            SUM(inputTokens) AS inputTokens,
            SUM(outputTokens) AS outputTokens,
            SUM(costUsd) AS costUsd
     FROM ai_usage
     WHERE userId = ? AND occurredAt >= ${since}
     GROUP BY provider, model
     ORDER BY costUsd DESC`,
    [userId]
  ).catch(() => [])

  const byFeature = await queryMany(
    `SELECT feature, COUNT(*) AS calls, SUM(costUsd) AS costUsd
     FROM ai_usage
     WHERE userId = ? AND occurredAt >= ${since} AND feature IS NOT NULL
     GROUP BY feature
     ORDER BY costUsd DESC
     LIMIT 20`,
    [userId]
  ).catch(() => [])

  const daily = await queryMany(
    `SELECT DATE_FORMAT(occurredAt, '%Y-%m-%d') AS day,
            COUNT(*) AS calls,
            SUM(costUsd) AS costUsd
     FROM ai_usage
     WHERE userId = ? AND occurredAt >= ${since}
     GROUP BY day
     ORDER BY day ASC`,
    [userId]
  ).catch(() => [])

  return {
    calls: Number(summary?.calls || 0),
    inputTokens: Number(summary?.inputTokens || 0),
    outputTokens: Number(summary?.outputTokens || 0),
    costUsd: Number(Number(summary?.costUsd || 0).toFixed(4)),
    costPerDay: Number((Number(summary?.costUsd || 0) / Math.max(1, days)).toFixed(4)),
    byProvider: byProvider.map(p => ({
      provider: p.provider, model: p.model,
      calls: Number(p.calls || 0),
      inputTokens: Number(p.inputTokens || 0),
      outputTokens: Number(p.outputTokens || 0),
      costUsd: Number(Number(p.costUsd || 0).toFixed(4))
    })),
    byFeature: byFeature.map(f => ({
      feature: f.feature,
      calls: Number(f.calls || 0),
      costUsd: Number(Number(f.costUsd || 0).toFixed(4))
    })),
    daily: daily.map(d => ({
      day: d.day,
      calls: Number(d.calls || 0),
      costUsd: Number(Number(d.costUsd || 0).toFixed(4))
    }))
  }
}

/** All-tenant total — used by the platform-level cost view. */
export async function getGlobalAIUsage({ days = 30 } = {}) {
  const since = `DATE_SUB(NOW(), INTERVAL ${Math.max(1, Math.min(days, 365))} DAY)`
  const rows = await queryMany(
    `SELECT userId,
            COUNT(*) AS calls,
            SUM(inputTokens) AS inputTokens,
            SUM(outputTokens) AS outputTokens,
            SUM(costUsd) AS costUsd
     FROM ai_usage
     WHERE occurredAt >= ${since}
     GROUP BY userId
     ORDER BY costUsd DESC
     LIMIT 100`,
    []
  ).catch(() => [])
  return rows.map(r => ({
    userId: r.userId,
    calls: Number(r.calls || 0),
    inputTokens: Number(r.inputTokens || 0),
    outputTokens: Number(r.outputTokens || 0),
    costUsd: Number(Number(r.costUsd || 0).toFixed(4))
  }))
}