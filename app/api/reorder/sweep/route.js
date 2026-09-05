import { NextResponse } from 'next/server'
import { findDueReorderNotifications, markReorderNotified, computeScheduledReorderRuns } from '@/lib/reorder/reorder-tracker'
import { triggerAutomationEvent } from '@/lib/automation-engine'
import { getStoredIntegrations } from '@/lib/db/integration-repository'
import { requireRequestUserId } from '@/lib/request-user'

/**
 * Sweeps customer_product_preferences and emits `shopify.reorder_due`
 * automation events for any whose nextEligibleAt <= now.
 *
 * Hit by an external cron (e.g. every 6h), or directly via fetch.
 * Auth: requires either a valid session (via requireRequestUserId) or a
 * matching CRON_SECRET bearer token.
 *
 * New: when `?optimize=true`, defers the trigger for each customer to the
 * hour they typically engage with us (computed from message history).
 */
function authOrCron(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization') || ''
    if (auth === `Bearer ${cronSecret}`) return 'cron'
  }
  return requireRequestUserId(request)
}

export async function POST(request) {
  try {
    const userId = authOrCron(request)
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200)
    const optimize = url.searchParams.get('optimize') === 'true'

    const due = await findDueReorderNotifications({ userId, limit })
    const integrations = await getStoredIntegrations(userId)
    const scheduled = optimize
      ? await computeScheduledReorderRuns({ userId, items: due })
      : due

    let triggered = 0
    for (const pref of scheduled) {
      try {
        if (optimize && pref.sendAt && pref.sendAt.getTime() > Date.now()) {
          // Stash the deferred sendAt so a downstream job can pick it up
          // (the loop's enqueueDelayedStep is not used here for simplicity).
          // For now, skip the deferred ones — caller can poll later.
          continue
        }
        await triggerAutomationEvent('shopify.reorder_due', {
          customer_phone: pref.customerPhone,
          customerPhone: pref.customerPhone,
          customer_name: '',
          shopify_product_id: pref.shopifyProductId,
          shopify_variant_id: pref.shopifyVariantId,
          product_title: pref.productTitle,
          product_handle: pref.productHandle,
          product_image: pref.productImage,
          product_price: pref.productPrice,
          reorder_days: pref.reorderDays,
          last_ordered_at: pref.lastOrderedAt,
          source: pref.source,
          optimal_hour: pref.optimalHour
        }, integrations, userId)

        await markReorderNotified(pref.id)
        triggered++
      } catch (err) {
        console.error('[Reorder Sweep] error for pref', pref.id, err.message)
      }
    }

    const deferred = optimize ? scheduled.filter(s => s.sendAt && s.sendAt.getTime() > Date.now()).length : 0
    return NextResponse.json({ success: true, scanned: due.length, triggered, deferred })
  } catch (error) {
    if (error.status === 401) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}