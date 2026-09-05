import { queryOne } from './mysql'
import { getAIUsageSummary } from './ai-usage'
import { sendNotification } from './notify/notifications'

const DEFAULT_MONTHLY_BUDGET_USD = Number(process.env.AI_BUDGET_USD_DEFAULT || 50)

/**
 * Per-tenant AI budget guard. Reads the `monthlyBudgetUsd` from the
 * `ai_provider_keys.lastRotatedAt`-adjacent `ai_budget` table (one row
 * per userId) and returns whether the next call should be allowed.
 *
 * If the tenant has crossed 80% of budget we also fire a one-shot
 * notification (keyed by current month).
 */
export async function checkAIBudget({ userId = 'default', estimatedCostUsd = 0 } = {}) {
  const budget = await getMonthlyBudget({ userId })
  if (!budget) return { allowed: true, reason: 'no_budget_set' }
  const summary = await getAIUsageSummary({ userId, days: 30 }).catch(() => ({ costUsd: 0 }))
  const projected = Number(summary.costUsd || 0) + Number(estimatedCostUsd || 0)
  if (projected >= budget.monthlyBudgetUsd) {
    return { allowed: false, projected, budget: budget.monthlyBudgetUsd, reason: 'over_budget' }
  }
  await maybeWarnBudget({ userId, projected, budget: budget.monthlyBudgetUsd })
  return { allowed: true, projected, budget: budget.monthlyBudgetUsd, remaining: budget.monthlyBudgetUsd - projected }
}

export async function getMonthlyBudget({ userId = 'default' } = {}) {
  try {
    const row = await queryOne(
      `SELECT monthlyBudgetUsd, updatedAt FROM ai_budget WHERE userId = ? LIMIT 1`,
      [userId]
    )
    if (row) return { userId, monthlyBudgetUsd: Number(row.monthlyBudgetUsd), updatedAt: row.updatedAt }
  } catch (e) {
    // table may not exist yet
  }
  // Fall back to the env default so anonymous tenants get a sensible limit
  if (userId === 'default') return { userId, monthlyBudgetUsd: DEFAULT_MONTHLY_BUDGET_USD }
  return null
}

let warned = new Map()
async function maybeWarnBudget({ userId, projected, budget }) {
  const ratio = projected / budget
  if (ratio < 0.8) return
  const key = `${userId}:${new Date().toISOString().slice(0, 7)}:${ratio >= 1 ? 'over' : '80pct'}`
  if (warned.has(key)) return
  warned.set(key, Date.now())
  try {
    await sendNotification({
      userId,
      channel: 'email',
      kind: 'ai_budget',
      subject: ratio >= 1 ? 'AI budget exceeded' : 'AI budget 80% reached',
      body: `Projected spend this month: $${projected.toFixed(2)} / $${budget.toFixed(2)} (${(ratio * 100).toFixed(0)}%).`
    })
  } catch (e) {
    // best-effort
  }
}

export function clearBudgetWarningCache() {
  warned = new Map()
}