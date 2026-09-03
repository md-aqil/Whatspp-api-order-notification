import { getPool, query, queryOne, queryMany } from '../mysql.js';
import { ensureSettingsTables } from '../settings-db.js';
import { encrypt, decrypt } from '../encryption.js';

export async function getStoredIntegrations(userId = 'default') {
  try {
    await ensureSettingsTables()
    const normalizedUserId = String(userId || 'default')
    const pool = getPool()
    
    const parseIntegrationRow = (row) => {
      const decryptIfNeeded = (val) => {
        if (!val) return null
        if (typeof val === 'object') return val
        if (typeof val !== 'string') return null

        let raw = val.trim()
        // Unwrap outer quotes if stored with double stringification
        while (
          (raw.startsWith('"') && raw.endsWith('"')) ||
          (raw.startsWith("'") && raw.endsWith("'"))
        ) {
          try {
            const parsed = JSON.parse(raw)
            if (typeof parsed === 'string') raw = parsed.trim()
            else return parsed
          } catch (e) {
            raw = raw.slice(1, -1).trim()
          }
        }

        let decrypted = raw
        if (typeof raw === 'string' && raw.includes(':')) {
          try {
            decrypted = decrypt(raw)
          } catch (e) {
            decrypted = raw
          }
        }

        if (typeof decrypted === 'string') {
          try {
            return JSON.parse(decrypted)
          } catch (e) {
            return decrypted
          }
        }
        return decrypted
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
    let row = rows[0]

    // Fallback 1: If not found for current userId, check 'default'
    if (!row && normalizedUserId !== 'default') {
      const [defaultRows] = await pool.execute(
        'SELECT whatsapp, shopify, stripe, zoho, googleSheets FROM integrations WHERE userId = "default" ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1'
      )
      row = defaultRows[0]
    }

    // Fallback 2: If still not found, check any latest populated row in integrations
    if (!row) {
      const [anyRows] = await pool.execute(
        'SELECT whatsapp, shopify, stripe, zoho, googleSheets FROM integrations ORDER BY updatedAt DESC, id DESC LIMIT 1'
      )
      row = anyRows[0]
    }

    let result = (row && (row.whatsapp || row.shopify || row.stripe || row.zoho || row.googleSheets))
      ? parseIntegrationRow(row)
      : { whatsapp: null, shopify: null, stripe: null, zoho: null, googleSheets: null }

    // Fallback 3: Dedicated shopify_accounts anchor table lookup
    if (!result.shopify?.accessToken || !result.shopify?.shopDomain) {
      try {
        const [shopifyRows] = await pool.execute(
          'SELECT shopDomain, accessToken, scope FROM shopify_accounts WHERE status = "active" ORDER BY updatedAt DESC, id DESC LIMIT 1'
        )
        if (shopifyRows?.[0]?.accessToken && shopifyRows?.[0]?.shopDomain) {
          result.shopify = {
            shopDomain: shopifyRows[0].shopDomain,
            accessToken: shopifyRows[0].accessToken,
            scope: shopifyRows[0].scope || '',
            connectedVia: 'oauth'
          }
        }
      } catch (shErr) {
        console.warn('[getStoredIntegrations] shopify_accounts fallback note:', shErr.message)
      }
    }

    // Fallback 4: Dedicated whatsapp_accounts anchor table lookup
    if (!result.whatsapp?.accessToken || !result.whatsapp?.phoneNumberId) {
      try {
        const [waRows] = await pool.execute(
          'SELECT phoneNumberId, accessToken, businessAccountId, phoneNumber, accountName FROM whatsapp_accounts WHERE status = "active" ORDER BY updatedAt DESC, id DESC LIMIT 1'
        )
        if (waRows?.[0]?.accessToken && waRows?.[0]?.phoneNumberId) {
          result.whatsapp = {
            phoneNumberId: waRows[0].phoneNumberId,
            accessToken: waRows[0].accessToken,
            businessAccountId: waRows[0].businessAccountId,
            phoneNumber: waRows[0].phoneNumber,
            accountName: waRows[0].accountName
          }
        }
      } catch (waErr) {
        console.warn('[getStoredIntegrations] whatsapp_accounts fallback note:', waErr.message)
      }
    }

    return result
  } catch (error) {
    console.error('[getStoredIntegrations] Error:', error.message)
    return null
  }
}

export async function saveStoredIntegration(type, data, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getPool()
    const normalizedUserId = String(userId || 'default')
    const encryptedPayload = encrypt(JSON.stringify(data))

    const existing = await queryOne(
      'SELECT id FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
      [normalizedUserId]
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
        [encryptedPayload, existing.id]
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
      
      await pool.execute(insertSql, [normalizedUserId, encryptedPayload])
    }

    // Anchor to dedicated permanent tables
    if (type === 'whatsapp' && data.phoneNumberId) {
      await syncWhatsAppAccountMapping(data, userId)
    }

    if (type === 'shopify' && data.shopDomain && data.accessToken) {
      await syncShopifyAccountMapping(data, userId)
    }
  } catch (error) {
    console.error('Failed to save integration:', error)
    throw error
  }
}

async function syncShopifyAccountMapping(data, userId) {
  try {
    const pool = getPool()
    const normalizedShop = String(data.shopDomain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    await pool.execute(
      `INSERT INTO shopify_accounts (id, userId, shopDomain, accessToken, scope, status, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())
       ON DUPLICATE KEY UPDATE accessToken = VALUES(accessToken), scope = VALUES(scope), status = 'active', updatedAt = NOW()`,
      [`sh_${normalizedShop}`, String(userId || 'default'), normalizedShop, data.accessToken, data.scope || '']
    )
  } catch (shErr) {
    console.error('Failed to sync shopify_accounts:', shErr.message)
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
  if (!phoneNumberId) return 'default'

  try {
    const row = await queryOne(
      'SELECT userId FROM whatsapp_accounts WHERE phoneNumberId = ? ORDER BY updatedAt DESC LIMIT 1',
      [phoneNumberId]
    )
    if (row?.userId) return row.userId

    // Check integrations table where settings are saved
    const intRows = await queryMany('SELECT userId, whatsapp FROM integrations ORDER BY updatedAt DESC')
    for (const intRow of intRows || []) {
      try {
        let val = intRow.whatsapp
        if (typeof val === 'string' && val.includes(':')) {
          val = decrypt(val)
        }
        const wa = typeof val === 'string' ? JSON.parse(val) : val
        if (wa?.phoneNumberId === phoneNumberId) {
          return intRow.userId || 'default'
        }
      } catch (e) {}
    }

    if (intRows && intRows.length > 0 && intRows[0].userId) {
      return intRows[0].userId
    }
  } catch (err) {
    console.error('getUserIdByWhatsAppPhoneNumberId error:', err.message)
  }

  return 'default'
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

