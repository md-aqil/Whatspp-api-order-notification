import { getPool, query, queryOne, queryMany } from '../mysql';
import { ensureSettingsTables } from '../settings-db';
import { encrypt, decrypt } from '../encryption';

export async function getStoredIntegrations(userId = 'default') {
  try {
    await ensureSettingsTables()
    const normalizedUserId = String(userId || 'default')
    const pool = getPool()
    
    const parseIntegrationRow = (row) => {
      const decryptIfNeeded = (val) => {
        if (!val || typeof val !== 'string') return val
        const decrypted = decrypt(val)
        try {
          return JSON.parse(decrypted)
        } catch (e) {
          return val // Fallback for plain text or already parsed
        }
      }

      return {
        whatsapp: decryptIfNeeded(row.whatsapp),
        shopify: decryptIfNeeded(row.shopify),
        stripe: decryptIfNeeded(row.stripe),
        zoho: decryptIfNeeded(row.zoho),
        googleSheets: decryptIfNeeded(row.googleSheets)
      }
    }

    const [rows] = await pool.execute(
      'SELECT whatsapp, shopify, stripe, zoho, googleSheets FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
      [normalizedUserId]
    )
    const row = rows[0]

    if (row && (row.whatsapp || row.shopify || row.stripe || row.zoho || row.googleSheets)) {
      return parseIntegrationRow(row)
    }

    return null
  } catch (error) {
    console.error('[getStoredIntegrations] Error:', error.message)
    return null
  }
}

export async function saveStoredIntegration(type, data, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getPool()
    const existing = await queryOne(
      'SELECT id FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
      [String(userId || 'default')]
    )

    if (existing) {
      const columnMap = { 
        whatsapp: 'whatsapp', 
        shopify: 'shopify', 
        stripe: 'stripe', 
        zoho: 'zoho', 
        googleSheets: 'googleSheets' 
      }
      const column = columnMap[type] || 'whatsapp'
      await pool.execute(
        `UPDATE integrations SET ${column} = ?, updatedAt = NOW() WHERE id = ?`,
        [JSON.stringify(encrypt(JSON.stringify(data))), existing.id]
      )
    } else {
      let insertSql
      if (type === 'whatsapp') {
        insertSql = `INSERT INTO integrations (userId, whatsapp, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      } else if (type === 'shopify') {
        insertSql = `INSERT INTO integrations (userId, shopify, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      } else if (type === 'stripe') {
        insertSql = `INSERT INTO integrations (userId, stripe, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      } else if (type === 'zoho') {
        insertSql = `INSERT INTO integrations (userId, zoho, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      } else {
        insertSql = `INSERT INTO integrations (userId, googleSheets, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      }
      
      await pool.execute(insertSql, [String(userId || 'default'), JSON.stringify(encrypt(JSON.stringify(data)))])
    }

    if (type === 'whatsapp' && data.phoneNumberId) {
      await syncWhatsAppAccountMapping(data, userId)
    }
  } catch (error) {
    console.error('Failed to save integration:', error)
    throw error
  }
}

async function syncWhatsAppAccountMapping(data, userId) {
  try {
    const pool = getPool()
    await pool.execute(
      `INSERT INTO whatsapp_accounts (id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE accountName = VALUES(accountName), phoneNumberId = VALUES(phoneNumberId), accessToken = VALUES(accessToken), businessAccountId = VALUES(businessAccountId), updatedAt = NOW()`,
      [`wa_${data.phoneNumberId}`, String(userId || 'default'), data.accountName || 'Primary Account', data.phoneNumberId, data.accessToken, data.businessAccountId, data.phoneNumber || '']
    )
  } catch (waErr) {
    console.error('Failed to sync whatsapp_accounts:', waErr.message)
  }
}

export async function getStoredWhatsAppAccounts(userId = 'default') {
  return queryMany(
    'SELECT id, userId, accountName, phoneNumberId, businessAccountId, phoneNumber, status, createdAt, updatedAt FROM whatsapp_accounts WHERE userId = ? ORDER BY createdAt DESC',
    [userId]
  )
}

export async function getWhatsAppAccountById(accountId, userId = 'default') {
  return queryOne(
    'SELECT id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, status, createdAt, updatedAt FROM whatsapp_accounts WHERE id = ? AND userId = ?',
    [accountId, userId]
  )
}

export async function getUserIdByWhatsAppPhoneNumberId(phoneNumberId) {
  const row = await queryOne(
    'SELECT userId FROM whatsapp_accounts WHERE phoneNumberId = ? ORDER BY updatedAt DESC LIMIT 1',
    [phoneNumberId]
  )
  return row?.userId || 'default'
}

export async function getUserIdByInstagramAccountId(instagramAccountId) {
  // First try direct instagramAccountId match
  const row = await queryOne(
    'SELECT userId FROM instagram_accounts WHERE instagramAccountId = ? ORDER BY updatedAt DESC LIMIT 1',
    [instagramAccountId]
  )
  if (row?.userId) return row.userId

  // Fallback: Meta sometimes sends entry.id as pageId (messaging channel)
  // Try resolving via pageId to find the linked IG account
  const byPage = await queryOne(
    'SELECT userId FROM instagram_accounts WHERE pageId = ? ORDER BY updatedAt DESC LIMIT 1',
    [instagramAccountId]
  )
  if (byPage?.userId) {
    console.log(`[Instagram] Resolved userId via pageId fallback for ${instagramAccountId}: ${byPage.userId}`)
    return byPage.userId
  }

  return 'default'
}

export async function getStoredInstagramAccounts(userId = 'default') {
  return queryMany(
    'SELECT id, userId, accountName, pageId, instagramAccountId, status, createdAt, updatedAt FROM instagram_accounts WHERE userId = ? ORDER BY createdAt DESC',
    [userId]
  )
}

export async function getInstagramAccountByAccountId(accountId, userId = 'default') {
  return queryOne(
    'SELECT id, userId, accountName, pageId, instagramAccountId, accessToken, status, createdAt, updatedAt FROM instagram_accounts WHERE id = ? AND userId = ?',
    [accountId, userId]
  )
}

export async function saveInstagramAccount(data, userId = 'default') {
  try {
    const accountId = data.id || `ig_${data.instagramAccountId}`
    await query(
      `INSERT INTO instagram_accounts (id, userId, accountName, pageId, instagramAccountId, accessToken, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE accountName = VALUES(accountName), pageId = VALUES(pageId), instagramAccountId = VALUES(instagramAccountId), accessToken = VALUES(accessToken), updatedAt = NOW()`,
      [accountId, String(userId || 'default'), data.accountName || 'Primary Page', data.pageId, data.instagramAccountId, data.accessToken]
    )
    return accountId
  } catch (igErr) {
    console.error('Failed to sync instagram_accounts:', igErr.message)
    throw igErr
  }
}

