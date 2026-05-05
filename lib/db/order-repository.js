import { getPool, queryMany, queryOne } from '../mysql'

export async function getStoredOrders(limit = 100, userId = 'default') {
  return queryMany(
    'SELECT id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt FROM orders WHERE userId = ? ORDER BY createdAt IS NULL, createdAt DESC LIMIT ?',
    [userId, limit]
  )
}

export async function getLatestStoredOrderByPhone(phone, userId = 'default') {
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  if (!normalizedPhone) return null

  return queryOne(
    `SELECT id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt
     FROM orders
     WHERE userId = ? AND REGEXP_REPLACE(COALESCE(customerPhone, ''), '[^0-9]', '') = ?
     ORDER BY createdAt IS NULL, createdAt DESC, updatedAt IS NULL, updatedAt DESC
     LIMIT 1`,
    [userId, normalizedPhone]
  )
}

export async function insertStoredOrder(order) {
  await getPool().execute(
    `INSERT INTO orders (id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id,
      order.userId || 'default',
      order.shopifyOrderId || null,
      order.orderNumber || null,
      order.customerName || null,
      order.customerEmail || null,
      order.customerPhone || null,
      order.total || null,
      order.currency || null,
      order.status || null,
      JSON.stringify(order.lineItems || []),
      order.createdAt || new Date(),
      order.updatedAt || new Date(),
      !!order.whatsappSent,
      order.whatsappMessageId || null,
      order.whatsappSentAt || null
    ]
  )
}

export async function getStoredOrderByShopifyOrderId(shopifyOrderId) {
  return queryOne(
    `SELECT id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt
     FROM orders
     WHERE shopifyOrderId = ?
     LIMIT 1`,
    [shopifyOrderId]
  )
}

export async function updateStoredOrderByShopifyOrderId(shopifyOrderId, patch) {
  const fields = []
  const values = []
  const map = {
    status: 'status',
    updatedAt: 'updatedAt',
    whatsappSent: 'whatsappSent',
    whatsappMessageId: 'whatsappMessageId',
    whatsappSentAt: 'whatsappSentAt'
  }

  Object.entries(patch).forEach(([key, value]) => {
    if (!(key in map)) return
    fields.push(`${map[key]} = ?`)
    values.push(value)
  })

  if (fields.length === 0) return

  values.push(shopifyOrderId)
  await getPool().execute(
    `UPDATE orders
     SET ${fields.join(', ')}
     WHERE shopifyOrderId = ?`,
    values
  )
}
