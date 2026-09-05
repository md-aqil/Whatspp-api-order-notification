import { query, queryMany, queryOne } from './mysql'
import { queryOne as _qOne } from './mysql'

/**
 * Build a structured handoff payload for a customer — last messages, recent
 * orders, LTV, feedback score, detected language — so a human agent starts
 * informed. Returned object is intended to be JSON-stringified and sent as
 * a NOTE to the human agent's CRM/Zoho/Dashboard.
 */
export async function buildHandoffContext({ userId = 'default', customerPhone }) {
  if (!customerPhone) return null
  const normalized = String(customerPhone).replace(/\D/g, '')

  const [profile] = await queryMany(
    `SELECT * FROM customer_segments WHERE userId = ? AND customerPhone = ? LIMIT 1`,
    [userId, normalized]
  )

  const [convMetric] = await queryMany(
    `SELECT * FROM conversation_metrics WHERE userId = ? AND customerPhone = ? LIMIT 1`,
    [userId, normalized]
  )

  const messages = await queryMany(
    `SELECT message, isCustomer, timestamp FROM messages
     WHERE userId = ? AND (phone = ? OR recipient = ?)
     ORDER BY timestamp DESC
     LIMIT 8`,
    [userId, normalized, normalized]
  )

  const orders = await queryMany(
    `SELECT id, orderNumber, status, total, currency, createdAt
     FROM orders
     WHERE userId = ? AND REGEXP_REPLACE(COALESCE(customerPhone, ''), '[^0-9]', '') = ?
     ORDER BY createdAt DESC
     LIMIT 5`,
    [userId, normalized]
  )

  const [lastFeedback] = await queryMany(
    `SELECT score, feedbackType, comment, createdAt
     FROM customer_feedback
     WHERE userId = ? AND customerPhone = ?
     ORDER BY createdAt DESC
     LIMIT 1`,
    [userId, normalized]
  )

  return {
    customer: {
      phone: normalized,
      name: profile?.metadata?.firstName || '',
      lifetimeTier: profile?.lifetimeTier || 'new',
      totalOrders: profile?.totalOrders || 0,
      totalSpent: profile?.totalSpent || 0,
      lastOrderAt: profile?.lastOrderAt || null,
      detectedLanguage: convMetric?.detectedLanguage || 'en',
      lastCSAT: lastFeedback?.score || null
    },
    recentOrders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: `${o.currency || ''} ${o.total || ''}`.trim(),
      placedAt: o.createdAt
    })),
    recentMessages: messages.reverse().map((m) => ({
      direction: m.isCustomer ? 'inbound' : 'outbound',
      text: (m.message || '').substring(0, 280),
      timestamp: m.timestamp
    })),
    handoffAt: new Date().toISOString()
  }
}

/**
 * Persist the handoff bundle to conversation_metrics for later inspection.
 */
export async function recordHandoff({ userId = 'default', customerPhone, context }) {
  if (!customerPhone) return
  const normalized = String(customerPhone).replace(/\D/g, '')
  await query(
    `INSERT INTO conversation_metrics (id, userId, customerPhone, handoffContext, lastInteractionAt, totalInteractions)
     VALUES (?, ?, ?, ?, NOW(), 1)
     ON DUPLICATE KEY UPDATE
       handoffContext = VALUES(handoffContext),
       lastInteractionAt = NOW(),
       totalInteractions = totalInteractions + 1`,
    [`cm_${userId}_${normalized}`, userId, normalized, JSON.stringify(context || {})]
  )
}

/**
 * Returns a human-readable summary suitable for a WhatsApp message back to
 * the customer agent or for stashing in a CRM note.
 */
export function summarizeHandoffForAgent(ctx) {
  if (!ctx) return ''
  const c = ctx.customer
  const lines = [
    `Handoff Context for ${c.phone}:`,
    `Tier: ${c.lifetimeTier} | Orders: ${c.totalOrders} | Spent: ${c.totalSpent}`,
    `Language: ${c.detectedLanguage}`,
    c.lastCSAT ? `Last CSAT: ${c.lastCSAT}/5` : null
  ].filter(Boolean)
  if (ctx.recentOrders?.length) {
    lines.push('Recent orders:')
    ctx.recentOrders.forEach((o) => lines.push(`  - #${o.orderNumber} ${o.status} (${o.total})`))
  }
  if (ctx.recentMessages?.length) {
    lines.push('Last messages:')
    ctx.recentMessages.slice(-5).forEach((m) => {
      const dir = m.direction === 'inbound' ? 'C' : 'A'
      lines.push(`  [${dir}] ${m.text.substring(0, 120)}`)
    })
  }
  return lines.join('\n')
}