import { NextResponse } from 'next/server'
import {
  findLapsedCustomers,
  findBirthdayCustomers,
  findTierUpgradeCandidates
} from '@/lib/customer-profile'
import { triggerAutomationEvent } from '@/lib/automation-engine'
import { getStoredIntegrations } from '@/lib/db/integration-repository'
import { tagCustomer } from '@/lib/segments/audience'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Sweeps customer_segments and emits automation events:
 *   - customer.win_back (60/90/120 days lapsed)
 *   - customer.birthday
 *   - customer.tier_upgrade
 *
 * Hit by an external cron every ~6h. Each sweep also accepts a `type` query
 * param so individual jobs can be triggered separately.
 *
 * Query params:
 *   type     — 'all' (default), 'win_back', 'birthday', 'tier_upgrade'
 *   userId   — tenant id (default 'default')
 *   daysAgo  — for win_back (default 60)
 *   limit    — max records per category (default 100)
 *   autoTag  — 'false' to disable customer_segments_custom auto-tagging
 */
export async function POST(request) {
  return GET(request)
}

export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'all'
    const daysAgo = Math.max(parseInt(url.searchParams.get('daysAgo') || '60', 10) || 60, 7)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500)
    const autoTag = url.searchParams.get('autoTag') !== 'false'
    const typesParam = url.searchParams.get('types') || null

    const integrations = await getStoredIntegrations(userId)
    const results = { win_back: 0, birthday: 0, tier_upgrade: 0, tagged: 0 }

    const wantType = (t) => {
      if (type !== 'all' && type !== t) return false
      if (typesParam) {
        const list = String(typesParam).split(',').map(s => s.trim()).filter(Boolean)
        if (list.length && !list.includes(t)) return false
      }
      return true
    }

    if (wantType('win_back')) {
      const lapsed = await findLapsedCustomers({ userId, daysAgo, limit })
      for (const c of lapsed) {
        try {
          await triggerAutomationEvent('customer.win_back', {
            customer_phone: c.customerPhone,
            customerPhone: c.customerPhone,
            customer_name: '',
            customer_first_order_at: c.firstOrderAt,
            customer_last_order_at: c.lastOrderAt,
            customer_total_orders: c.totalOrders,
            customer_total_spent: c.totalSpent,
            customer_tier: c.lifetimeTier,
            days_since_last_order: daysAgo
          }, integrations, userId)
          results.win_back++
          if (autoTag) {
            await tagCustomer({
              userId, customerPhone: c.customerPhone,
              segmentKey: `winback_${daysAgo}d`, source: 'customer-sweep', ttlDays: 30
            })
            results.tagged++
          }
        } catch (err) {
          console.error('[Customer Sweep] win_back error:', err.message)
        }
      }
    }

    if (wantType('birthday')) {
      const birthdays = await findBirthdayCustomers({ userId })
      for (const c of birthdays) {
        try {
          await triggerAutomationEvent('customer.birthday', {
            customer_phone: c.customerPhone,
            customerPhone: c.customerPhone,
            customer_name: '',
            customer_tier: c.lifetimeTier,
            customer_total_spent: c.totalSpent
          }, integrations, userId)
          results.birthday++
          if (autoTag) {
            await tagCustomer({
              userId, customerPhone: c.customerPhone,
              segmentKey: 'birthday_today', source: 'customer-sweep', ttlDays: 7
            })
            results.tagged++
          }
        } catch (err) {
          console.error('[Customer Sweep] birthday error:', err.message)
        }
      }
    }

    if (wantType('tier_upgrade')) {
      const recent = await findTierUpgradeCandidates({ userId, limit })
      for (const c of recent) {
        try {
          await triggerAutomationEvent('customer.tier_upgrade', {
            customer_phone: c.customerPhone,
            customerPhone: c.customerPhone,
            customer_name: '',
            customer_tier: c.lifetimeTier,
            customer_total_spent: c.totalSpent,
            customer_total_orders: c.totalOrders
          }, integrations, userId)
          results.tier_upgrade++
          if (autoTag) {
            await tagCustomer({
              userId, customerPhone: c.customerPhone,
              segmentKey: `tier_${c.lifetimeTier}`, source: 'customer-sweep', ttlDays: 60
            })
            results.tagged++
          }
        } catch (err) {
          console.error('[Customer Sweep] tier_upgrade error:', err.message)
        }
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    if (error.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}