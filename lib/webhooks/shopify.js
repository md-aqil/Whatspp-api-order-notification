import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { decrypt } from '../encryption'
import {
  getStoredIntegrations
} from '../db/integration-repository'
import {
  verifyShopifyWebhookHmac,
  buildIdempotencyKey
} from '../webhook-security'
import {
  insertStoredOrder,
  getStoredOrderByShopifyOrderId,
  updateStoredOrderByShopifyOrderId
} from '../db/order-repository'
import {
  insertWebhookLog,
  queryOne,
  queryMany
} from '../mysql'
import {
  triggerAutomationEvent
} from '../automation-engine'
import {
  buildCartRecoveryContext,
  persistCartRecoveryEvent,
  markCartSessionsRecovered,
  cancelPendingCartRecoveryJobs,
  mapCartSessionToContext
} from '../cart-recovery'
import {
  fetchCompleteShopifyOrder,
  extractShopifyOrderCartIdentifiers
} from '../integrations/shopify'
import { markDiscountCodeUsed } from '../coupons/discount-engine'
import { upsertCustomerProductPreference, guessReorderDaysFromProduct } from '../reorder/reorder-tracker'
import { upsertCustomerProfile } from '../customer-profile'
import { findReferralOwner, recordReferralConversion } from '../referrals'
import { handleInventoryRestock } from '../inventory/stock-subscriptions'
import { query } from '../mysql'
import { crossMilestone } from '../metrics/clv'
import {
  getStoredShopifyCustomer,
  upsertStoredShopifyCustomer,
  insertStoredMessage,
  upsertStoredChat,
  getStoredChatByPhone
} from '../db/chat-repository'
import {
  sendWhatsAppMessage,
  sendOrderStatusUpdate,
  sendCODVerificationNotification,
  sendOrderConfirmationNotification,
  buildOrderProductContext
} from '../whatsapp/meta-api'
import {
  extractAndNormalizeShopifyPhone,
  normalizePhoneNumber
} from '../phone-utils'

/**
 * Read the Shopify integration's webhook secret from the integrations row.
 * The secret is stored alongside the access token in the encrypted blob.
 */
function extractShopifyWebhookSecret(shopifyIntegration) {
  if (!shopifyIntegration) return ''
  return (
    shopifyIntegration.webhookSecret ||
    shopifyIntegration.webhook_secret ||
    shopifyIntegration.apiWebhookSecret ||
    ''
  )
}

/**
 * Resolve which user owns a Shopify integration by shop domain
 */
async function resolveShopifyUserId(shopDomain, request) {
  let fallbackUserId = 'default'
  if (request) {
    try {
      const url = new URL(request.url)
      const qUserId = url.searchParams.get('userId')
      if (qUserId) fallbackUserId = qUserId
    } catch (e) {}
  }

  if (!shopDomain) return fallbackUserId

  try {
    // Look up which user has this Shopify shop domain in their integrations
    const rows = await queryMany('SELECT userId, shopify FROM integrations ORDER BY updatedAt DESC')
    for (const row of rows) {
      try {
        let shopifyData = row.shopify
        if (typeof shopifyData === 'string') {
          if (shopifyData.includes(':')) {
            try {
              shopifyData = decrypt(shopifyData)
            } catch (decErr) {}
          }
          try {
            shopifyData = JSON.parse(shopifyData)
          } catch (jsonErr) {}
        }
        if (shopifyData && typeof shopifyData === 'object' && shopifyData.shopDomain) {
          if (String(shopifyData.shopDomain).includes(shopDomain) || shopDomain.includes(shopifyData.shopDomain)) {
            return row.userId
          }
        }
      } catch (e) { /* ignore parse errors */ }
    }
  } catch (e) {
    console.warn('[Shopify Webhook] Could not resolve userId:', e.message)
  }
  return fallbackUserId
}

/**
 * Checks if an order was placed using Cash on Delivery (COD)
 */
function isCashOnDeliveryOrder(orderPayload = {}) {
  const gateways = orderPayload.payment_gateway_names || []
  const hasCodGateway = gateways.some(g => typeof g === 'string' && /cod|cash[ _-]?on[ _-]?delivery|manual/i.test(g))
  const tags = String(orderPayload.tags || '')
  const hasCodTag = /cod|cash[ _-]?on[ _-]?delivery/i.test(tags)
  const isPendingNonCard = orderPayload.financial_status === 'pending' && (!gateways.length || hasCodGateway)

  return hasCodGateway || hasCodTag || isPendingNonCard
}

