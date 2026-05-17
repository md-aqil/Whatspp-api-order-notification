import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
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
  buildOrderProductContext 
} from '../whatsapp/meta-api'

/**
 * Resolve which user owns a Shopify integration by shop domain
 */
async function resolveShopifyUserId(shopDomain, request) {
  let fallbackUserId = 'default'
  if (request) {
    const url = new URL(request.url)
    fallbackUserId = url.searchParams.get('userId') || 'default'
  }

  if (!shopDomain) return fallbackUserId

  try {
    // Look up which user has this Shopify shop domain in their integrations
    const rows = await queryMany('SELECT userId, shopify FROM integrations ORDER BY updatedAt DESC')
    for (const row of rows) {
      try {
        let shopifyData = row.shopify
        if (typeof shopifyData === 'string') {
          shopifyData = JSON.parse(shopifyData)
        }
        // shopify data might be encrypted - try a simple domain match
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
      console.log(`=== NEW ORDER RECEIVED ===`);
      console.log(`Order Number: ${body.order_number}`);
      
      let customerPhone = null;

      if (body.customer && body.customer.phone) {
        customerPhone = body.customer.phone;
      } else if (body.shipping_address && body.shipping_address.phone) {
        customerPhone = body.shipping_address.phone;
      } else if (body.billing_address && body.billing_address.phone) {
        customerPhone = body.billing_address.phone;
      }

      // Additional check for phone numbers in address fields
      if (!customerPhone) {
        const fieldsToCheck = [
          body.shipping_address?.first_name,
          body.shipping_address?.last_name,
          body.shipping_address?.address1,
          body.billing_address?.first_name,
          body.billing_address?.last_name,
          body.customer?.first_name,
          body.customer?.last_name
        ];

        for (const field of fieldsToCheck) {
          if (field && typeof field === 'string') {
            const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
            if (phoneMatch) {
              customerPhone = phoneMatch[0];
              break;
            }
          }
        }
      }

      // If still no phone found, check our customer database
      if (!customerPhone && body.customer && body.customer.id) {
        const customerRecord = await getStoredShopifyCustomer(body.customer.id.toString());
        if (customerRecord && customerRecord.phone) {
          customerPhone = customerRecord.phone;
        } else {
          const guestCustomerRecord = await getStoredShopifyCustomer(`guest-${body.customer.id.toString()}`);
          if (guestCustomerRecord && guestCustomerRecord.phone) {
            customerPhone = guestCustomerRecord.phone;
          }
        }
      }

      // If still no phone found, fetch complete order from Shopify API
      if (!customerPhone) {
        try {
          const integrations = await getStoredIntegrations(userId);
          if (integrations?.shopify?.shopDomain) {
            const completeOrder = await fetchCompleteShopifyOrder(integrations.shopify, body.id);
            customerPhone = completeOrder.customer?.phone || 
                            completeOrder.shipping_address?.phone || 
                            completeOrder.billing_address?.phone;
          }
        } catch (e) {
          console.error('Failed to fetch complete order:', e.message);
        }
      }

      const order = {
        id: uuidv4(),
        userId: userId,
        shopifyOrderId: body.id.toString(),
        orderNumber: body.order_number || body.name,
        customerName: body.customer ? `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() : 'Unknown Customer',
        customerEmail: body.customer ? body.customer.email : null,
        customerPhone: customerPhone,
        total: body.total_price,
        currency: body.currency,
        status: body.financial_status || 'pending',
        lineItems: body.line_items || [],
        createdAt: new Date(body.created_at),
        updatedAt: new Date(body.created_at),
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

      // Send direct WhatsApp notification if phone exists
      if (customerPhone) {
        const integrations = await getStoredIntegrations(userId)
        if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
          try {
            const confirmationMessage = `🎉 *Order Confirmation*\n\n` +
              `Thank you for your order, ${order.customerName}!\n\n` +
              `📋 Order #${order.orderNumber}\n` +
              `💰 Total: ${order.currency} ${order.total}\n` +
              `📦 Status: Processing\n\n` +
              `We'll send you updates as your order progresses. Thank you for choosing us! 🙏`

            const messageData = {
              messaging_product: "whatsapp",
              to: customerPhone.replace(/\D/g, ''),
              type: "text",
              text: { body: confirmationMessage }
            }

            const result = await sendWhatsAppMessage(
              integrations.whatsapp.phoneNumberId,
              integrations.whatsapp.accessToken,
              customerPhone,
              messageData
            )

            await updateStoredOrderByShopifyOrderId(order.shopifyOrderId, {
              whatsappSent: true,
              whatsappMessageId: result.messages?.[0]?.id,
              whatsappSentAt: new Date(),
              updatedAt: new Date()
            })

            await insertStoredMessage({
              id: uuidv4(),
              userId: userId,
              orderId: order.id,
              recipient: customerPhone,
              phone: customerPhone,
              message: confirmationMessage,
              isCustomer: false,
              timestamp: new Date(),
              whatsappMessageId: result.messages?.[0]?.id,
              status: 'sent',
              sentAt: new Date()
            })
          } catch (e) {
            console.error('Direct WhatsApp notification failed:', e.message)
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
        order_number: order.orderNumber,
        financial_status: order.status,
        order_total: order.total,
        currency: order.currency,
        review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
        ...buildOrderProductContext(order)
      }, automationIntegrations, userId)
    }

    // Handle Order Updates
    else if (topic && topic.startsWith('orders/') && body.id) {
      const existingOrder = await getStoredOrderByShopifyOrderId(body.id.toString())
      if (existingOrder) {
        const newStatus = topic.replace('orders/', '')
        await updateStoredOrderByShopifyOrderId(body.id.toString(), {
          status: newStatus,
          updatedAt: new Date()
        })

        if (existingOrder.customerPhone && existingOrder.status !== newStatus) {
          const integrations = await getStoredIntegrations(userId)
          if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
            try {
              const result = await sendOrderStatusUpdate(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                existingOrder.customerPhone,
                existingOrder,
                newStatus
              )

              await insertStoredMessage({
                id: uuidv4(),
                userId: userId,
                orderId: existingOrder.id,
                recipient: existingOrder.customerPhone,
                phone: existingOrder.customerPhone,
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
              customerPhone: existingOrder.customerPhone,
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
              customerPhone: existingOrder.customerPhone,
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
    return NextResponse.json({ success: true })
  }
}
