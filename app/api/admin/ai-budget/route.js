import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/mysql'
import { getMonthlyBudget, checkAIBudget, clearBudgetWarningCache } from '@/lib/ai-budget'

/**
 * Manage per-tenant AI budgets.
 *
 *   GET    /api/admin/ai-budget?userId=...&projectedCost=0
 *           → returns the current budget + projected spend (and a
 *             `wouldAllow` boolean so the operator can dry-run).
 *   POST   /api/admin/ai-budget
 *           body: { userId, monthlyBudgetUsd }
 *   DELETE /api/admin/ai-budget?userId=...   → clear override, revert to env
 */
async function gate(request) {
  const url = new URL(request.url)
  const expected = process.env.ADMIN_TOKEN || ''
  if (!expected) return null
  const provided = url.searchParams.get('token') || request.headers.get('x-admin-token') || ''
  return provided === expected ? null : NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
}

export async function GET(request) {
  const denied = await gate(request)
  if (denied) return denied
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  const budget = await getMonthlyBudget({ userId })
  const projectedCost = Number(url.searchParams.get('projectedCost') || 0)
  const decision = await checkAIBudget({ userId, estimatedCostUsd: projectedCost })
  return NextResponse.json({ success: true, userId, budget, decision })
}

export async function POST(request) {
  const denied = await gate(request)
  if (denied) return denied
  try {
    const body = await request.json().catch(() => ({}))
    const userId = body.userId || 'default'
    const amount = Number(body.monthlyBudgetUsd)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'monthlyBudgetUsd must be > 0' }, { status: 400 })
    }
    await query(
      `INSERT INTO ai_budget (userId, monthlyBudgetUsd)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE monthlyBudgetUsd = VALUES(monthlyBudgetUsd)`,
      [userId, Number(amount.toFixed(2))]
    )
    clearBudgetWarningCache()
    return NextResponse.json({ success: true, userId, monthlyBudgetUsd: Number(amount.toFixed(2)) })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const denied = await gate(request)
  if (denied) return denied
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'default'
  await query(`DELETE FROM ai_budget WHERE userId = ?`, [userId]).catch(() => null)
  clearBudgetWarningCache()
  return NextResponse.json({ success: true, userId, removed: true })
}