/**
 * Main handler for Shopify webhooks
 */
export async function handleShopifyWebhook(request) {
  try {
    // 1. Read raw body BEFORE parsing for HMAC verification
    const rawBody = await request.text()
    let body = {}
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch (e) {
      body = {}
    }

    const topic = request.headers.get('x-shopify-topic')
    const shopDomain = request.headers.get('x-shopify-shop-domain')
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256')

    console.log(`[Shopify Webhook] Received ${topic} from ${shopDomain}`)

    // Resolve the user who owns this Shopify integration
    const userId = await resolveShopifyUserId(shopDomain, request)

    // 2. HMAC signature verification (if a webhook secret is configured for this store)
    try {
      const integrations = await getStoredIntegrations(userId)
      const webhookSecret = extractShopifyWebhookSecret(integrations?.shopify)
      if (webhookSecret) {
        const verification = verifyShopifyWebhookHmac(rawBody, hmacHeader, webhookSecret)
        if (!verification.valid) {
          console.warn(`[Shopify Webhook] HMAC verification failed: ${verification.reason}`)
          // Track the failure for the auto-disable threshold helper
          try {
            const { recordHmacFailure } = await import('../security/hmac-failures')
            const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
            await recordHmacFailure({ userId, kind: 'shopify', sourceIp })
          } catch (_) {}
          return NextResponse.json(
            { success: false, error: 'invalid_signature', reason: verification.reason },
            { status: 401 }
          )
        } else {
          // Reset the failure counter on first success since the threshold window
          try {
            const { clearHmacFailures } = await import('../security/hmac-failures')
            await clearHmacFailures({ userId, kind: 'shopify' })
          } catch (_) {}
        }
      }
    } catch (hmacErr) {
      console.warn('[Shopify Webhook] HMAC check error:', hmacErr.message)
    }

    // 3. Idempotency dedupe (per resource × topic × status)
    const resourceId =
      body.id?.toString() ||
      body.order_id?.toString() ||
      body.checkout_id?.toString() ||
      body.cart_token?.toString() ||
      ''
    const idempotencyKey = buildIdempotencyKey({
      userId,
      platform: 'shopify',
      topic,
      resourceId,
      status: body.financial_status || ''
    })

    try {
      // Check recent webhook_logs for the same idempotency key (last 10 minutes)
      const recent = await queryOne(
        `SELECT id FROM webhook_logs
         WHERE type = 'shopify'
           AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$._idempotency_key')) = ?
           AND createdAt >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
         LIMIT 1`,
        [idempotencyKey]
      )
      if (recent) {
        console.log(`[Shopify Webhook] Duplicate suppressed (idem=${idempotencyKey})`)
        return NextResponse.json({ success: true, duplicate: true })
      }
    } catch (idemErr) {
      console.warn('[Shopify Webhook] Idempotency check failed (continuing):', idemErr.message)
    }

    // Log for debugging - scoped to resolved user, with idempotency key embedded
    const logPayload = { ...body, _idempotency_key: idempotencyKey }
    await insertWebhookLog('shopify', topic, logPayload, userId)

    // Handle checkouts
    if (topic === 'checkouts/create' || topic === 'checkouts/update') {
      const checkoutRecovered = body.completed_at ? true : false
      const checkoutEvent = topic === 'checkouts/create'
        ? 'shopify.cart_created'
        : (checkoutRecovered ? 'shopify.cart_recovered' : 'shopify.cart_updated')

      const persistedCart = await persistCartRecoveryEvent({
        userId: userId,
        eventType: checkoutEvent,
        payload: body,
        platformHint: 'shopify',
        metadata: { webhook_topic: topic }
      })

      const cartContext = {
        ...buildCartRecoveryContext(body, 'shopify'),
        ...(persistedCart?.context || {})
      }

      if (persistedCart?.session?.id) {
        cartContext.cart_session_id = persistedCart.session.id
      }

      if (body.triggerAutomation !== false) {
        const integrations = await getStoredIntegrations(userId)
        await triggerAutomationEvent(checkoutEvent, cartContext, integrations, userId)
      }

      if (persistedCart?.cancelledJobs > 0) {
        console.log(`Cancelled ${persistedCart.cancelledJobs} pending cart reminder job(s) after checkout recovery`)
      }

      if (checkoutEvent !== 'shopify.cart_recovered' || persistedCart?.transitionedToRecovered) {
        const automationIntegrations = await getStoredIntegrations(userId)
        await triggerAutomationEvent(
          checkoutEvent,
          cartContext,
          automationIntegrations,
          userId
        )
      }
    }

    // Handle Order Creation
    if (topic === 'orders/create' && body.id) {
      console.log(`=== NEW SHOPIFY ORDER RECEIVED ===`)
      console.log(`Order Number: ${body.order_number || body.name}`)

      const shippingCountry = body.shipping_address?.country_code || body.billing_address?.country_code || ''
      let customerPhone = extractAndNormalizeShopifyPhone(body)

      // If still no phone found, check our customer database
      if (!customerPhone && body.customer?.id) {
        const customerRecord = await getStoredShopifyCustomer(body.customer.id.toString())
        if (customerRecord && customerRecord.phone) {
          customerPhone = normalizePhoneNumber(customerRecord.phone, shippingCountry)
        } else {
          const guestCustomerRecord = await getStoredShopifyCustomer(`guest-${body.customer.id.toString()}`)
          if (guestCustomerRecord && guestCustomerRecord.phone) {
            customerPhone = normalizePhoneNumber(guestCustomerRecord.phone, shippingCountry)
          }
        }
      }

      // If still no phone found, fetch complete order from Shopify API
      if (!customerPhone) {
        try {
          const integrations = await getStoredIntegrations(userId)
          if (integrations?.shopify?.shopDomain) {
            const completeOrder = await fetchCompleteShopifyOrder(integrations.shopify, body.id)
            customerPhone = extractAndNormalizeShopifyPhone(completeOrder)
          }
        } catch (e) {
          console.error('Failed to fetch complete order from Shopify API:', e.message)
        }
      }

      const isCod = isCashOnDeliveryOrder(body)

      const order = {
        id: uuidv4(),
        userId: userId,
        shopifyOrderId: body.id.toString(),
        orderNumber: body.order_number || body.name,
        customerName: body.customer ? `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() : (body.shipping_address?.name || 'Valued Customer'),
        customerEmail: body.customer ? body.customer.email : (body.email || null),
        customerPhone: customerPhone,
        total: body.total_price,
        currency: body.currency,
        status: body.financial_status || (isCod ? 'cod_pending' : 'pending'),
        createdAt: body.created_at && !isNaN(new Date(body.created_at).getTime()) ? new Date(body.created_at) : new Date(),
        updatedAt: body.updated_at && !isNaN(new Date(body.updated_at).getTime()) ? new Date(body.updated_at) : new Date(),
        whatsappSent: false
      }

      await insertStoredOrder(order)

      // Maintain aggregate customer profile (lifetime value, tier, dates)
      try {
        if (customerPhone) {
          const firstName = body.customer?.first_name || ''
          const lastName = body.customer?.last_name || ''
          // Detect referral: customer note "ref:CODE" or note_attributes
          const noteText = body.customer?.note || ''
          const noteAttrRef = (body.note_attributes || []).find((a) => a?.name === 'referral_code')?.value
          const referredBy = noteText.startsWith('ref:') ? noteText.substring(4).trim() : (noteAttrRef || null)

          // Snapshot previous lifetime spend BEFORE the upsert so we can
          // detect a CLV-milestone crossing on this order.
          let previousTotal = 0
          try {
            const prev = await queryOne(
              `SELECT totalSpent FROM customer_segments WHERE userId = ? AND customerPhone = ? LIMIT 1`,
              [userId, customerPhone]
            )
            previousTotal = Number(prev?.totalSpent || 0)
          } catch (_) {}

          await upsertCustomerProfile({
            userId,
            customerPhone,
            orderTotal: parseFloat(body.total_price) || 0,
            currency: body.currency || 'INR',
            orderAt: body.created_at || new Date().toISOString(),
            firstName,
            lastName,
            referredBy
          })

          // Emit a CLV milestone event if the customer just crossed a threshold.
          try {
            const newMilestone = crossMilestone(previousTotal, previousTotal + (parseFloat(body.total_price) || 0))
            if (newMilestone) {
              const postProfile = await queryOne(
                `SELECT totalSpent, totalOrders, lifetimeTier FROM customer_segments WHERE userId = ? AND customerPhone = ? LIMIT 1`,
                [userId, customerPhone]
              )
              await triggerAutomationEvent('customer.clv_milestone', {
                customer_phone: customerPhone,
                customerPhone,
                customer_name: [firstName, lastName].filter(Boolean).join(' '),
                milestone: newMilestone,
                previous_total: previousTotal,
                new_total: postProfile?.totalSpent || 0,
                total_orders: postProfile?.totalOrders || 0,
                lifetime_tier: postProfile?.lifetimeTier || newMilestone,
                order_id: order.id
              }, integrations, userId)
            }
          } catch (milestoneErr) {
            console.warn('[Shopify Webhook] clv-milestone emit failed:', milestoneErr.message)
          }

          // If referred, record the conversion for the referrer
          if (referredBy) {
            try {
              const owner = await findReferralOwner({ code: referredBy })
              if (owner && owner.customerPhone !== customerPhone) {
                await recordReferralConversion({ code: referredBy })
                await triggerAutomationEvent('referral.conversion', {
                  customer_phone: owner.customerPhone,
                  customerPhone: owner.customerPhone,
                  referee_phone: customerPhone,
                  referee_order_id: body.id?.toString(),
                  referral_code: referredBy,
                  order_total: body.total_price
                }, await getStoredIntegrations(userId), userId)
              }
            } catch (refErr) {
              console.warn('[Shopify Webhook] referral conversion tracking failed:', refErr.message)
            }
          }
        }
      } catch (segErr) {
        console.warn('[Shopify Webhook] customer profile upsert failed:', segErr.message)
      }

      // Mark any matching single-use discount code as redeemed (best-effort)
      try {
        const discountCodes = body.discount_codes || []
        for (const dc of discountCodes) {
          if (dc?.code) {
            await markDiscountCodeUsed(dc.code)
          }
        }
      } catch (dcErr) {
        console.warn('[Shopify Webhook] discount mark-used failed:', dcErr.message)
      }

      // Track reorder preferences for each line item (auto-detect consumables)
      // and denormalise per-line-item analytics for fast top-seller queries.
      try {
        const lineItems = body.line_items || []
        for (const item of lineItems) {
          if (!item?.product_id) continue
          const reorderDays = guessReorderDaysFromProduct(item)
          if (reorderDays > 0 && customerPhone) {
            await upsertCustomerProductPreference({
              userId,
              customerPhone,
              shopifyProductId: item.product_id,
              shopifyVariantId: item.variant_id,
              productTitle: item.title || item.name,
              productHandle: '',
              productImage: item.image_url || '',
              productPrice: item.price ? `${body.currency || ''} ${item.price}` : '',
              reorderDays,
              lastOrderedAt: body.created_at || new Date().toISOString(),
              source: 'order'
            })
          }
          await persistOrderLineItem({
            userId,
            orderId: order.id,
            item
          })
        }
      } catch (reorderErr) {
        console.warn('[Shopify Webhook] line-item analytics failed:', reorderErr.message)
      }

      // Handle Cart Recovery matching
      const { checkoutToken, externalCartId } = extractShopifyOrderCartIdentifiers(body)
      if (checkoutToken || externalCartId) {
        const recoveredSessions = await markCartSessionsRecovered({
          userId: userId,
          platform: 'shopify',
          checkoutToken,
          externalCartId,
          recoveredOrderId: order.shopifyOrderId
        })

        if (recoveredSessions.length > 0) {
          await cancelPendingCartRecoveryJobs({
            userId: userId,
            sessionIds: recoveredSessions.map(s => s.id),
            externalCartIds: recoveredSessions.map(s => s.external_cart_id),
            checkoutTokens: recoveredSessions.map(s => s.checkout_token),
            reason: 'cart_recovered_order_created'
          })

          const cartAutomationIntegrations = await getStoredIntegrations(userId)
          for (const session of recoveredSessions) {
            await triggerAutomationEvent('shopify.cart_recovered', {
              ...mapCartSessionToContext(session),
              cart_session_id: session.id,
              recovered_order_id: order.shopifyOrderId,
              status: 'recovered'
            }, cartAutomationIntegrations, userId)
          }
        }
      }

      // Send high-converting WhatsApp interactive notification
      if (customerPhone) {
        const integrations = await getStoredIntegrations(userId)
        if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
          try {
            let result
            let notificationType = 'order_confirmation'
            const idemOpts = { userId, stepType: '', resourceId: order.shopifyOrderId }

            if (isCod) {
              // Send Interactive COD Verification with Quick Reply Confirm/Cancel buttons
              result = await sendCODVerificationNotification(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                customerPhone,
                order,
                { ...idemOpts, stepType: 'cod_verification' }
              )
              notificationType = 'cod_verification'
            } else {
              // Send Rich Order Confirmation with Live Tracking & Support buttons
              result = await sendOrderConfirmationNotification(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                customerPhone,
                order,
                { ...idemOpts, stepType: 'order_confirmation' }
              )
            }

            const sentMessageId = result.messages?.[0]?.id

            await updateStoredOrderByShopifyOrderId(order.shopifyOrderId, {
              whatsappSent: true,
              whatsappMessageId: sentMessageId,
              whatsappSentAt: new Date(),
              updatedAt: new Date()
            })

            await insertStoredMessage({
              id: uuidv4(),
              userId: userId,
              orderId: order.id,
              recipient: customerPhone,
              phone: customerPhone,
              message: isCod ? `[COD Verification Sent] Order #${order.orderNumber}` : `[Order Confirmation Sent] Order #${order.orderNumber}`,
              isCustomer: false,
              timestamp: new Date(),
              whatsappMessageId: sentMessageId,
              status: 'sent',
              sentAt: new Date()
            })

            console.log(`[Shopify Webhook] Successfully sent WhatsApp ${notificationType} to ${customerPhone}`)
          } catch (e) {
            console.error('[Shopify Webhook] Direct WhatsApp notification failed:', e.message)
          }
        }
      }

      if (body.customer?.id && customerPhone) {
        await upsertStoredShopifyCustomer(body.customer.id.toString(), customerPhone)
      }

      // Trigger order confirmation automation for both COD and prepaid orders
      const automationIntegrations = await getStoredIntegrations(userId)
      await triggerAutomationEvent('shopify.order_created', {
        customer_name: order.customerName,
        customerName: order.customerName,
        customerPhone: customerPhone,
        customer_phone: customerPhone,
        order_number: order.orderNumber,
        orderNumber: order.orderNumber,
        financial_status: order.status,
        order_total: order.total,
        orderTotal: order.total,
        total_price: order.total,
        currency: order.currency,
        is_cod: isCod,
        shopify_order_id: order.shopifyOrderId,
        review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
        ...buildOrderProductContext(order)
      }, automationIntegrations, userId)
    }

    // Handle Fulfillments (fulfillments/create, fulfillments/update)
    else if (topic && (topic.startsWith('fulfillments/') || topic === 'fulfillment/create' || topic === 'fulfillment/update')) {
      console.log(`=== SHOPIFY FULFILLMENT RECEIVED: ${topic} ===`)
      const shopifyOrderId = (body.order_id || body.id || '').toString()
      let existingOrder = await getStoredOrderByShopifyOrderId(shopifyOrderId)

      const trackingNumber = body.tracking_number || body.tracking_numbers?.[0] || ''
      const trackingUrl = body.tracking_url || body.tracking_urls?.[0] || (trackingNumber ? `https://track.aftership.com/${trackingNumber}` : '')
      const shipmentStatus = String(body.shipment_status || body.status || '').toLowerCase()
      const isDelivered = shipmentStatus === 'delivered'

      if (existingOrder) {
        const updatedStatus = isDelivered ? 'delivered' : 'fulfilled'
        await updateStoredOrderByShopifyOrderId(shopifyOrderId, {
          status: updatedStatus,
          updatedAt: new Date()
        })
        existingOrder.status = updatedStatus
      }

      const integrations = await getStoredIntegrations(userId)
      const customerPhone = existingOrder?.customerPhone || extractAndNormalizeShopifyPhone(body)

      if (customerPhone && integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
        try {
          const statusLabel = isDelivered ? 'Delivered' : 'In Transit'
          const result = await sendOrderStatusUpdate(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            customerPhone,
            existingOrder || { orderNumber: shopifyOrderId, shopifyOrderId, currency: 'USD', total: '0.00' },
            statusLabel,
            { userId, stepType: `fulfillment:${statusLabel.toLowerCase()}`, resourceId: `${shopifyOrderId}:${statusLabel}` }
          )

          await insertStoredMessage({
            id: uuidv4(),
            userId: userId,
            orderId: existingOrder?.id || null,
            recipient: customerPhone,
            phone: customerPhone,
            message: isDelivered ? `Order #${existingOrder?.orderNumber || shopifyOrderId} delivered! 📦✨` : `Order #${existingOrder?.orderNumber || shopifyOrderId} shipped! Tracking: ${trackingNumber || trackingUrl}`,
            isCustomer: false,
            timestamp: new Date(),
            whatsappMessageId: result.messages?.[0]?.id,
            status: 'sent',
            sentAt: new Date()
          })
        } catch (e) {
          console.error('[Shopify Webhook] Fulfillment WhatsApp notification failed:', e.message)
        }
      }

      const fulfillmentContext = {
        customer_name: existingOrder?.customerName || 'Valued Customer',
        customerName: existingOrder?.customerName || 'Valued Customer',
        customerPhone: customerPhone,
        customer_phone: customerPhone,
        order_number: existingOrder?.orderNumber || shopifyOrderId,
        orderNumber: existingOrder?.orderNumber || shopifyOrderId,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        financial_status: existingOrder?.status || 'fulfilled',
        order_total: existingOrder?.total || '',
        currency: existingOrder?.currency || 'USD',
        review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
        ...(existingOrder ? buildOrderProductContext(existingOrder) : {})
      }

      if (isDelivered) {
        console.log(`[Shopify Webhook] Triggering shopify.order_delivered for order #${fulfillmentContext.order_number}`)
        await triggerAutomationEvent('shopify.order_delivered', fulfillmentContext, integrations, userId)
      } else {
        console.log(`[Shopify Webhook] Triggering shopify.fulfillment_created for order #${fulfillmentContext.order_number}`)
        await triggerAutomationEvent('shopify.fulfillment_created', fulfillmentContext, integrations, userId)
      }

      // Delivery exceptions — fire a separate event for failed / exception shipments
      const exceptionStatuses = ['failure', 'exception', 'returned', 'cancelled', 'address_error']
      if (exceptionStatuses.includes(shipmentStatus)) {
        console.log(`[Shopify Webhook] Triggering shopify.delivery_exception for ${shipmentStatus}`)
        await triggerAutomationEvent('shopify.delivery_exception', {
          ...fulfillmentContext,
          delivery_status: shipmentStatus,
          delivery_exception: true
        }, integrations, userId)
      }
    }

    // Handle Order Updates & Status Changes (orders/updated, orders/fulfilled, orders/paid, orders/cancelled)
    else if (topic && topic.startsWith('orders/') && body.id) {
      console.log(`=== SHOPIFY ORDER UPDATE RECEIVED: ${topic} ===`)
      const shopifyOrderId = body.id.toString()
      const existingOrder = await getStoredOrderByShopifyOrderId(shopifyOrderId)

      const fulfillments = Array.isArray(body.fulfillments) ? body.fulfillments : []
      const latestFulfillment = fulfillments[fulfillments.length - 1]
      const trackingNumber = latestFulfillment?.tracking_number || latestFulfillment?.tracking_numbers?.[0] || ''
      const trackingUrl = latestFulfillment?.tracking_url || latestFulfillment?.tracking_urls?.[0] || (trackingNumber ? `https://track.aftership.com/${trackingNumber}` : '')
      const shipmentStatus = String(latestFulfillment?.shipment_status || '').toLowerCase()
      const fulfillmentStatus = String(body.fulfillment_status || '').toLowerCase()
      const isDelivered = shipmentStatus === 'delivered'
      const isFulfilled = fulfillmentStatus === 'fulfilled' || topic === 'orders/fulfilled' || Boolean(trackingNumber)

      let resolvedStatus = body.financial_status || topic.replace('orders/', '')
      if (isDelivered) resolvedStatus = 'delivered'
      else if (isFulfilled) resolvedStatus = 'fulfilled'

      if (existingOrder) {
        await updateStoredOrderByShopifyOrderId(shopifyOrderId, {
          status: resolvedStatus,
          updatedAt: new Date()
        })
        existingOrder.status = resolvedStatus
      }

      const customerPhone = existingOrder?.customerPhone || extractAndNormalizeShopifyPhone(body)
      const integrations = await getStoredIntegrations(userId)

      if (customerPhone && integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
        try {
          const statusLabel = isDelivered ? 'Delivered' : (isFulfilled ? 'In Transit' : resolvedStatus)
          const result = await sendOrderStatusUpdate(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            customerPhone,
            existingOrder || { orderNumber: body.order_number || body.name || shopifyOrderId, shopifyOrderId, currency: body.currency, total: body.total_price },
            statusLabel,
            { userId, stepType: `order_status:${statusLabel.toLowerCase()}`, resourceId: `${shopifyOrderId}:${statusLabel}` }
          )

          await insertStoredMessage({
            id: uuidv4(),
            userId: userId,
            orderId: existingOrder?.id || null,
            recipient: customerPhone,
            phone: customerPhone,
            message: `Order status update: ${statusLabel}`,
            isCustomer: false,
            timestamp: new Date(),
            whatsappMessageId: result.messages?.[0]?.id,
            status: 'sent',
            sentAt: new Date()
          })
        } catch (e) {
          console.error('[Shopify Webhook] Order status WhatsApp notification failed:', e.message)
        }
      }

      const orderContext = {
        customer_name: existingOrder?.customerName || (body.customer ? `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() : 'Valued Customer'),
        customerName: existingOrder?.customerName || (body.customer ? `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() : 'Valued Customer'),
        customerPhone: customerPhone,
        customer_phone: customerPhone,
        order_number: existingOrder?.orderNumber || body.order_number || body.name,
        orderNumber: existingOrder?.orderNumber || body.order_number || body.name,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        financial_status: resolvedStatus,
        order_total: existingOrder?.total || body.total_price,
        orderTotal: existingOrder?.total || body.total_price,
        currency: existingOrder?.currency || body.currency || 'USD',
        review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
        ...buildOrderProductContext(existingOrder || body)
      }

      if (isDelivered) {
        console.log(`[Shopify Webhook] Triggering shopify.order_delivered for order #${orderContext.order_number}`)
        await triggerAutomationEvent('shopify.order_delivered', orderContext, integrations, userId)
      } else if (isFulfilled || trackingNumber) {
        console.log(`[Shopify Webhook] Triggering shopify.fulfillment_created for order #${orderContext.order_number}`)
        await triggerAutomationEvent('shopify.fulfillment_created', orderContext, integrations, userId)
      }
    }

    // Handle inventory level updates (back-in-stock alerts)
    else if (topic === 'inventory_levels/update' || topic === 'inventory_levels/create') {
      const integrations = await getStoredIntegrations(userId)
      const result = await handleInventoryRestock({
        userId,
        payload: body,
        triggerAutomationEvent,
        integrations
      })
      if (result?.triggered > 0) {
        console.log(`[Shopify Webhook] Back-in-stock alerts sent: ${result.triggered}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shopify webhook processing error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Denormalise a single Shopify line item into the `order_products` table for
 * fast top-seller / cross-sell analytics.
 */
async function persistOrderLineItem({ userId, orderId, item }) {
  if (!orderId || !item?.product_id) return
  try {
    await query(
      `INSERT INTO order_products
        (orderId, userId, shopifyProductId, shopifyVariantId, title, handle, image, price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        userId,
        String(item.product_id),
        item.variant_id ? String(item.variant_id) : null,
        item.title || item.name || '',
        typeof item.handle === 'string' ? item.handle : '',
        item.image_url || item.image || '',
        String(item.price || '0'),
        Number(item.quantity || 1)
      ]
    )
  } catch (err) {
    // fall back to JSON_TABLE-only path: nothing else to do
  }
}

