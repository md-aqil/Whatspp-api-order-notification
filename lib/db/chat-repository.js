import { v4 as uuidv4 } from 'uuid';
import { getPool, queryOne, queryMany } from '../mysql';

export async function getStoredChats(userId) {
  const normalized = userId || 'default'
  return queryMany(
    'SELECT * FROM chats WHERE userId = ? OR userId = "default" OR userId IS NULL ORDER BY timestamp DESC',
    [normalized]
  )
}

export async function getStoredChatByPhone(phone, userId) {
  const cleanPhone = String(phone || '').replace(/\D/g, '')
  return queryOne(
    'SELECT * FROM chats WHERE phone LIKE ? OR phone = ? ORDER BY timestamp DESC LIMIT 1',
    [`%${cleanPhone}%`, phone]
  )
}

export async function upsertStoredChat(chat, userId) {
  const pool = getPool()
  const { phone, name, lastMessage, timestamp, unread } = chat
  const effectiveUserId = userId || 'default'
  
  const existing = await getStoredChatByPhone(phone, effectiveUserId)
  
  if (existing) {
    await pool.execute(
      `UPDATE chats 
       SET name = ?, lastMessage = ?, timestamp = ?, unread = ?
       WHERE id = ?`,
      [name || existing.name, lastMessage, timestamp || new Date(), unread ?? 0, existing.id]
    )
    return getStoredChatByPhone(phone, effectiveUserId)
  }

  const id = uuidv4()
  await pool.execute(
    `INSERT INTO chats (id, userId, phone, name, lastMessage, timestamp, unread)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, effectiveUserId, phone, name || phone, lastMessage, timestamp || new Date(), unread ?? 0]
  )
  
  return getStoredChatByPhone(phone, effectiveUserId)
}

function parseMessageRow(row) {
  if (!row) return row
  let images = []
  if (row.products) {
    try {
      const parsed = typeof row.products === 'string' ? JSON.parse(row.products) : row.products
      if (Array.isArray(parsed?.imageUrls)) {
        images = parsed.imageUrls
      } else if (parsed?.imageUrl) {
        images = [parsed.imageUrl]
      } else if (Array.isArray(parsed)) {
        images = parsed.map(p => p.image).filter(Boolean)
      }
    } catch (e) {}
  }
  return {
    ...row,
    imageUrls: images,
    imageUrl: images[0] || row.imageUrl || null
  }
}

export async function getStoredMessagesByPhone(phone, userId) {
  const cleanPhone = String(phone || '').replace(/\D/g, '')
  if (!cleanPhone) return []
  const rows = await queryMany(
    `SELECT * FROM messages 
     WHERE phone LIKE ? OR recipient LIKE ? OR phone = ? OR recipient = ?
     ORDER BY timestamp ASC`,
    [`%${cleanPhone}%`, `%${cleanPhone}%`, phone, phone]
  )
  return (rows || []).map(parseMessageRow)
}

export async function saveOutgoingMessage(to, message, apiResult, userId, imageUrl, imageUrls) {
  const pool = getPool()
  const msgId = apiResult?.messages?.[0]?.id || `out_${Date.now()}`
  const images = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : [])
  const productsPayload = images.length > 0 ? JSON.stringify({ imageUrls: images, imageUrl: images[0] }) : null
  const messageType = images.length > 0 ? 'image' : 'text'
  
  await pool.execute(
    `INSERT INTO messages (id, userId, phone, recipient, message, messageType, products, status, isCustomer, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), message = VALUES(message), products = VALUES(products), timestamp = VALUES(timestamp)`,
    [msgId, userId || 'default', 'system', to, message, messageType, productsPayload, 'sent', 0]
  )

  await upsertStoredChat({
    phone: to,
    name: to,
    lastMessage: message || (images.length > 0 ? '[Photo]' : ''),
    timestamp: new Date(),
    unread: 0
  }, userId)
  
  const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [msgId])
  return parseMessageRow(rows[0])
}

export async function insertStoredMessage(message) {
  const pool = getPool()
  const [result] = await pool.execute(
    `INSERT INTO messages (id, userId, campaignId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, messageType, products, template, orderId, sentAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), message = VALUES(message), products = VALUES(products), timestamp = VALUES(timestamp)`,
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
      message.products ? (typeof message.products === 'string' ? message.products : JSON.stringify(message.products)) : null,
      message.template ? (typeof message.template === 'string' ? message.template : JSON.stringify(message.template)) : null,
      message.orderId || null,
      message.sentAt || null
    ]
  )
  return result.affectedRows
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

export async function saveStoredShopifyCustomer(customerId, phone) {
  if (!customerId || !phone) return

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

export async function saveIncomingMessage(message, userId = 'default', contact = null) {
  const phone = message.from
  const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || (message.type === 'image' ? '[Photo]' : '[Message]')
  const customerName = contact?.profile?.name || phone
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

  // Upsert chat with customer name
  const chat = await upsertStoredChat({
    phone,
    name: customerName,
    lastMessage: text,
    timestamp: new Date(),
    unread: 1
  }, userId)
  
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
