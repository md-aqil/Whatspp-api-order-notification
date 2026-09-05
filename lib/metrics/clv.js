/**
 * AOV / CLV helpers.
 *
 * - getClvTrend({ userId, months })              → monthly revenue + AOV
 * - findClvMilestoneCandidates({ userId, ... })  → customers whose lastOrderTotal
 *                                                 crossed one of the thresholds
 * - getClvMilestoneThresholds()                  → ordered list (largest first)
 */

export const DEFAULT_CLV_MILESTONES = [
  { id: 'platinum', minSpend: 25000, label: 'Platinum' },
  { id: 'gold', minSpend: 10000, label: 'Gold' },
  { id: 'silver', minSpend: 3000, label: 'Silver' },
  { id: 'bronze', minSpend: 500, label: 'Bronze' }
]

export function getClvMilestoneThresholds() {
  return DEFAULT_CLV_MILESTONES
}

export async function getClvTrend({ userId = 'default', months = 6 } = {}) {
  try {
    const { queryMany } = await import('../mysql')
    return await queryMany(
      `SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month,
              COUNT(*) AS orders,
              SUM(CAST(total AS DECIMAL(12,2))) AS revenue,
              AVG(CAST(total AS DECIMAL(12,2))) AS aov,
              COUNT(DISTINCT REGEXP_REPLACE(COALESCE(customerPhone, ''), '[^0-9]', '')) AS uniqueCustomers
       FROM orders
       WHERE userId = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month ASC`,
      [userId, months]
    )
  } catch (e) {
    return []
  }
}

/**
 * After an order webhook updates `customer_segments.totalSpent`, this helper
 * detects whether the customer just crossed a milestone tier (lifetime).
 *
 *   crossMilestone('1234567890', 10500, { previousSpent: 8500 })
 *
 * Returns the new tier id (e.g. 'gold') or null when no tier was crossed.
 */
export function crossMilestone(previousSpent, newSpent) {
  const prev = Number(previousSpent || 0)
  const next = Number(newSpent || 0)
  if (next <= prev) return null
  for (const tier of DEFAULT_CLV_MILESTONES) {
    if (prev < tier.minSpend && next >= tier.minSpend) return tier.id
  }
  return null
}