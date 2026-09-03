import { NextResponse } from 'next/server'
import { getStoredIntegrations } from '@/lib/db/integration-repository'
import { fetchShopifyCustomers, fetchShopifyOrders } from '@/lib/integrations/shopify'
import { queryMany } from '@/lib/mysql'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const session = await getSession()
    const userId = session?.user?.id || 'default'

    const integrations = await getStoredIntegrations(userId)
    const contactsMap = new Map()

    // 1. Fetch from Shopify if integrated
    if (
      integrations?.shopify?.shopDomain &&
      (integrations?.shopify?.accessToken || integrations?.shopify?.clientId || integrations?.shopify?.clientSecret)
    ) {
      try {
        const [customers, orders] = await Promise.all([
          fetchShopifyCustomers(integrations.shopify).catch(e => { console.warn('[Shopify Customers]', e.message); return [] }),
          fetchShopifyOrders(integrations.shopify).catch(e => { console.warn('[Shopify Orders]', e.message); return [] })
        ])

        // Process Shopify Customers
        customers.forEach(c => {
          const rawPhone = String(c.phone || c.default_address?.phone || '').replace(/\D/g, '')
          if (rawPhone.length >= 10) {
            contactsMap.set(rawPhone, {
              id: `shopify-cust-${c.id}`,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Shopify Customer',
              phone: rawPhone,
              email: c.email || '',
              ordersCount: c.orders_count || 0,
              totalSpent: c.total_spent || '0.00',
              lastOrderDate: c.updated_at || c.created_at,
              source: 'shopify_customer'
            })
          }
        })

        // Process Shopify Orders (captures customers who entered phone in shipping address)
        orders.forEach(o => {
          const rawPhone = String(o.phone || o.customer?.phone || o.shipping_address?.phone || o.billing_address?.phone || '').replace(/\D/g, '')
          if (rawPhone.length >= 10) {
            const custName = o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : (o.shipping_address?.name || 'Store Buyer')
            const existing = contactsMap.get(rawPhone)
            if (existing) {
              if (o.created_at && (!existing.lastOrderDate || new Date(o.created_at) > new Date(existing.lastOrderDate))) {
                existing.lastOrderDate = o.created_at
              }
              if (custName && existing.name === 'Shopify Customer') {
                existing.name = custName
              }
            } else {
              contactsMap.set(rawPhone, {
                id: `shopify-order-${o.id}`,
                name: custName || 'Store Buyer',
                phone: rawPhone,
                email: o.email || o.customer?.email || '',
                ordersCount: 1,
                totalSpent: o.total_price || '0.00',
                lastOrderDate: o.created_at,
                source: 'shopify_order'
              })
            }
          }
        })
      } catch (err) {
        console.error('[API Customers] Error fetching from Shopify:', err)
      }
    }

    // 2. Fetch from Database Chats
    try {
      const dbChats = await queryMany('SELECT id, name, phone, timestamp, lastMessage FROM chats WHERE userId = ? OR userId = "default"', [userId])
      dbChats.forEach(c => {
        if (c.phone) {
          const raw = String(c.phone).replace(/\D/g, '')
          if (raw.length >= 10 && !contactsMap.has(raw)) {
            contactsMap.set(raw, {
              id: `chat-${c.id || raw}`,
              name: c.name || 'WhatsApp Contact',
              phone: raw,
              email: '',
              ordersCount: 0,
              totalSpent: '0.00',
              lastOrderDate: c.timestamp,
              source: 'chat'
            })
          }
        }
      })
    } catch (e) {
      console.warn('[API Customers] DB chats warning:', e.message)
    }

    // 3. Fetch from Database Orders
    try {
      const dbOrders = await queryMany('SELECT id, orderNumber, customerName, customerPhone, phone, total, createdAt FROM orders WHERE userId = ? OR userId = "default"', [userId])
      dbOrders.forEach(o => {
        const p = o.customerPhone || o.phone
        if (p) {
          const raw = String(p).replace(/\D/g, '')
          if (raw.length >= 10) {
            const existing = contactsMap.get(raw)
            if (!existing) {
              contactsMap.set(raw, {
                id: `db-order-${o.id}`,
                name: o.customerName || 'Store Buyer',
                phone: raw,
                email: '',
                ordersCount: 1,
                totalSpent: String(o.total || '0.00'),
                lastOrderDate: o.createdAt,
                source: 'stored_order'
              })
            }
          }
        }
      })
    } catch (e) {
      console.warn('[API Customers] DB orders warning:', e.message)
    }

    const allCustomers = Array.from(contactsMap.values())
    return NextResponse.json(allCustomers)
  } catch (error) {
    console.error('[API Customers] Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
