import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { decrypt } from '../encryption'
import {
  getStoredIntegrations
} from '../db/integration-repository'
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
    const body = await request.json()
    const topic = request.headers.get('x-shopify-topic')
    const shopDomain = request.headers.get('x-shopify-shop-domain')

    console.log(`[Shopify Webhook] Received ${topic} from ${shopDomain}`)

    // Resolve the user who owns this Shopify integration
    const userId = await resolveShopifyUserId(shopDomain, request)

    // Log for debugging - scoped to resolved user
    await insertWebhookLog('shopify', topic, body, userId)

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

            if (isCod) {
              // Send Interactive COD Verification with Quick Reply Confirm/Cancel buttons
              result = await sendCODVerificationNotification(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                customerPhone,
                order
              )
              notificationType = 'cod_verification'
            } else {
              // Send Rich Order Confirmation with Live Tracking & Support buttons
              result = await sendOrderConfirmationNotification(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                customerPhone,
                order
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

      const automationIntegrations = await getStoredIntegrations(userId)
      await triggerAutomationEvent('shopify.order_created', {
        customer_name: order.customerName,
        customerPhone: customerPhone,
        customer_phone: customerPhone,
        order_number: order.orderNumber,
        financial_status: order.status,
        order_total: order.total,
        currency: order.currency,
        is_cod: isCod,
        shopify_order_id: order.shopifyOrderId,
        review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
        ...buildOrderProductContext(order)
      }, automationIntegrations, userId)
    }

    // Handle Order Updates & Fulfillments
    else if (topic && topic.startsWith('orders/') && body.id) {
      const existingOrder = await getStoredOrderByShopifyOrderId(body.id.toString())
      if (existingOrder) {
        const newStatus = topic.replace('orders/', '')
        await updateStoredOrderByShopifyOrderId(body.id.toString(), {
          status: newStatus,
          updatedAt: new Date()
        })

        const customerPhone = existingOrder.customerPhone || extractAndNormalizeShopifyPhone(body)

        if (customerPhone && existingOrder.status !== newStatus) {
          const integrations = await getStoredIntegrations(userId)
          if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
            try {
              const result = await sendOrderStatusUpdate(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                customerPhone,
                existingOrder,
                newStatus
              )

              await insertStoredMessage({
                id: uuidv4(),
                userId: userId,
                orderId: existingOrder.id,
                recipient: customerPhone,
                phone: customerPhone,
                message: `Order status update: ${newStatus}`,
                isCustomer: false,
                timestamp: new Date(),
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              })
            } catch (e) {
              console.error('Status update notification failed:', e.message)
            }
          }

          const trackingNumber = body.fulfillments?.[0]?.tracking_number || body.fulfillments?.[0]?.tracking_numbers?.[0] || ''
          const trackingUrl = body.fulfillments?.[0]?.tracking_url || body.fulfillments?.[0]?.tracking_urls?.[0] || ''
          const automationIntegrations = await getStoredIntegrations(userId)

          if (trackingNumber || topic === 'orders/fulfilled') {
            await triggerAutomationEvent('shopify.fulfillment_created', {
              customer_name: existingOrder.customerName,
              customerPhone: customerPhone,
              customer_phone: customerPhone,
              order_number: existingOrder.orderNumber,
              tracking_number: trackingNumber,
              tracking_url: trackingUrl,
              financial_status: newStatus,
              review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
              ...buildOrderProductContext(existingOrder)
            }, automationIntegrations, userId)
          }

          if (topic === 'orders/fulfilled') {
            await triggerAutomationEvent('shopify.order_delivered', {
              customer_name: existingOrder.customerName,
              customerPhone: customerPhone,
              customer_phone: customerPhone,
              order_number: existingOrder.orderNumber,
              tracking_number: trackingNumber,
              tracking_url: trackingUrl,
              financial_status: newStatus,
              review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
              ...buildOrderProductContext(existingOrder)
            }, automationIntegrations, userId)
          }
        }
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
