import { NextResponse } from 'next/server'
import { findSilentCustomers } from '@/lib/customer-silence'
import { triggerAutomationEvent } from '@/lib/automation-engine'
import { getStoredIntegrations } from '@/lib/db/integration-repository'
import { tagCustomer } from '@/lib/segments/audience'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Sweep silent customers and emit `customer.silence` automation events.
 * Use with the "Win-Back Silent Customer" automation template.
 *
 *   POST /api/customer/silence-sweep?userId=...&days=60&limit=200
 *
 * Each silent customer is also auto-tagged with the `silence_${days}d` segment
 * so they can be retargeted by segment-based campaigns.
 */
export async function POST(request) {
  return GET(request)
}

export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const url = new URL(request.url)
    const days = Math.max(parseInt(url.searchParams.get('days') || '60', 10) || 60, 7)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1000)
    const autoTag = url.searchParams.get('autoTag') !== 'false'

    const silent = await findSilentCustomers({ userId, silenceDays: days, limit })
    const integrations = await getStoredIntegrations(userId)
    let triggered = 0
    let tagged = 0

    for (const c of silent) {
      try {
        await triggerAutomationEvent('customer.silence', {
          customer_phone: c.customerPhone,
          customerPhone: c.customerPhone,
          customer_name: '',
          customer_total_orders: c.totalOrders,
          customer_total_spent: c.totalSpent,
          customer_tier: c.lifetimeTier,
          customer_last_order_at: c.lastOrderAt,
          silence_days: days
        }, integrations, userId)
        triggered++
        if (autoTag) {
          await tagCustomer({
            userId,
            customerPhone: c.customerPhone,
            segmentKey: `silence_${days}d`,
            source: 'silence-sweep',
            ttlDays: 30
          })
          tagged++
        }
      } catch (err) {
        console.error('[Silence Sweep] error:', err.message)
      }
    }

    return NextResponse.json({ success: true, scanned: silent.length, triggered, tagged, silenceDays: days })
  } catch (err) {
    if (err.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}