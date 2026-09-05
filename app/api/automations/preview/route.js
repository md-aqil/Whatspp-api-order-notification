import { NextResponse } from 'next/server'
import { lintAutomation } from '@/lib/automation-lint'
import { defaultAutomations } from '@/lib/automation-defaults'
import { queryOne } from '@/lib/mysql'

/**
 * POST /api/automations/preview
 *   body: {
 *     automation: { id?, name, steps: [...] },
 *     context:    { [placeholder]: value }
 *   }
 *
 * Returns the dry-run output: every message step rendered with placeholders
 * replaced + a `lint` object describing issues.
 *
 * GET  /api/automations/preview?automationId=...&userId=...&phone=...
 *   → loads the automation + a synthesized context for that phone.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!body.automation || !Array.isArray(body.automation.steps)) {
      return NextResponse.json({ success: false, error: 'automation with steps[] required' }, { status: 400 })
    }
    const ctx = body.context || {}
    const rendered = renderPreview(body.automation, ctx)
    const lint = lintAutomation(body.automation, ctx)
    return NextResponse.json({ success: true, rendered, lint, count: rendered.length })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const automationId = url.searchParams.get('automationId')
  const userId = url.searchParams.get('userId') || 'default'
  const phone = url.searchParams.get('phone') || null
  if (!automationId) {
    return NextResponse.json({ success: false, error: 'automationId required' }, { status: 400 })
  }
  let automation = defaultAutomations.find(a => a.id === automationId) || null
  if (!automation) {
    try {
      const row = await queryOne(`SELECT id, name, steps FROM automations WHERE id = ? LIMIT 1`, [automationId])
      if (row) {
        let steps = row.steps
        if (typeof steps === 'string') {
          try { steps = JSON.parse(steps) } catch (e) { steps = [] }
        }
        automation = { id: row.id, name: row.name, steps: Array.isArray(steps) ? steps : [] }
      }
    } catch (e) {}
  }
  if (!automation) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  const ctx = await buildContextForPhone({ userId, phone })
  const rendered = renderPreview(automation, ctx)
  const lint = lintAutomation(automation, ctx)
  return NextResponse.json({ success: true, automation, context: ctx, rendered, lint, count: rendered.length })
}

function renderPreview(automation, ctx) {
  const out = []
  for (const s of automation.steps || []) {
    if (s.type === 'message' || s.type === 'channel_post' || s.type === 'interactive') {
      const body = s.message || s.body || ''
      out.push({
        stepId: s.id,
        type: s.type,
        channel: s.channel,
        rendered: applyContext(body, ctx),
        original: body,
        hasPlaceholders: /\{\{/.test(body)
      })
    }
  }
  return out
}

function applyContext(text, ctx) {
  if (!text) return ''
  return String(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(ctx, key)) return String(ctx[key])
    return `{{${key}}}`
  })
}

async function buildContextForPhone({ userId, phone }) {
  const ctx = { customer_name: 'Customer', order_number: '#0000' }
  if (!phone) return ctx
  try {
    const { queryOne } = await import('@/lib/mysql')
    const seg = await queryOne(
      `SELECT customerName, totalSpent, totalOrders, lifetimeTier, lastOrderAt
       FROM customer_segments WHERE userId = ? AND customerPhone = ?
       LIMIT 1`,
      [userId, String(phone).replace(/\D/g, '')]
    )
    if (seg?.customerName) ctx.customer_name = seg.customerName
    if (seg?.lifetimeTier) ctx.customer_tier = seg.lifetimeTier
    if (seg?.totalOrders != null) ctx.total_orders = seg.totalOrders
    if (seg?.totalSpent != null) ctx.total_spent = String(seg.totalSpent)
    const ord = await queryOne(
      `SELECT orderNumber, shopifyOrderId, total
       FROM orders WHERE userId = ? AND customerPhone = ?
       ORDER BY createdAt DESC LIMIT 1`,
      [userId, String(phone).replace(/\D/g, '')]
    )
    if (ord?.orderNumber) ctx.order_number = ord.orderNumber
    if (ord?.shopifyOrderId) ctx.shopify_order_id = ord.shopifyOrderId
  } catch (e) {}
  return ctx
}