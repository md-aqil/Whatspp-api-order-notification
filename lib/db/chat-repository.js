import { getPool, queryOne, queryMany } from '../mysql';

export async function getStoredChats(userId) {
  return queryMany(
    'SELECT * FROM chats WHERE userId = ? ORDER BY timestamp DESC',
    [userId]
  )
}

export async function getStoredChatByPhone(phone, userId) {
  return queryOne(
    'SELECT * FROM chats WHERE phone = ? AND userId = ?',
    [phone, userId]
  )
}

export async function upsertStoredChat(chat, userId) {
  const pool = getPool()
  const { phone, name, lastMessage, timestamp, unread } = chat
  
  await pool.execute(
    `INSERT INTO chats (userId, phone, name, lastMessage, timestamp, unread)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       name = VALUES(name), 
       lastMessage = VALUES(lastMessage), 
       timestamp = VALUES(timestamp), 
       unread = VALUES(unread)`,
    [userId, phone, name, lastMessage, timestamp, unread]
  )
  
  return getStoredChatByPhone(phone, userId)
}

export async function getStoredMessagesByPhone(phone, userId) {
  return queryMany(
    `SELECT * FROM messages 
     WHERE (phone = ? AND userId = ?) OR (recipient = ? AND userId = ?)
     ORDER BY timestamp ASC`,
    [phone, userId, phone, userId]
  )
}

export async function saveOutgoingMessage(to, message, apiResult, userId) {
  const pool = getPool()
  const msgId = apiResult.messages?.[0]?.id || `out_${Date.now()}`
  
  const [result] = await pool.execute(
    `INSERT INTO messages (id, userId, phone, recipient, message, type, status, isCustomer, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [msgId, userId, 'system', to, message, 'text', 'sent', 0]
  )
  
  const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [msgId])
  return rows[0]
}
export async function insertStoredMessage(message) {
  const pool = getPool()
  await pool.execute(
    `INSERT INTO messages (id, userId, campaignId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, messageType, products, template, orderId, sentAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.userId || 'default',
      message.campaignId || null,
      message.recipient || null,
      message.phone || null,
      message.message || null,
      message.isCustomer ?? 0,
      message.timestamp || new Date(),
      message.whatsappMessageId || null,
      message.status || 'sent',
      message.messageType || 'text',
      message.products ? JSON.stringify(message.products) : null,
      message.template ? JSON.stringify(message.template) : null,
      message.orderId || null,
      message.sentAt || null
    ]
  )
}

export async function getStoredShopifyCustomer(customerId) {
  return queryOne(
    `SELECT id, customerId, phone
     FROM shopify_customers
     WHERE customerId = ?
     ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC
     LIMIT 1`,
    [customerId]
  )
}

export async function upsertStoredShopifyCustomer(customerId, phone) {
  const pool = getPool()
  const existing = await getStoredShopifyCustomer(customerId)

  if (existing) {
    await pool.execute(
      `UPDATE shopify_customers
       SET phone = ?, updatedAt = NOW()
       WHERE id = ?`,
      [phone, existing.id]
    )
    return
  }

  await pool.execute(
    `INSERT INTO shopify_customers (customerId, phone, createdAt, updatedAt)
     VALUES (?, ?, NOW(), NOW())`,
    [customerId, phone]
  )
}
