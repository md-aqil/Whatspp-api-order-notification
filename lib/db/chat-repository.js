import { v4 as uuidv4 } from 'uuid';
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
  
  const existing = await getStoredChatByPhone(phone, userId)
  
  if (existing) {
    await pool.execute(
      `UPDATE chats 
       SET name = ?, lastMessage = ?, timestamp = ?, unread = ?
       WHERE id = ?`,
      [name, lastMessage, timestamp, unread, existing.id]
    )
    return getStoredChatByPhone(phone, userId)
  }

  const id = uuidv4()
  await pool.execute(
    `INSERT INTO chats (id, userId, phone, name, lastMessage, timestamp, unread)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, phone, name, lastMessage, timestamp, unread]
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
    `INSERT INTO messages (id, userId, phone, recipient, message, messageType, status, isCustomer, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), timestamp = VALUES(timestamp)`,
    [msgId, userId, 'system', to, message, 'text', 'sent', 0]
  )
  
  const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [msgId])
  return rows[0]
}
export async function insertStoredMessage(message) {
  const pool = getPool()
  await pool.execute(
    `INSERT INTO messages (id, userId, campaignId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, messageType, products, template, orderId, sentAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), message = VALUES(message), timestamp = VALUES(timestamp)`,
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

export async function saveIncomingMessage(message, userId = 'default') {
  const phone = message.from
  const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '[Media/Other]'
  
  // Upsert chat
  const chat = await upsertStoredChat({
    phone,
    name: phone,
    lastMessage: text,
    timestamp: new Date(),
    unread: 1
  }, userId)

  // Save message
  const msgId = message.id || `in_${Date.now()}`
  await insertStoredMessage({
    id: msgId,
    userId,
    phone,
    message: text,
    isCustomer: 1,
    timestamp: new Date(),
    whatsappMessageId: message.id,
    status: 'received'
  })

  return { id: msgId, phone, text, chatId: chat?.id, timestamp: new Date() }
}

export function buildIncomingWhatsAppAutomationContext(message, savedMessage, contact) {
  const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || ''
  const name = contact?.profile?.name || message.from
  const timestamp = savedMessage?.timestamp || new Date()
  return {
    from: message.from,
    customerPhone: message.from,
    customer_phone: message.from,
    customerName: name,
    customer_name: name,
    customer_message: text,
    message_type: message.type,
    timestamp,
    first_message_at: timestamp,
    last_inbound_message_at: timestamp,
    project_brief_summary: text,
    chatflow_contact_id: contact?.wa_id || message.from,
    chatflow_conversation_id: savedMessage?.chatId || `${message.from}:${savedMessage?.id || message.id || Date.now()}`,
    _isInteractiveReply: message.type === 'interactive',
    _chosenOptionId: message.interactive?.button_reply?.id || message.interactive?.list_reply?.id,
    _inboundWamid: message.id
  }
}
