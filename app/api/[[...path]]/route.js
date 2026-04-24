import mysql from 'mysql2/promise'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError, sanitizeMetaAccessToken } from '@/lib/meta-auth'
import { buildAutomationTemplateComponents as buildAutomationTemplateComponentsShared } from '@/lib/automation-template'
import { validateWhatsAppPhoneNumberAccess } from '@/lib/whatsapp-meta'
import {
  buildCartRecoveryContext,
  cancelPendingCartRecoveryJobs,
  findCartSessionsReadyForAbandonment,
  mapCartSessionToContext,
  markCartSessionAbandoned,
  markCartSessionsRecovered,
  persistCartRecoveryEvent
} from '@/lib/cart-recovery'
import { getLocalIntegrationRecord, saveLocalIntegrationRecord } from '@/lib/local-settings-store'
import { requireRequestUserId, resolveRequestUserId } from '@/lib/request-user'
import { ensureSettingsTables } from '@/lib/settings-db'
import { generateAIResponse } from '@/lib/ai'

let mysqlPool
const shopifyTokenCache = new Map()
let automationConversationStateReadyPromise = null

const WHATSAPP_AUTOMATION_CONVERSATION_WINDOW_MS = 30 * 60 * 1000
const WHATSAPP_AUTOMATION_REPLY_COOLDOWN_MS = 10 * 60 * 1000
const WHATSAPP_SUPPORT_HANDOFF_MS = 2 * 60 * 60 * 1000
const WHATSAPP_MENU_STEP_IDS = new Set(['step-message-4', 'step-message-6'])
const WHATSAPP_SUPPORT_STEP_IDS = new Set(['step-message-11'])


function getMysqlPool() {
  if (globalThis.mysqlPool) return globalThis.mysqlPool

  if (!mysqlPool) {
    const connectionString = process.env.DATABASE_URL || process.env.DB_URL
    const poolConfig = {
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    }
    if (connectionString) {
      mysqlPool = mysql.createPool({ uri: connectionString, ...poolConfig })
    } else {
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        database: process.env.DB_NAME || 'whatsapp_api',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        ...poolConfig
      })
    }
    globalThis.mysqlPool = mysqlPool
  }

  return mysqlPool
}

async function queryOne(sql, params = []) {
  const [rows] = await getMysqlPool().execute(sql, params)
  return rows[0] || null
}

async function queryMany(sql, params = []) {
  const [rows] = await getMysqlPool().execute(sql, params)
  return rows
}

async function query(sql, params = []) {
  return getMysqlPool().execute(sql, params)
}

async function ensureKnowledgeBaseTable() {
  try {
    const pool = getMysqlPool()
    if (!pool) return
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_kb_user (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } catch (error) {
    console.error('Failed to ensure knowledge_base table:', error.message)
  }
}

async function ensureAutomationJobsTable() {
  try {
    const pool = getMysqlPool()
    if (!pool) return
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id VARCHAR(255) PRIMARY KEY,
        automationId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        recipient VARCHAR(255) NOT NULL,
        message TEXT,
        template TEXT,
        payload JSON,
        status VARCHAR(50) DEFAULT 'pending',
        runAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_jobs_status_run (status, runAt),
        INDEX idx_jobs_user (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } catch (error) {
    console.error('Failed to ensure automation_jobs table:', error.message)
  }
}

async function ensureAutomationConversationStateTable() {
  if (!automationConversationStateReadyPromise) {
    automationConversationStateReadyPromise = (async () => {
      await getMysqlPool().query(`
        CREATE TABLE IF NOT EXISTS automation_conversation_state (
          id VARCHAR(255) PRIMARY KEY,
          userId VARCHAR(255) NOT NULL DEFAULT 'default',
          automationId VARCHAR(255) NOT NULL,
          recipient VARCHAR(255) NOT NULL,
          state TEXT,
          lastInboundAt DATETIME,
          lastMenuSentAt DATETIME,
          lastReplyKey TEXT,
          lastReplyAt DATETIME,
          handoffUntil DATETIME,
          awaitingInteractiveStepId VARCHAR(255) DEFAULT NULL,
          payload JSON,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX automation_conversation_state_lookup_idx (userId, automationId, recipient)
        );
      `)
      
      // Migration: Ensure awaitingInteractiveStepId column exists
      try {
        const [columns] = await getMysqlPool().query('SHOW COLUMNS FROM automation_conversation_state LIKE "awaitingInteractiveStepId"')
        if (columns.length === 0) {
          console.log('[DB Migration] Adding awaitingInteractiveStepId column...')
          await getMysqlPool().query(`
            ALTER TABLE automation_conversation_state 
            ADD COLUMN awaitingInteractiveStepId VARCHAR(255) DEFAULT NULL 
            AFTER handoffUntil
          `)
          console.log('[DB Migration] Column added successfully.')
        }
      } catch (err) {
        console.error('[DB Migration] Error checking/adding column:', err.message)
      }
    })()
  }

  await automationConversationStateReadyPromise
}

function normalizeAutomationRecipientKey(value = '') {
  return String(value || '').replace(/\D/g, '')
}

function getAutomationConversationStateId(userId, automationId, recipient) {
  return `${userId}:${automationId}:${recipient}`
}

function getDateValue(value) {
  return value ? new Date(value) : null
}

function isWithinMs(timestamp, durationMs, now = new Date()) {
  const value = getDateValue(timestamp)
  return !!(value && now.getTime() - value.getTime() < durationMs)
}

function isHandoffActive(state, now = new Date()) {
  const handoffUntil = getDateValue(state?.handoffUntil)
  return !!(handoffUntil && handoffUntil.getTime() > now.getTime())
}

function shouldSuppressWhatsAppAutomationStep(step, state, now = new Date()) {
  if (!state) return false

  if (WHATSAPP_MENU_STEP_IDS.has(step.id) && isWithinMs(state.lastMenuSentAt, WHATSAPP_AUTOMATION_CONVERSATION_WINDOW_MS, now)) {
    return true
  }

  if (state.lastReplyKey === step.id && isWithinMs(state.lastReplyAt, WHATSAPP_AUTOMATION_REPLY_COOLDOWN_MS, now)) {
    return true
  }

  return false
}

async function getAutomationConversationState(automationId, recipient, userId) {
  await ensureAutomationConversationStateTable()
  const stateId = getAutomationConversationStateId(userId, automationId, recipient)
  
  const result = await queryOne(
    `SELECT id, automationId, recipient, state, lastInboundAt, lastMenuSentAt, lastReplyKey, lastReplyAt, handoffUntil, awaitingInteractiveStepId, payload
     FROM automation_conversation_state
     WHERE id = ?`,
    [stateId]
  )
  
  if (result) {
    console.log(`[getAutomationConversationState] Found state for ${stateId}: awaiting=${result.awaitingInteractiveStepId}`)
  }
  return result
}

async function saveAutomationConversationState(automationId, recipient, currentState = null, patch = {}, userId = 'default') {
  await ensureAutomationConversationStateTable()

  const nextState = {
    id: getAutomationConversationStateId(userId, automationId, recipient),
    userId,
    automationId,
    recipient,
    state: patch.state ?? currentState?.state ?? null,
    lastInboundAt: patch.lastInboundAt ?? currentState?.lastInboundAt ?? null,
    lastMenuSentAt: patch.lastMenuSentAt ?? currentState?.lastMenuSentAt ?? null,
    lastReplyKey: patch.lastReplyKey ?? currentState?.lastReplyKey ?? null,
    lastReplyAt: patch.lastReplyAt ?? currentState?.lastReplyAt ?? null,
    handoffUntil: patch.handoffUntil ?? currentState?.handoffUntil ?? null,
    awaitingInteractiveStepId: patch.awaitingInteractiveStepId !== undefined
      ? patch.awaitingInteractiveStepId
      : (currentState?.awaitingInteractiveStepId ?? null),
    payload: patch.payload ?? currentState?.payload ?? {}
  }

  await getMysqlPool().execute(
    `INSERT INTO automation_conversation_state
      (id, userId, automationId, recipient, state, lastInboundAt, lastMenuSentAt, lastReplyKey, lastReplyAt, handoffUntil, awaitingInteractiveStepId, payload, createdAt, updatedAt)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
      state = VALUES(state),
      lastInboundAt = VALUES(lastInboundAt),
      lastMenuSentAt = VALUES(lastMenuSentAt),
      lastReplyKey = VALUES(lastReplyKey),
      lastReplyAt = VALUES(lastReplyAt),
      handoffUntil = VALUES(handoffUntil),
      awaitingInteractiveStepId = VALUES(awaitingInteractiveStepId),
      payload = VALUES(payload),
      updatedAt = NOW()`,
    [
      nextState.id,
      nextState.userId,
      nextState.automationId,
      nextState.recipient,
      nextState.state,
      nextState.lastInboundAt,
      nextState.lastMenuSentAt,
      nextState.lastReplyKey,
      nextState.lastReplyAt,
      nextState.handoffUntil,
      nextState.awaitingInteractiveStepId,
      JSON.stringify(nextState.payload || {})
    ]
  )

  return nextState
}

function getShopifyCacheKey(shopDomain, clientId) {
  return `${shopDomain}::${clientId}`
}

function normalizeShopifyDomain(shopDomain = '') {
  return shopDomain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^admin\.shopify\.com\/store\/.+$/, '')
}

async function getShopifyAccessToken(shopify) {
  const normalizedDomain = normalizeShopifyDomain(shopify?.shopDomain)

  if (!normalizedDomain || !shopify?.clientId || !shopify?.clientSecret) {
    throw new Error('Shopify client credentials are incomplete')
  }

  if (!normalizedDomain.endsWith('.myshopify.com')) {
    throw new Error('Use your Shopify store domain in the format your-store.myshopify.com')
  }

  const cacheKey = getShopifyCacheKey(normalizedDomain, shopify.clientId)
  const cachedToken = shopifyTokenCache.get(cacheKey)

  if (cachedToken?.accessToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const tokenResponse = await fetch(`https://${normalizedDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: shopify.clientId,
      client_secret: shopify.clientSecret
    })
  })

  const rawTokenResponse = await tokenResponse.text()
  let tokenData = null

  try {
    tokenData = rawTokenResponse ? JSON.parse(rawTokenResponse) : {}
  } catch {
    if (rawTokenResponse.trim().startsWith('<')) {
      throw new Error(`Shopify returned an HTML page. Use your store domain like ${normalizedDomain || 'your-store.myshopify.com'}, not an admin.shopify.com URL.`)
    }
    throw new Error('Shopify returned an unreadable token response')
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to fetch Shopify access token')
  }

  const expiresInSeconds = Number(tokenData.expires_in || 86399)
  shopifyTokenCache.set(cacheKey, {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000
  })

  return tokenData.access_token
}

async function getStoredIntegrations(userId = 'default') {
  try {
    await ensureSettingsTables()

    const normalizedUserId = String(userId || 'default')
    const pool = getMysqlPool()
    const parseIntegrationRow = (row) => ({
      whatsapp: typeof row.whatsapp === 'string' ? JSON.parse(row.whatsapp) : row.whatsapp,
      shopify: typeof row.shopify === 'string' ? JSON.parse(row.shopify) : row.shopify,
      stripe: typeof row.stripe === 'string' ? JSON.parse(row.stripe) : row.stripe
    })
    const hasIntegrationData = (row) => Boolean(row && (row.whatsapp || row.shopify || row.stripe))
    const readIntegrationRow = async (lookupUserId) => {
      const [rows] = await pool.execute(
        'SELECT whatsapp, shopify, stripe FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
        [lookupUserId]
      )
      return rows[0] || null
    }
    const row = await readIntegrationRow(normalizedUserId)
    console.log('[getStoredIntegrations] DB row:', JSON.stringify(row))

    if (hasIntegrationData(row)) {
      console.log('[getStoredIntegrations] Returning parsed DB data')
      return parseIntegrationRow(row)
    }

    if (normalizedUserId === 'default') {
      console.log('[getStoredIntegrations] Default tenant DB empty, checking local...')
      const localRecord = await getLocalIntegrationRecord()
      console.log('[getStoredIntegrations] Local record:', JSON.stringify(localRecord))

      if (localRecord) {
        return localRecord
      }
    }

    return null
  } catch (error) {
    console.error('[getStoredIntegrations] Error:', error.message)
    if (String(userId || 'default') === 'default') {
      return getLocalIntegrationRecord()
    }
    return null
  }
}

async function getAnyStoredWhatsAppWebhookVerifyToken() {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      `SELECT whatsapp
       FROM integrations
       WHERE whatsapp IS NOT NULL
       ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC`
    )

    for (const row of rows || []) {
      const whatsapp = typeof row?.whatsapp === 'string' ? JSON.parse(row.whatsapp) : row?.whatsapp
      const token = String(whatsapp?.webhookVerifyToken || '').trim()
      if (token) {
        return token
      }
    }
  } catch (error) {
    console.error('[getAnyStoredWhatsAppWebhookVerifyToken] Error:', error.message)
  }

  return ''
}

async function saveStoredIntegration(type, data, userId = 'default') {
  try {
    await ensureSettingsTables()

    const pool = getMysqlPool()
    const existing = await pool.execute(
      'SELECT id FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
      [String(userId || 'default')]
    )

    if (existing[0][0]) {
      const columnMap = { whatsapp: 'whatsapp', shopify: 'shopify', stripe: 'stripe' }
      const column = columnMap[type] || 'whatsapp'
      await pool.execute(
        `UPDATE integrations SET ${column} = ?, updatedAt = NOW() WHERE id = ?`,
        [JSON.stringify(data), existing[0][0].id]
      )
      
      // Keep whatsapp_accounts mapping in sync for fast lookup in webhooks
      if (type === 'whatsapp' && data.phoneNumberId) {
        try {
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

      await saveLocalIntegrationRecord(type, data)
      return
    }

    // Insert with only the relevant column
    const insertSql = type === 'whatsapp' 
      ? `INSERT INTO integrations (userId, whatsapp, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      : type === 'shopify'
      ? `INSERT INTO integrations (userId, shopify, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
      : `INSERT INTO integrations (userId, stripe, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`
    
    await pool.execute(insertSql, [String(userId || 'default'), JSON.stringify(data)])

    // Keep whatsapp_accounts mapping in sync for fast lookup in webhooks
    if (type === 'whatsapp' && data.phoneNumberId) {
      try {
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

    await saveLocalIntegrationRecord(type, data)
  } catch (error) {
    console.error('Failed to save integration to database:', error)
    // Try to save to local storage as fallback
    try {
      await saveLocalIntegrationRecord(type, data)
      console.log('Saved integration to local storage as fallback')
    } catch (localError) {
      console.error('Failed to save to local storage:', localError)
    }
    // Re-throw the original error so the caller can handle it
    throw error
  }
}

// Multi-account WhatsApp functions
async function getStoredWhatsAppAccounts(userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      'SELECT id, userId, accountName, phoneNumberId, businessAccountId, phoneNumber, status, createdAt, updatedAt FROM whatsapp_accounts WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    )
    return rows || []
  } catch (error) {
    console.error('[getStoredWhatsAppAccounts] Error:', error.message)
    return []
  }
}

async function getWhatsAppAccountById(accountId, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      'SELECT id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, status, createdAt, updatedAt FROM whatsapp_accounts WHERE id = ? AND userId = ?',
      [accountId, userId]
    )
    return rows[0] || null
  } catch (error) {
    console.error('[getWhatsAppAccountById] Error:', error.message)
    return null
  }
}

async function getUserIdByWhatsAppPhoneNumberId(phoneNumberId) {
  const normalizedId = String(phoneNumberId || '').trim()
  if (!normalizedId) return 'default'

  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()

    const [accountRows] = await pool.execute(
      `SELECT userId FROM whatsapp_accounts WHERE phoneNumberId = ? ORDER BY updatedAt DESC LIMIT 1`,
      [normalizedId]
    )

    if (accountRows[0]) {
      return accountRows[0].userId
    }

    // Fallback: Check integrations table directly
    const [integrationRows] = await pool.execute('SELECT userId, whatsapp FROM integrations')
    for (const row of integrationRows) {
      const wa = typeof row.whatsapp === 'string' ? JSON.parse(row.whatsapp) : row.whatsapp
      if (wa?.phoneNumberId === normalizedId) {
        return row.userId
      }
    }
  } catch (error) {
    console.error('[getUserIdByWhatsAppPhoneNumberId] Error:', error.message)
  }

  return 'default'
}

async function ensureAutomationsTable() {
  const [tableCheck] = await query("SHOW TABLES LIKE 'automations'")

  if (tableCheck.length === 0) {
    await query(`
      CREATE TABLE IF NOT EXISTS automations (
        userId VARCHAR(255) NOT NULL DEFAULT 'default',
        id VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        status BOOLEAN DEFAULT FALSE,
        source VARCHAR(255),
        summary TEXT,
        steps JSON,
        metrics JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (userId, id)
      )
    `)
  }

  try {
    const indexes = await queryMany('SHOW INDEX FROM automations')
    const primaryColumns = indexes
      .filter(index => index.Key_name === 'PRIMARY')
      .sort((left, right) => left.Seq_in_index - right.Seq_in_index)
      .map(index => index.Column_name)

    if (primaryColumns.length === 1 && primaryColumns[0] === 'id') {
      await query('ALTER TABLE automations DROP PRIMARY KEY, ADD PRIMARY KEY (userId, id)')
    }
  } catch (error) {
    console.error('Failed to migrate automations primary key:', error)
  }

  try {
    await query('CREATE INDEX automations_user_status_idx ON automations (userId, status)')
  } catch {
    // Index already exists.
  }
}


async function seedDefaultAutomationsForUser(userId) {
  const { defaultAutomations } = await import('@/lib/automation-defaults')

  for (const auto of defaultAutomations) {
    try {
      await query(
        `INSERT IGNORE INTO automations (id, userId, name, status, source, summary, steps, metrics, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          auto.id,
          userId,
          auto.name,
          auto.status ? 1 : 0,
          auto.source || 'System',
          auto.summary || '',
          JSON.stringify(auto.steps || []),
          JSON.stringify(auto.metrics || { sent: 0, openRate: 0, conversions: 0 })
        ]
      )
    } catch (err) {
      console.error(`Failed to seed default automation ${auto.id}:`, err.message)
    }
  }
}

async function copyAutomationsBetweenUsers(sourceUserId, targetUserId) {
  const [rows] = await query(
    `SELECT id, name, status, source, summary, steps, metrics
     FROM automations
     WHERE userId = ?
     ORDER BY updatedAt DESC, createdAt DESC`,
    [sourceUserId]
  )

  if (!rows || rows.length === 0) {
    return false
  }

  for (const row of rows) {
    const steps = typeof row.steps === 'string' ? row.steps : JSON.stringify(row.steps || [])
    const metrics = typeof row.metrics === 'string' ? row.metrics : JSON.stringify(row.metrics || {})

    await query(
      `INSERT INTO automations (id, userId, name, status, source, summary, steps, metrics, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        row.id,
        targetUserId,
        row.name,
        row.status,
        row.source,
        row.summary || '',
        steps,
        metrics
      ]
    )
  }

  return true
}

async function saveWhatsAppAccount(accountData, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    const { id, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber } = accountData
    const accountId = id || `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const existing = await pool.execute(
      'SELECT id FROM whatsapp_accounts WHERE id = ? AND userId = ?',
      [accountId, userId]
    )
    
    if (existing[0][0]) {
      await pool.execute(
        `UPDATE whatsapp_accounts SET accountName = ?, phoneNumberId = ?, accessToken = ?, businessAccountId = ?, phoneNumber = ?, updatedAt = NOW() WHERE id = ? AND userId = ?`,
        [accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, accountId, userId]
      )
    } else {
      await pool.execute(
        `INSERT INTO whatsapp_accounts (id, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [accountId, userId, accountName, phoneNumberId, accessToken, businessAccountId, phoneNumber]
      )
    }
    
    return accountId
  } catch (error) {
    console.error('[saveWhatsAppAccount] Error:', error.message)
    throw error
  }
}

async function deleteWhatsAppAccount(accountId, userId = 'default') {
  try {
    await ensureSettingsTables()
    const pool = getMysqlPool()
    await pool.execute(
      'DELETE FROM whatsapp_accounts WHERE id = ? AND userId = ?',
      [accountId, userId]
    )
    return true
  } catch (error) {
    console.error('[deleteWhatsAppAccount] Error:', error.message)
    return false
  }
}

async function getStoredProducts() {
  const row = await queryOne(
    'SELECT products FROM products WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
    ['default']
  )
  return row?.products || []
}

async function saveStoredProducts(products) {
  const pool = getMysqlPool()
  const existing = await queryOne(
    'SELECT id FROM products WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1',
    ['default']
  )

  if (existing) {
    await pool.execute(
      'UPDATE products SET products = ?, lastSync = NOW(), updatedAt = NOW() WHERE id = ?',
      [JSON.stringify(products), existing.id]
    )
    return
  }

  await pool.execute(
    'INSERT INTO products (userId, products, lastSync, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW(), NOW())',
    ['default', JSON.stringify(products)]
  )
}

function normalizeComparableValue(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractShopifyHandleFromUrl(value = '') {
  if (!value) return ''

  try {
    const parsed = new URL(value)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const productIndex = parts.findIndex((part) => part === 'products')
    return productIndex >= 0 ? (parts[productIndex + 1] || '') : ''
  } catch {
    return ''
  }
}

async function fetchMetaCatalogProducts(whatsapp) {
  if (!whatsapp?.catalogId || !whatsapp?.accessToken) return []

  let url = `https://graph.facebook.com/v22.0/${whatsapp.catalogId}/products?fields=id,retailer_id,name,description,image_url,url,price`
  const products = []

  while (url) {
    const response = await fetch(url, {
      headers: {
        ...buildMetaAuthHeaders(whatsapp.accessToken),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    })

    const data = await response.json()
    if (!response.ok) {
      const metaMessage = data.error?.message || 'Meta catalog API error'
      const unsupportedGet = /unsupported get request/i.test(metaMessage)
      const isWrongCatalogNode = (data.error?.code === 100 && /products/i.test(metaMessage)) || unsupportedGet
      
      if (isWrongCatalogNode) {
        const looksLikeKnownNonCatalogId =
          String(whatsapp.catalogId || '') === String(whatsapp.businessAccountId || '') ||
          String(whatsapp.catalogId || '') === String(whatsapp.phoneNumberId || '')

        throw new Error(
          looksLikeKnownNonCatalogId
            ? 'Saved Catalog ID is using your WhatsApp account/phone ID, not a Meta product catalog ID. Open Commerce Manager and copy the actual Catalog ID.'
            : 'Saved Catalog ID looks real, but this token or app cannot access it. Give the token’s Meta business/system user access to that catalog in Commerce Manager.'
        )
      }

      throw new Error(metaMessage)
    }

    products.push(...(Array.isArray(data.data) ? data.data : []))
    url = data.paging?.next || ''
  }

  return products.map((product) => ({
    id: String(product.id || '').trim(),
    retailer_id: String(product.retailer_id || '').trim(),
    name: product.name || '',
    description: product.description || '',
    url: product.url || '',
    image_url: product.image_url || '',
    price: typeof product.price === 'object'
      ? `${product.price.amount || ''}`.trim()
      : String(product.price || '').trim()
  }))
}

async function validateMetaCatalogAccess(whatsapp) {
  if (!whatsapp?.catalogId || !whatsapp?.accessToken) return

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${whatsapp.catalogId}/products?fields=id&limit=1`,
    {
      headers: {
        ...buildMetaAuthHeaders(whatsapp.accessToken),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    }
  )

  const data = await response.json()
  if (response.ok) return

  const metaMessage = mapMetaAccessTokenError(data.error?.message || 'Meta catalog validation failed')
  const unsupportedGet = /unsupported get request/i.test(metaMessage)
  const isWrongCatalogNode = data.error?.code === 100 && /products/i.test(metaMessage)
  if (isWrongCatalogNode || unsupportedGet) {
    const looksLikeKnownNonCatalogId =
      String(whatsapp.catalogId || '') === String(whatsapp.businessAccountId || '') ||
      String(whatsapp.catalogId || '') === String(whatsapp.phoneNumberId || '')

    throw new Error(
      looksLikeKnownNonCatalogId
        ? 'Catalog ID appears to be your WhatsApp account/phone ID, not a Meta product catalog ID. Use the Catalog ID from Commerce Manager.'
        : 'Catalog ID looks real, but this token or app cannot access it. Give the token’s Meta business/system user access to that catalog in Commerce Manager.'
    )
  }

  throw new Error(metaMessage)
}

function normalizeWhatsAppIntegrationData(data = {}) {
  return {
    ...data,
    phoneNumberId: String(data.phoneNumberId || '').trim(),
    accessToken: sanitizeMetaAccessToken(data.accessToken),
    businessAccountId: String(data.businessAccountId || '').trim(),
    catalogId: String(data.catalogId || '').trim(),
    webhookVerifyToken: String(data.webhookVerifyToken || '').trim()
  }
}

function mapMetaCatalogProductsToAppProducts(metaProducts = []) {
  return metaProducts.map((product) => {
    const retailerId = String(product.retailer_id || '').trim()
    const metaId = String(product.id || '').trim()
    const url = product.url || ''
    const handle = extractShopifyHandleFromUrl(url)

    return {
      id: retailerId || metaId,
      title: product.name || retailerId || metaId || 'Catalog Product',
      description: product.description || '',
      price: product.price || '',
      image: product.image_url || '',
      handle,
      url,
      retailer_id: retailerId,
      metaCatalogProductId: metaId,
      metaCatalogMatched: !!retailerId,
      metaCatalogMatchedBy: 'catalog',
      source: 'meta'
    }
  })
}

function mergeShopifyProductsWithMetaCatalog(shopifyProducts = [], metaProducts = []) {
  if (!Array.isArray(shopifyProducts) || shopifyProducts.length === 0) return []
  if (!Array.isArray(metaProducts) || metaProducts.length === 0) {
    return shopifyProducts.map((product) => ({
      ...product,
      retailer_id: String(product?.retailer_id || product?.retailerId || '').trim(),
      metaCatalogMatched: false,
      metaCatalogMatchedBy: '',
      metaCatalogProductId: ''
    }))
  }

  const byRetailerId = new Map()
  const byHandle = new Map()
  const byUniqueTitle = new Map()
  const titleBuckets = new Map()

  for (const product of metaProducts) {
    const retailerIdKey = normalizeComparableValue(product.retailer_id)
    if (retailerIdKey && !byRetailerId.has(retailerIdKey)) byRetailerId.set(retailerIdKey, product)

    const handleKey = normalizeComparableValue(extractShopifyHandleFromUrl(product.url))
    if (handleKey && !byHandle.has(handleKey)) byHandle.set(handleKey, product)

    const titleKey = normalizeComparableValue(product.name)
    if (titleKey) {
      const bucket = titleBuckets.get(titleKey) || []
      bucket.push(product)
      titleBuckets.set(titleKey, bucket)
    }
  }

  for (const [titleKey, bucket] of titleBuckets.entries()) {
    if (bucket.length === 1) byUniqueTitle.set(titleKey, bucket[0])
  }

  return shopifyProducts.map((product) => {
    const explicitRetailerId = String(product?.retailer_id || product?.retailerId || '').trim()
    const retailerIdCandidate = byRetailerId.get(normalizeComparableValue(explicitRetailerId))
    const idCandidate = byRetailerId.get(normalizeComparableValue(product.id))
    const handleCandidate = byHandle.get(normalizeComparableValue(product.handle))
    const titleCandidate = byUniqueTitle.get(normalizeComparableValue(product.title))

    const matchedProduct = retailerIdCandidate || idCandidate || handleCandidate || titleCandidate || null
    const matchedBy = retailerIdCandidate
      ? 'retailer_id'
      : idCandidate
        ? 'shopify_id'
        : handleCandidate
          ? 'handle'
          : titleCandidate
            ? 'title'
            : ''

    return {
      ...product,
      retailer_id: matchedProduct?.retailer_id || explicitRetailerId || '',
      metaCatalogMatched: !!matchedProduct,
      metaCatalogMatchedBy: matchedBy,
      metaCatalogProductId: matchedProduct?.id || '',
      metaCatalogUrl: matchedProduct?.url || '',
      metaCatalogImage: matchedProduct?.image_url || '',
      metaCatalogName: matchedProduct?.name || ''
    }
  })
}

async function getStoredOrders(limit = 100) {
  return queryMany(
    'SELECT id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt FROM orders WHERE userId = ? ORDER BY createdAt IS NULL, createdAt DESC LIMIT ?',
    ['default', limit]
  )
}

async function getLatestStoredOrderByPhone(phone) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  if (!normalizedPhone) return null

  return queryOne(
    `SELECT id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt
     FROM orders
     WHERE userId = ? AND REGEXP_REPLACE(COALESCE(customerPhone, ''), '[^0-9]', '') = ?
     ORDER BY createdAt IS NULL, createdAt DESC, updatedAt IS NULL, updatedAt DESC
     LIMIT 1`,
    ['default', normalizedPhone]
  )
}

async function getStoredChats(userId = 'default') {
  return queryMany(
    'SELECT id, userId, phone, name, lastMessage, timestamp, unread, avatar FROM chats WHERE userId = ? ORDER BY timestamp IS NULL, timestamp DESC, createdAt IS NULL, createdAt DESC',
    [userId]
  )
}

async function getStoredMessagesByPhone(phone, userId = 'default') {
  return queryMany(
    'SELECT id, userId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, messageType, products, template FROM messages WHERE userId = ? AND (recipient = ? OR phone = ?) ORDER BY timestamp IS NULL, timestamp ASC, createdAt IS NULL, createdAt ASC',
    [userId, phone, phone]
  )
}

async function getStoredChatByPhone(phone, userId = 'default') {
  return queryOne(
    'SELECT id, userId, phone, name, lastMessage, timestamp, unread, avatar FROM chats WHERE userId = ? AND phone = ? LIMIT 1',
    [userId, phone]
  )
}

async function upsertStoredChat({ phone, name, lastMessage, timestamp, unread }, userId = 'default') {
  const pool = getMysqlPool()
  const existing = await getStoredChatByPhone(phone, userId)

  if (existing) {
    await pool.execute(
      'UPDATE chats SET name = ?, lastMessage = ?, timestamp = ?, unread = ?, avatar = ? WHERE id = ?',
      [
        name ?? existing.name,
        lastMessage ?? existing.lastMessage,
        timestamp ?? existing.timestamp ?? new Date(),
        unread ?? existing.unread ?? 0,
        existing.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((name ?? existing.name ?? 'Customer'))}&background=random`,
        existing.id
      ]
    )
    return getStoredChatByPhone(phone, userId)
  }

  const newChat = {
    id: uuidv4(),
    userId,
    phone,
    name: name || `Customer ${phone}`,
    lastMessage: lastMessage || 'Chat created',
    timestamp: timestamp || new Date(),
    unread: unread || 0,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Customer')}&background=random`
  }

  await pool.execute(
    'INSERT INTO chats (id, userId, phone, name, lastMessage, timestamp, unread, avatar, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
    [newChat.id, newChat.userId, newChat.phone, newChat.name, newChat.lastMessage, newChat.timestamp, newChat.unread, newChat.avatar]
  )
  return newChat
}

async function insertStoredMessage(message) {
  await getMysqlPool().execute(
    'INSERT INTO messages (id, userId, campaignId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status, messageType, products, template, orderId, sentAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
    [
      message.id,
      message.userId || 'default',
      message.campaignId || null,
      message.recipient || null,
      message.phone || null,
      message.message || null,
      message.isCustomer ?? null,
      message.timestamp || null,
      message.whatsappMessageId || null,
      message.status || null,
      message.messageType || null,
      message.products ? JSON.stringify(message.products) : null,
      message.template || null,
      message.orderId || null,
      message.sentAt || null
    ]
  )
}

async function saveStoredWebhooks(webhooks) {
  await ensureSettingsTables()

  const pool = getMysqlPool()
  const existing = await queryOne(
    'SELECT id FROM webhooks WHERE userId = ? AND type = ? ORDER BY createdAt IS NULL, createdAt DESC, id DESC LIMIT 1',
    ['default', 'shopify']
  )

  if (existing) {
    await pool.execute(
      'UPDATE webhooks SET webhooks = ?, createdAt = NOW() WHERE id = ?',
      [JSON.stringify(webhooks), existing.id]
    )
    return
  }

  await pool.execute(
    'INSERT INTO webhooks (userId, type, webhooks, createdAt) VALUES (?, ?, ?, NOW())',
    ['default', 'shopify', JSON.stringify(webhooks)]
  )
}

async function getStoredWebhooks(type = 'shopify') {
  await ensureSettingsTables()

  const result = await getMysqlPool().execute(
    'SELECT id, type, webhooks, createdAt FROM webhooks WHERE userId = ? AND type = ? ORDER BY createdAt IS NULL, createdAt DESC, id DESC LIMIT 1',
    ['default', type]
  )
  return result[0][0] || null
}

async function insertWebhookLog(type, topic, payload) {
  await ensureSettingsTables()

  await getMysqlPool().query(
    `INSERT INTO webhook_logs (id, type, topic, payload, receivedAt, createdAt)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [uuidv4(), type, topic || null, JSON.stringify(payload || {})]
  )
}

async function getWebhookLogs(limit = 10) {
  await ensureSettingsTables()

  const [rows] = await getMysqlPool().query(
    `SELECT id, type, topic, payload, receivedAt, createdAt
     FROM webhook_logs
     ORDER BY receivedAt DESC
     LIMIT ${parseInt(limit, 10) || 10}`
  )

  return rows || []
}

async function getStoredShopifyCustomer(customerId) {
  return queryOne(
    `SELECT id, customerId, phone
     FROM shopify_customers
     WHERE customerId = ?
     ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC
     LIMIT 1`,
    [customerId]
  )
}

async function upsertStoredShopifyCustomer(customerId, phone) {
  const pool = getMysqlPool()
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

async function insertStoredOrder(order) {
  await getMysqlPool().execute(
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

async function getStoredOrderByShopifyOrderId(shopifyOrderId) {
  return queryOne(
    `SELECT id, userId, shopifyOrderId, orderNumber, customerName, customerEmail, customerPhone, total, currency, status, lineItems, createdAt, updatedAt, whatsappSent, whatsappMessageId, whatsappSentAt
     FROM orders
     WHERE shopifyOrderId = ?
     LIMIT 1`,
    [shopifyOrderId]
  )
}

async function updateStoredOrderByShopifyOrderId(shopifyOrderId, patch) {
  const pool = getMysqlPool()
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
  await pool.execute(
    `UPDATE orders
     SET ${fields.join(', ')}
     WHERE shopifyOrderId = ?`,
    values
  )
}

function interpolateMessage(template, context) {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function buildAutomationTemplateComponents(templateComponents, variableMappings, context) {
  return buildAutomationTemplateComponentsShared(templateComponents, variableMappings, context)
}

function buildCatalogProductContext(products, shopify, whatsapp = null) {
  const firstProduct = products[0] || null
  const normalizedDomain = normalizeShopifyDomain(shopify?.shopDomain || '')
  const baseDomain = normalizedDomain ? `https://${normalizedDomain}` : ''
  const whatsappCatalogLink = whatsapp?.businessAccountId || whatsapp?.phoneNumberId
    ? `https://wa.me/c/${whatsapp.businessAccountId || whatsapp.phoneNumberId}`
    : ''
  const productLink = firstProduct?.url || firstProduct?.metaCatalogUrl || (firstProduct?.handle && baseDomain ? `${baseDomain}/products/${firstProduct.handle}` : '')
  const catalogLink = baseDomain ? `${baseDomain}/collections/all` : whatsappCatalogLink
  const explicitRetailerIds = products
    .map((product) => String(product?.retailer_id || product?.retailerId || '').trim())
    .filter(Boolean)
  const retailerIds = products
    .map((product) => String(product?.retailer_id || product?.retailerId || product?.id || '').trim())
    .filter(Boolean)

  return {
    product_name: firstProduct?.title || firstProduct?.name || '',
    product_price: firstProduct?.price ? String(firstProduct.price) : '',
    product_link: productLink,
    product_names: products.slice(0, 3).map((product) => product.title || product.name).filter(Boolean).join(', '),
    catalog_link: catalogLink,
    product_retailer_id: retailerIds[0] || '',
    product_retailer_ids: retailerIds,
    explicit_product_retailer_id: explicitRetailerIds[0] || '',
    explicit_product_retailer_ids: explicitRetailerIds
  }
}

function getOrderLineItemTitle(item) {
  return String(
    item?.title ||
    item?.name ||
    item?.product_title ||
    item?.productTitle ||
    item?.variant_title ||
    item?.variantTitle ||
    ''
  ).trim()
}

function buildOrderProductContext(order = null) {
  const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : []
  const itemNames = lineItems
    .map((item) => getOrderLineItemTitle(item))
    .filter(Boolean)

  return {
    order_product_name: itemNames[0] || '',
    order_product_names: itemNames.slice(0, 3).join(', ')
  }
}

function extractShopifyOrderCartIdentifiers(orderPayload = {}) {
  const checkoutToken = String(
    orderPayload.checkout_token ||
    orderPayload.checkoutToken ||
    orderPayload.token ||
    ''
  ).trim()

  const externalCartId = String(
    orderPayload.checkout_id ||
    orderPayload.checkoutId ||
    orderPayload.cart_token ||
    orderPayload.cartToken ||
    orderPayload.token ||
    ''
  ).trim()

  return {
    checkoutToken,
    externalCartId
  }
}

function resolveCatalogTemplateVariable(value, context) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''

  const normalized = trimmed.toLowerCase()
  if (normalized === '{{customer_name}}') return context.customer_name || ''
  if (normalized === '{{customer_phone}}') return context.customer_phone || ''
  if (normalized === '{{order_number}}') return context.order_number || ''
  if (normalized === '{{tracking_number}}') return context.tracking_number || ''
  if (normalized === '{{tracking_url}}') return context.tracking_url || ''
  if (normalized === '{{order_total}}') return context.order_total || ''
  if (normalized === '{{currency}}') return context.currency || ''
  if (normalized === '{{order_product_name}}') return context.order_product_name || ''
  if (normalized === '{{order_product_names}}') return context.order_product_names || ''
  if (normalized === '{{product_name}}') return context.product_name || ''
  if (normalized === '{{product_price}}') return context.product_price || ''
  if (normalized === '{{product_link}}') return context.product_link || ''
  if (normalized === '{{product_names}}') return context.product_names || ''
  if (normalized === '{{catalog_link}}') return context.catalog_link || ''

  return trimmed
}

function inferCatalogTemplateVariable(exampleText, index = 0, templateName = '') {
  const sample = String(exampleText || '').trim().toLowerCase()
  const templateLabel = String(templateName || '').trim().toLowerCase()
  const prefersOrderProductContext = /tracking|shipment|shipping|fulfill|delivery|order/i.test(templateLabel)

  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('order') && sample.includes('number')) return '{{order_number}}'
  if (sample.includes('tracking') && sample.includes('number')) return '{{tracking_number}}'
  if (sample.includes('tracking') && (sample.includes('link') || sample.includes('url'))) return '{{tracking_url}}'
  if (sample.includes('catalog') || sample.includes('collection')) return '{{catalog_link}}'
  if (sample.includes('product') && sample.includes('name')) {
    return prefersOrderProductContext ? '{{order_product_name}}' : '{{product_name}}'
  }
  if (sample.includes('product') && sample.includes('price')) return '{{product_price}}'
  if (sample.includes('product') && (sample.includes('link') || sample.includes('url'))) return '{{product_link}}'
  if (sample.includes('browse') || sample.includes('link') || sample.includes('url')) return '{{product_link}}'

  const fallbacks = prefersOrderProductContext
    ? ['{{customer_name}}', '{{order_number}}', '{{order_product_name}}', '{{tracking_url}}', '{{tracking_number}}']
    : ['{{customer_name}}', '{{catalog_link}}', '{{product_name}}', '{{product_link}}', '{{product_price}}']
  return fallbacks[index] || '{{catalog_link}}'
}

function getTemplateSlotExamples(component, groupKey) {
  const exampleGroup = component?.example?.[groupKey]
  if (Array.isArray(exampleGroup) && Array.isArray(exampleGroup[0])) return exampleGroup[0]
  return []
}

function getTemplateParameterSlots(templateComponents = []) {
  const slots = []

  for (const component of templateComponents) {
    if (component?.type === 'HEADER' && component.format === 'TEXT') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateSlotExamples(component, 'header_text')
      matches.forEach((_match, index) => {
        slots.push({
          componentType: 'HEADER',
          parameterType: 'text',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getTemplateSlotExamples(component, 'body_text')
      matches.forEach((_match, index) => {
        slots.push({
          componentType: 'BODY',
          parameterType: 'text',
          example: examples[index] || ''
        })
      })
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button) => {
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((_match, index) => {
          slots.push({
            componentType: 'BUTTON',
            parameterType: 'text',
            buttonType: String(button.type || '').toUpperCase(),
            example: button?.example?.[index] || ''
          })
        })
      })
    }
  }

  return slots
}

function isProductDependentTemplateVariable(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized === '{{product_name}}' ||
    normalized === '{{product_price}}' ||
    normalized === '{{product_link}}' ||
    normalized === '{{product_names}}'
  )
}

function isOrderDependentTemplateVariable(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized === '{{order_number}}' ||
    normalized === '{{tracking_number}}' ||
    normalized === '{{tracking_url}}' ||
    normalized === '{{order_total}}' ||
    normalized === '{{currency}}' ||
    normalized === '{{order_product_name}}' ||
    normalized === '{{order_product_names}}'
  )
}

function templateRequiresProductContext(templateComponents = [], templateVariables = [], templateName = '') {
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferCatalogTemplateVariable(slot.example, index, templateName)
  ))

  if (resolvedVariableOrder.some((value) => isProductDependentTemplateVariable(value))) {
    return true
  }

  return templateComponents.some((component) => (
    component?.type === 'BUTTONS' &&
    Array.isArray(component.buttons) &&
    component.buttons.some((button) => {
      const buttonType = String(button?.type || '').toUpperCase()
      return buttonType === 'MPM' || buttonType === 'CATALOG'
    })
  ))
}

function templateRequiresOrderContext(templateComponents = [], templateVariables = [], templateName = '') {
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferCatalogTemplateVariable(slot.example, index, templateName)
  ))

  return resolvedVariableOrder.some((value) => isOrderDependentTemplateVariable(value))
}

function buildCatalogTemplatePayload({ templateName, templateLanguage, templateComponents = [], templateVariables = [], templateHeaderImageUrl = '', productContext, recipientContext }) {
  const mergedContext = { ...productContext, ...recipientContext }
  const slots = getTemplateParameterSlots(templateComponents)
  const resolvedVariableOrder = slots.map((slot, index) => (
    typeof templateVariables[index] === 'string' && templateVariables[index].trim()
      ? templateVariables[index].trim()
      : inferCatalogTemplateVariable(slot.example, index, templateName)
  ))

  let cursor = 0
  const components = []

  for (const component of templateComponents) {
    if (component?.type === 'HEADER') {
      if (component.format === 'IMAGE') {
        if (!templateHeaderImageUrl) {
          throw new Error('Template requires an image header. Upload an image or provide a public image URL.')
        }

        const headerUrl = templateHeaderImageUrl.trim()
        if (headerUrl.startsWith('http://localhost') || headerUrl.startsWith('http://0.0.0.0') || headerUrl.startsWith('http://127.0.0.1')) {
          throw new Error(`Header image URL must be publicly accessible. "${headerUrl}" points to a local server.`)
        }

        components.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: headerUrl }
            }
          ]
        })
      } else if (component.format === 'VIDEO') {
        if (!templateHeaderImageUrl) {
          throw new Error('Template requires a video header but no public video URL was provided.')
        }

        components.push({
          type: 'header',
          parameters: [
            {
              type: 'video',
              video: { link: templateHeaderImageUrl.trim() }
            }
          ]
        })
      } else if (component.format === 'TEXT') {
        const matches = component.text?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'header',
            parameters: matches.map(() => {
              const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
              cursor += 1
              return { type: 'text', text: value }
            })
          })
        }
      }
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      if (matches.length > 0) {
        components.push({
          type: 'body',
          parameters: matches.map(() => {
            const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
            cursor += 1
            return { type: 'text', text: value }
          })
        })
      }
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase()

        if (buttonType === 'MPM') {
          const retailerIds = Array.isArray(productContext.explicit_product_retailer_ids) ? productContext.explicit_product_retailer_ids : []
          if (retailerIds.length === 0) {
            throw new Error('This template requires Meta retailer IDs for the selected products. Sync or map your Meta catalog retailer_id values before sending MPM templates.')
          }

          components.push({
            type: 'button',
            sub_type: 'mpm',
            index: String(buttonIndex),
            parameters: [
              {
                type: 'action',
                action: {
                  thumbnail_product_retailer_id: retailerIds[0],
                  sections: [
                    {
                      title: 'Products',
                      product_items: retailerIds.slice(0, 30).map((productRetailerId) => ({
                        product_retailer_id: productRetailerId
                      }))
                    }
                  ]
                }
              }
            ]
          })
          return
        }

        if (buttonType === 'CATALOG') {
          const retailerId = productContext.explicit_product_retailer_id
          if (!retailerId) {
            throw new Error('This template requires a Meta retailer ID for the selected product. Sync or map the product retailer_id before sending catalog-button templates.')
          }

          components.push({
            type: 'button',
            sub_type: 'catalog',
            index: String(buttonIndex),
            parameters: [
              {
                type: 'action',
                action: {
                  thumbnail_product_retailer_id: retailerId
                }
              }
            ]
          })
          return
        }

        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        if (matches.length > 0) {
          components.push({
            type: 'button',
            sub_type: buttonType.toLowerCase(),
            index: String(buttonIndex),
            parameters: matches.map(() => {
              const value = resolveCatalogTemplateVariable(resolvedVariableOrder[cursor] || '', mergedContext)
              cursor += 1
              return { type: 'text', text: value }
            })
          })
        }
      })
    }
  }

  const templatePayload = {
    name: templateName,
    language: {
      code: templateLanguage || 'en_US'
    }
  }

  if (components.length > 0) {
    templatePayload.components = components
  }

  return templatePayload
}

function parseDelayToMs(step) {
  const value = parseInt(step.delayValue || '0', 10)
  if (!value) return 0
  if (step.delayUnit === 'minutes') return value * 60 * 1000
  if (step.delayUnit === 'days') return value * 24 * 60 * 60 * 1000
  return value * 60 * 60 * 1000
}

function getSequentialStepId(steps, currentStepId) {
  const index = steps.findIndex((step) => step.id === currentStepId)
  if (index === -1) return ''
  return steps[index + 1]?.id || ''
}

function getNextAutomationStepId(steps, step, key = 'main') {
  if (!step) return '';
  
  // 1. Check for explicit connections for the requested key (main/fallback/opt0/etc)
  if (step.connections && step.connections[key]) {
    return step.connections[key];
  }
  
  // 2. If it's a message step and we are looking for 'main', check for a generic sequential next step
  // BUT only if there are NO other explicit connections defined (to avoid bleeding branches)
  if (key === 'main' && step.type === 'message') {
    const hasAnyConnections = step.connections && Object.keys(step.connections).length > 0;
    if (!hasAnyConnections) {
      return getSequentialStepId(steps, step.id);
    }
  }

  return '';
}

/**
 * Defensive Routing: Robustly matches an interactive button/list choice to a next step.
 * Uses multiple fallback layers: Direct ID -> Precise Title -> Normalized Title -> Index Fallback.
 */
function resolveInteractiveBranch(step, chosenId, chosenTitle) {
  if (!step || !step.connections) return '';
  
  // 1. Precise ID Match (The Gold Standard)
  if (chosenId && step.connections[chosenId]) return step.connections[chosenId];
  
  // 2. Precise Title Match
  if (chosenTitle && step.connections[chosenTitle]) return step.connections[chosenTitle];
  
  // 3. Normalized Title Match (Case-insensitive, trimmed)
  const cleanTitle = (chosenTitle || '').trim().toLowerCase().replace(/^✅\s*/, '');
  if (cleanTitle) {
    for (const [key, target] of Object.entries(step.connections)) {
      if (key.trim().toLowerCase() === cleanTitle) return target;
    }
    // Also check if any option label matches this title, and use that option's ID
    if (Array.isArray(step.options)) {
      const matchingOpt = step.options.find(o => (o.label || '').trim().toLowerCase() === cleanTitle);
      if (matchingOpt && step.connections[matchingOpt.id]) return step.connections[matchingOpt.id];
    }
  }

  // 4. Index-based Fallback (For legacy data or out-of-sync 'opt0' labels)
  const optMatch = (chosenId || '').match(/^opt(\d+)$/);
  if (optMatch && Array.isArray(step.options)) {
    const idx = parseInt(optMatch[1]);
    const optionAtIdx = step.options[idx];
    if (optionAtIdx && optionAtIdx.id && step.connections[optionAtIdx.id]) {
      console.log(`[Defensive Routing] Index fallback matched: idx=${idx}, optId=${optionAtIdx.id}`);
      return step.connections[optionAtIdx.id];
    }
  }

  return '';
}

function matchesCondition(rule, context) {
  if (!rule) return true
  const trimmed = rule.trim()
  if (trimmed.includes(' contains_any ')) {
    const [left, right] = trimmed.split(' contains_any ').map((value) => value.trim())
    const haystack = String(context[left] ?? '').toLowerCase()
    return right.split('|').some((token) => haystack.includes(token.trim().toLowerCase()))
  }
  if (trimmed.includes(' not contains ')) {
    const [left, right] = trimmed.split(' not contains ').map((value) => value.trim())
    return !String(context[left] ?? '').toLowerCase().includes(right.toLowerCase())
  }
  if (trimmed.includes(' contains ')) {
    const [left, right] = trimmed.split(' contains ').map((value) => value.trim())
    return String(context[left] ?? '').toLowerCase().includes(right.toLowerCase())
  }
  if (trimmed.includes('!=')) {
    const [left, right] = trimmed.split('!=').map((value) => value.trim())
    return String(context[left] ?? '') !== right
  }
  if (trimmed.includes('=')) {
    const [left, right] = trimmed.split('=').map((value) => value.trim())
    return String(context[left] ?? '') === right
  }
  return true
}

function buildIncomingWhatsAppAutomationContext(messageData, savedMessage, contact) {
  const textBody = messageData?.text?.body || savedMessage?.message || ''
  const displayName =
    contact?.profile?.name ||
    contact?.wa_id ||
    savedMessage?.recipient ||
    'Customer'

  // Detect button / list reply from interactive messages
  const interactiveReply = messageData?.interactive?.button_reply || messageData?.interactive?.list_reply || null
  const chosenButtonId = interactiveReply?.id || null    // e.g. 'opt0', 'opt1', ...
  const chosenButtonTitle = interactiveReply?.title || ''

  return {
    customer_name: displayName,
    customer_phone: messageData?.from || savedMessage?.recipient || '',
    customerPhone: messageData?.from || savedMessage?.recipient || '',
    customer_message: messageData?.text?.body || chosenButtonTitle || savedMessage?.message || '',
    financial_status: '',
    order_number: '',
    tracking_number: '',
    tracking_url: '',
    review_link: process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com/review',
    order_total: '',
    currency: 'INR',
    // Internal: used to send typing indicator / read-receipt before replies
    _inboundWamid: messageData?.id || null,
    // Internal: set when this message is an interactive button/list selection
    _isInteractiveReply: messageData?.type === 'interactive',
    _chosenOptionId: chosenButtonId  // 'opt0', 'opt1', etc.
  }
}

async function queueAutomationJob(automationId, recipient, message, template, payload, runAt, userId = 'default') {
  const pool = getMysqlPool()
  if (!pool) return

  await pool.execute(
    `INSERT INTO automation_jobs (id, automationId, userId, recipient, message, template, payload, status, runAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
    [uuidv4(), automationId, userId, recipient, message, template || null, JSON.stringify(payload || {}), runAt]
  )
}

async function incrementAutomationSentMetric(automationId) {
  const pool = getMysqlPool()
  if (!pool) return

  await pool.execute(
    `UPDATE automations
     SET metrics = JSON_SET(COALESCE(metrics, '{}'), '$.sent', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.sent')), 0) + 1),
         updatedAt = NOW()
     WHERE id = ?`,
    [automationId]
  )
}

function resolveAutomationRecipient(step, context) {
  if (step?.recipientMode === 'fixed_number') {
    const fixedRecipient = typeof step.recipientNumber === 'string' ? step.recipientNumber.replace(/\D/g, '') : ''
    return fixedRecipient || null
  }

  const customerRecipient = typeof context.customerPhone === 'string' ? context.customerPhone.replace(/\D/g, '') : ''
  return customerRecipient || null
}

// ─── Smooth Conversation Helpers ────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate a human-like delay (ms) based on message length.
 * Short messages: ~0.8s, longer messages: up to ~3s.
 */
function calcTypingDelay(text = '') {
  const chars = String(text || '').length
  // ~60 WPM typing speed ≈ 5 chars/sec. Add a 600ms base read delay.
  // Reduced base delay and faster character processing
  const typingMs = Math.min(Math.ceil(chars / 10) * 100, 1500)
  return 200 + typingMs
}

/**
 * Send a "typing" indicator via WhatsApp status API so the customer
 * sees the animated typing dots before the message arrives.
 */
async function sendTypingIndicator(phoneNumberId, accessToken, to, wamid) {
  if (!wamid) return
  try {
    await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        ...buildMetaAuthHeaders(accessToken),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: wamid
      })
    })
  } catch {
    // Non-critical — ignore errors
  }
}

async function executeAutomationsForEvent(eventType, context, integrations, userId = 'default') {
  console.log('executeAutomationsForEvent called:', eventType, 'context:', JSON.stringify(context))
  
  const pool = getMysqlPool()
  if (!pool || !integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
    console.log('executeAutomationsForEvent skipped: no pool or WhatsApp not configured')
    return
  }

  // Only fetch automations matching this event type
  const [rows] = await query(
    `SELECT id, name, steps, metrics
     FROM automations
     WHERE userId = ? AND status = 1`,
    [userId]
  )
  console.log('[executeAutomationsForEvent] active automation rows:', Array.isArray(rows) ? rows.length : 0, 'for user:', userId)
  
  // Parse JSON columns from MySQL
  const automations = (rows || []).map(row => ({
    ...row,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps
  }))

  console.log('Found automations:', automations.map(a => a.id).join(', '))

  for (const automation of automations) {
    const steps = Array.isArray(automation.steps) ? automation.steps : []
    const trigger = steps.find((step) => step.type === 'trigger')
    const isIncomingWhatsAppAutomation = eventType === 'whatsapp.message_received'
    const conversationRecipient = isIncomingWhatsAppAutomation
      ? normalizeAutomationRecipientKey(resolveAutomationRecipient({ recipientMode: 'customer' }, context))
      : ''
    const now = new Date()
    let conversationState = null

    if (isIncomingWhatsAppAutomation && conversationRecipient) {
      console.log(`[executeAutomationsForEvent] Checking state for ${automation.id} / ${conversationRecipient}`)
      conversationState = await getAutomationConversationState(automation.id, conversationRecipient, userId)
    }

    const eventMatches = trigger && trigger.event === eventType
    const isInteractiveReply = isIncomingWhatsAppAutomation && context?._isInteractiveReply
    const isWaitingForThisReply = isInteractiveReply && conversationState?.awaitingInteractiveStepId

    if (!eventMatches && !isWaitingForThisReply) {
      console.log(`Automation ${automation.id}: skipped (no event match and not waiting for reply)`)
      continue
    }

    console.log(`Processing automation: ${automation.id}, steps count: ${steps.length}, isInteractiveReply: ${isInteractiveReply}`)

    if (isIncomingWhatsAppAutomation && conversationRecipient && conversationState) {
      if (isHandoffActive(conversationState, now)) {
        console.log('Clearing handoff - customer sent new message')
        conversationState = await saveAutomationConversationState(
          automation.id,
          conversationRecipient,
          conversationState,
          {
            state: 'active',
            lastInboundAt: now,
            handoffUntil: null
          },
          userId
        )
      }
    }

    let totalDelayMs = 0
    const inboundWamid = context?._inboundWamid || null
    let messagesSentInThisRun = 0
    let isReplyingToMenu = false

    // ── If customer is replying to an interactive menu, jump straight to it ──
    // This avoids re-walking the entire flow from the trigger.
    let currentStepId = ''
    if (isIncomingWhatsAppAutomation && context._isInteractiveReply && context._chosenOptionId) {
      console.log(`[executeAutomationsForEvent] Interactive Reply Detected: automation=${automation.id}, option=${context._chosenOptionId}, awaiting=${conversationState?.awaitingInteractiveStepId}`)
      
      if (conversationState?.awaitingInteractiveStepId) {
        const lastStep = steps.find(s => s.id === conversationState.awaitingInteractiveStepId)
        console.log(`[executeAutomationsForEvent] Awaiting step found: id=${lastStep?.id}, type=${lastStep?.type}`)
        
        // Try the new Defensive Routing
        const rawTitle = context.customer_message || ''
        const branchTarget = resolveInteractiveBranch(lastStep, context._chosenOptionId, rawTitle)
        
        if (branchTarget) {
          currentStepId = branchTarget
          isReplyingToMenu = true
          console.log(`[executeAutomationsForEvent] FOUND BRANCH (Defensive): id=${context._chosenOptionId}, title="${rawTitle}" -> target=${currentStepId}`)
          
          // Clear the awaiting state
          conversationState = await saveAutomationConversationState(
            automation.id, conversationRecipient, conversationState,
            { state: 'active', awaitingInteractiveStepId: null, lastReplyKey: context._chosenOptionId, lastReplyAt: now },
            userId
          )
        } else if (lastStep?.type === 'ai_reply') {
          // If it's an AI reply but no specific branch, loop back to the AI node
          // The option label will be treated as the next customer message.
          currentStepId = lastStep.id
          isReplyingToMenu = true
          console.log(`[executeAutomationsForEvent] AI OPTION CLICKED: title="${rawTitle}". Re-triggering AI node ${currentStepId}`)
          
          conversationState = await saveAutomationConversationState(
            automation.id, conversationRecipient, conversationState,
            { state: 'active', awaitingInteractiveStepId: null, lastReplyKey: context._chosenOptionId, lastReplyAt: now },
            userId
          )
        } else {
          console.log(`[executeAutomationsForEvent] NO CONNECTION for ${context._chosenOptionId} in step ${lastStep?.id}. Connections: ${JSON.stringify(lastStep?.connections)}`)
        }
      } else {
        console.log(`[executeAutomationsForEvent] No awaitingInteractiveStepId in state for ${automation.id}. If this reply was for THIS automation, state might have been lost.`)
      }
      
      // CRITICAL: If this is an interactive reply but we didn't find a matching branch for THIS automation,
      // skip this automation entirely.
      if (!currentStepId) {
        console.log(`[executeAutomationsForEvent] SKIPPING automation ${automation.id}: Interactive reply doesn't belong here.`)
        continue
      }
    }

    if (!currentStepId) {
      const triggerIndex = steps.findIndex((s) => s.type === 'trigger' && s.event === eventType)
      if (triggerIndex !== -1) {
        const triggerNode = steps[triggerIndex]
        currentStepId = getNextAutomationStepId(steps, triggerNode, 'main')
        console.log(`[executeAutomationsForEvent] STARTING NEW FLOW. Trigger: ${triggerNode.id}, First Step: ${currentStepId}`)
      }
    }

    // After routing through an interactive choice we track when the first reply
    // message has been sent so we can STOP — prevents the sequential auto-connection
    // chain in mapStep from firing all sibling reply nodes.
    let sentAfterChoice = false

    const visited = new Set([trigger.id])

    while (currentStepId && !visited.has(currentStepId)) {
      visited.add(currentStepId)
      const step = steps.find((item) => item.id === currentStepId)
      console.log('Processing step:', step?.id, step?.type, step?.title)
      if (!step) {
        console.log('Step not found, breaking')
        break
      }

      if (step.type === 'condition') {
        console.log('Checking condition:', step.rule, 'context:', JSON.stringify(context))
        const passed = matchesCondition(step.rule, context)
        console.log('Condition passed:', passed)
        currentStepId = getNextAutomationStepId(steps, step, passed ? 'main' : 'fallback')
        console.log('Next step ID:', currentStepId)
        continue
      }

      if (step.type === 'delay') {
        console.log('Processing delay:', step.delayValue, step.delayUnit)
        totalDelayMs += parseDelayToMs(step)
        currentStepId = getNextAutomationStepId(steps, step, 'main')
        continue
      }

      if (step.type === 'ai_reply') {
        console.log('Processing AI reply step:', step.id);
        
        const recipient = resolveAutomationRecipient(step, context);
        if (!recipient) {
          currentStepId = getNextAutomationStepId(steps, step, 'main');
          continue;
        }

        const messageText = context.customer_message || context.message || "";
        
        // Fetch Knowledge Base
        const [kbRows] = await getMysqlPool().query(
          'SELECT content FROM knowledge_base WHERE userId = ?',
          [userId]
        );
        
        const kbContent = kbRows.map(r => r.content).join("\n\n");
        console.log(`[AI Reply] Found KB entries: ${kbRows.length}, Total KB length: ${kbContent.length}`);
        const businessName = integrations.whatsapp?.name || "Our Business";

        // Fetch recent conversation history for better AI context
        const recentMessages = await getStoredMessagesByPhone(recipient, userId);
        const lastFewMessages = recentMessages.slice(-8); // Get last 8 messages for context

        // Generate AI Response with History and Fallback support
        let aiBody = "";
        try {
          aiBody = await generateAIResponse(messageText, kbContent, businessName, lastFewMessages);
          
          // Parse options from AI body: [[Option: Label]]
          const optionRegex = /\[\[Option:\s*(.*?)\s*\]\]/g;
          const aiOptions = [];
          let match;
          while ((match = optionRegex.exec(aiBody)) !== null) {
            if (aiOptions.length < 3) aiOptions.push(match[1].trim());
          }
          const cleanedAiBody = aiBody.replace(optionRegex, '').trim();

          // Split cleaned body into multiple messages
          const parts = cleanedAiBody.split(/\n\n+/).filter(p => p.trim().length > 0);
          console.log(`[AI Reply] Splitting response into ${parts.length} messages. Options: ${aiOptions.join(', ')}`);

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLastPart = i === parts.length - 1;
            
            // Delay between messages to simulate "typing" (skip for first message)
            if (i > 0) {
              const delayMs = Math.min(1500, 400 + (part.length * 10)); 
              await sleep(delayMs);
            }

            let messageData;
            if (isLastPart && aiOptions.length > 0) {
              // Send last part as interactive message with buttons
              messageData = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'interactive',
                interactive: {
                  type: 'button',
                  body: { text: part },
                  action: {
                    buttons: aiOptions.map((opt, idx) => ({
                      type: 'reply',
                      reply: { id: `ai_opt_${idx}`, title: opt.substring(0, 20) }
                    }))
                  }
                }
              };
            } else {
              // Regular text message
              messageData = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { body: part }
              };
            }

            const partResult = await sendWhatsAppMessage(
              integrations.whatsapp.phoneNumberId,
              integrations.whatsapp.accessToken,
              recipient,
              messageData
            );

            messagesSentInThisRun++;

            // AUTOMATIC HANDOFF DETECTION
            const isHandoffResponse = part.toLowerCase().includes('human agent') || 
                                     part.toLowerCase().includes('transfer') ||
                                     part.toLowerCase().includes('wait a moment');

            if (isHandoffResponse && conversationRecipient) {
              conversationState = await saveAutomationConversationState(
                automation.id, conversationRecipient, conversationState,
                { state: 'handoff', handoffUntil: new Date(Date.now() + 86400000) },
                userId
              );
            }

            await insertStoredMessage({
              id: uuidv4(), userId, recipient, phone: recipient,
              message: aiOptions.length > 0 && isLastPart ? `[AI Menu] ${part}` : part,
              isCustomer: false, timestamp: new Date(),
              whatsappMessageId: partResult?.messages?.[0]?.id || '',
              status: 'sent', messageType: 'ai_assistant'
            });

            // If we sent buttons, set state to awaiting choice
            if (isLastPart && aiOptions.length > 0 && isIncomingWhatsAppAutomation && conversationRecipient) {
              conversationState = await saveAutomationConversationState(
                automation.id, conversationRecipient, conversationState,
                { state: 'awaiting_choice', awaitingInteractiveStepId: step.id, lastReplyKey: step.id, lastReplyAt: now },
                userId
              );
            }
          }

          currentStepId = getNextAutomationStepId(steps, step, 'main');
        } catch (error) {
          console.error(`[AI Reply] Error: ${error.message}`);
          // Check if there is a fallback connection
          const fallbackId = getNextAutomationStepId(steps, step, 'fallback');
          if (fallbackId) {
            console.log(`[AI Reply] AI Failed. Triggering fallback path: ${fallbackId}`);
            currentStepId = fallbackId;
          } else {
            console.log(`[AI Reply] AI Failed and no fallback found. Stopping.`);
            currentStepId = '';
          }
        }
        continue;
      }

      if (step.type === 'message') {
        console.log('Processing message step:', step.id, step.title, 'template:', step.template, 'message:', step.message?.substring(0, 50))

        const recipient = resolveAutomationRecipient(step, context)
        if (!recipient) {
          currentStepId = getNextAutomationStepId(steps, step, 'main')
          continue
        }

        if (
          isIncomingWhatsAppAutomation &&
          conversationRecipient &&
          normalizeAutomationRecipientKey(recipient) === conversationRecipient &&
          shouldSuppressWhatsAppAutomationStep(step, conversationState, now)
        ) {
          currentStepId = getNextAutomationStepId(steps, step, 'main')
          continue
        }

        const body = interpolateMessage(step.message, context)

        if (totalDelayMs > 0) {
          await queueAutomationJob(
            automation.id,
            recipient,
            body,
            step.template,
            {
              ...context,
              recipientMode: step.recipientMode || 'customer',
              recipientNumber: step.recipientNumber || '',
              templateLanguage: step.templateLanguage || 'en_US',
              templateComponents: step.templateComponents || [],
              variableMappings: step.variableMappings || []
            },
            new Date(Date.now() + totalDelayMs),
            userId
          )

          if (isIncomingWhatsAppAutomation && conversationRecipient && normalizeAutomationRecipientKey(recipient) === conversationRecipient) {
            conversationState = await saveAutomationConversationState(
              automation.id,
              conversationRecipient,
              conversationState,
              {
                state: WHATSAPP_SUPPORT_STEP_IDS.has(step.id) ? 'handoff' : (WHATSAPP_MENU_STEP_IDS.has(step.id) ? 'awaiting_choice' : 'active'),
                lastMenuSentAt: WHATSAPP_MENU_STEP_IDS.has(step.id) ? now : conversationState?.lastMenuSentAt,
                lastReplyKey: step.id,
                lastReplyAt: now,
                handoffUntil: WHATSAPP_SUPPORT_STEP_IDS.has(step.id)
                  ? new Date(now.getTime() + WHATSAPP_SUPPORT_HANDOFF_MS)
                  : conversationState?.handoffUntil
              },
              userId
            )
          }

          currentStepId = getNextAutomationStepId(steps, step, 'main')
          continue
        }

        try {
          // ── Smooth conversation: typing delay between consecutive messages ──
          if (isIncomingWhatsAppAutomation) {
            const typingDelay = calcTypingDelay(body)
            // For the very first reply: mark message as read + short "reading" pause
            // For subsequent replies: longer pause so each feels like a separate thought
            const pauseMs = messagesSentInThisRun === 0
              ? Math.min(typingDelay, 1500)
              : typingDelay
            // Show typing indicator (read receipt) only for the first message
            if (messagesSentInThisRun === 0 && inboundWamid) {
              await sendTypingIndicator(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                recipient,
                inboundWamid
              )
            }
            await sleep(pauseMs)
          }

          const templateComponents = buildAutomationTemplateComponents(step.templateComponents, step.variableMappings, context)
          const messageData = step.template
            ? {
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'template',
              template: {
                name: step.template,
                language: {
                  code: step.templateLanguage || 'en_US'
                },
                ...(templateComponents ? { components: templateComponents } : {})
              }
            }
            : {
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'text',
              text: { body }
            }

          const result = await sendWhatsAppMessage(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            recipient,
            messageData
          )

          messagesSentInThisRun++
          if (isReplyingToMenu) sentAfterChoice = true

          await insertStoredMessage({
            id: uuidv4(),
            userId,
            recipient,
            phone: recipient,
            message: body,
            isCustomer: false,
            timestamp: new Date(),
            whatsappMessageId: result.messages?.[0]?.id,
            status: 'sent',
            template: step.template || null
          })

          await incrementAutomationSentMetric(automation.id)

          if (isIncomingWhatsAppAutomation && conversationRecipient && normalizeAutomationRecipientKey(recipient) === conversationRecipient) {
             // Dynamically determine if this step is a menu (has branching options)
            const hasBranching = step.connections && Object.keys(step.connections).some(k => k !== 'main')
            const isSupport = body.toLowerCase().includes('support') || body.toLowerCase().includes('agent')
            
            conversationState = await saveAutomationConversationState(
              automation.id,
              conversationRecipient,
              conversationState,
              {
                state: isSupport ? 'handoff' : (hasBranching ? 'awaiting_choice' : 'active'),
                lastMenuSentAt: hasBranching ? now : conversationState?.lastMenuSentAt,
                lastReplyKey: step.id,
                lastReplyAt: now,
                awaitingInteractiveStepId: hasBranching ? step.id : null,
                handoffUntil: isSupport
                  ? new Date(now.getTime() + 86400000) // 24h default
                  : conversationState?.handoffUntil
              },
              userId
            )
          }
        } catch (error) {
          console.error(`Automation ${automation.name} failed:`, error.message)
        }

        currentStepId = getNextAutomationStepId(steps, step, 'main')
        console.log(`[executeAutomationsForEvent] Step completed. Next step: ${currentStepId || 'END'}`)
        continue
      }

      // ── Interactive Menu step ─────────────────────────────────────────────
      if (step.type === 'interactive') {
        const recipient = resolveAutomationRecipient({ recipientMode: 'customer' }, context)
        console.log('[Interactive Step] recipient:', recipient, 'conversationRecipient:', conversationRecipient, 'isReply:', context._isInteractiveReply, 'option:', context._chosenOptionId)
        
        // Check if this is a reply to a previous menu
        console.log('[Interactive Step] awaitingInteractiveStepId:', conversationState?.awaitingInteractiveStepId, 'step.id:', step.id)
        
        if (!recipient) break

        // If this is a button reply that matches the step we're waiting on, route to the chosen branch
        if (
          isIncomingWhatsAppAutomation &&
          context._isInteractiveReply &&
          conversationState?.awaitingInteractiveStepId === step.id
        ) {
          const chosenId = context._chosenOptionId
          const rawTitle = context.customer_message || ''
          const nextId = resolveInteractiveBranch(step, chosenId, rawTitle)
          
          if (nextId) {
            console.log(`[Interactive Step] Local jump successful (Defensive): ${chosenId}/${rawTitle} -> ${nextId}`)
            // Clear awaiting state and follow the chosen branch
            conversationState = await saveAutomationConversationState(
              automation.id, conversationRecipient, conversationState,
              { state: 'active', awaitingInteractiveStepId: null, lastInboundAt: now },
              userId
            )
            // Mark that the next message must be the ONLY reply (don't chain siblings)
            sentAfterChoice = false
            currentStepId = nextId
            // If nextId is another interactive step, loop will handle it. Otherwise send one msg.
            continue
          }
        }

        // Otherwise – send the interactive menu and STOP waiting for choice
        try {
          if (isIncomingWhatsAppAutomation && inboundWamid && messagesSentInThisRun === 0) {
            await sendTypingIndicator(integrations.whatsapp.phoneNumberId, integrations.whatsapp.accessToken, recipient, inboundWamid)
          }
          if (isIncomingWhatsAppAutomation) {
            await sleep(calcTypingDelay(step.message || ''))
          }

          const options = Array.isArray(step.options) ? step.options : []
          const menuData = {
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'interactive',
            interactive: {
              type: 'list',
              body: { text: interpolateMessage(step.message, context) },
              action: {
                button: 'Choose an option',
                sections: [{
                  title: 'Options',
                  rows: options.map((opt, idx) => ({
                    id: opt.id || `opt${idx}`,
                    title: String(opt.label || `Option ${idx + 1}`).substring(0, 24),
                    description: ''
                  }))
                }]
              }
            }
          }

          const result = await sendWhatsAppMessage(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            recipient,
            menuData
          )
          messagesSentInThisRun++

          await insertStoredMessage({
            id: uuidv4(), userId,
            recipient, phone: recipient,
            message: `[Menu] ${step.message}`,
            isCustomer: false, timestamp: new Date(),
            whatsappMessageId: result.messages?.[0]?.id, status: 'sent'
          })
          await incrementAutomationSentMetric(automation.id)

          // Save state: waiting for the customer to pick an option
          if (isIncomingWhatsAppAutomation && conversationRecipient) {
            conversationState = await saveAutomationConversationState(
              automation.id, conversationRecipient, conversationState,
              {
                state: 'awaiting_choice',
                awaitingInteractiveStepId: step.id,
                lastMenuSentAt: now,
                lastReplyKey: step.id,
                lastReplyAt: now
              },
              userId
            )
          }
        } catch (error) {
          console.error(`Interactive menu send failed in ${automation.name}:`, error.message)
        }

        // Always STOP after sending an interactive menu – wait for the customer's reply
        break
      }

      currentStepId = getNextAutomationStepId(steps, step, 'main')
    }
  }
}

async function processDueAutomationJobs() {
  const pool = getMysqlPool()
  if (!pool) return

  const jobs = await queryMany(
    `SELECT id, automationId, userId, recipient, message, template, payload
     FROM automation_jobs
     WHERE status = 'pending' AND runAt <= NOW()
     ORDER BY runAt ASC
     LIMIT 10`
  )

  for (const job of jobs) {
    try {
      const jobUserId = job.userId || 'default'
      const integrations = await getStoredIntegrations(jobUserId)
      if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
        continue
      }
      const cartSessionId = job.payload?.cart_session_id || null
      const cartExternalId = job.payload?.external_cart_id || job.payload?.cart_id || null
      const cartCheckoutToken = job.payload?.checkout_token || null
      const cartPlatform = job.payload?.platform || null

      if (cartSessionId || cartExternalId || cartCheckoutToken) {
        const cartSession = await queryOne(
          `SELECT id, status
           FROM cart_recovery_sessions
           WHERE (
             (? IS NOT NULL AND id = ?)
             OR (? IS NOT NULL AND external_cart_id = ?)
             OR (? IS NOT NULL AND checkout_token = ?)
           )
           AND (? IS NULL OR platform = ?)
           ORDER BY updatedAt DESC
           LIMIT 1`,
          [cartSessionId, cartSessionId, cartExternalId, cartExternalId, cartCheckoutToken, cartCheckoutToken, cartPlatform, cartPlatform]
        )

        if (cartSession && cartSession.status !== 'abandoned') {
          await query(
            `UPDATE automation_jobs
             SET status = 'cancelled',
                 processedAt = NOW(),
                 payload = JSON_SET(COALESCE(payload, '{}'), '$.cancelled_reason', ?)
             WHERE id = ?`,
            ['cart_not_abandoned', job.id]
          )
          continue
        }
      }

      const templateComponents = buildAutomationTemplateComponents(job.payload?.templateComponents, job.payload?.variableMappings, job.payload || {})
      const result = await sendWhatsAppMessage(
        integrations.whatsapp.phoneNumberId,
        integrations.whatsapp.accessToken,
        job.recipient,
        job.template
          ? {
            messaging_product: 'whatsapp',
            to: job.recipient.replace(/\D/g, ''),
            type: 'template',
            template: {
              name: job.template,
              language: {
                code: job.payload?.templateLanguage || 'en_US'
              },
              ...(templateComponents ? { components: templateComponents } : {})
            }
          }
          : {
            messaging_product: 'whatsapp',
            to: job.recipient.replace(/\D/g, ''),
            type: 'text',
            text: { body: job.message }
          }
      )

      await insertStoredMessage({
        id: uuidv4(),
        userId: jobUserId,
        recipient: job.recipient,
        phone: job.recipient,
        message: job.message,
        isCustomer: false,
        timestamp: new Date(),
        whatsappMessageId: result.messages?.[0]?.id,
        status: 'sent',
        template: job.template || null
      })

      await query(
        `UPDATE automation_jobs
         SET status = 'sent', processedAt = NOW()
         WHERE id = ?`,
        [job.id]
      )

      await incrementAutomationSentMetric(job.automationId)
    } catch (error) {
      await query(
        `UPDATE automation_jobs
         SET status = 'failed', processedAt = NOW(), payload = JSON_SET(COALESCE(payload, '{}'), '$.error', ?)
         WHERE id = ?`,
        [error.message, job.id]
      )
    }
  }
}

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse('', { status: 200 }))
}

// WhatsApp API functions
async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  // Updated to use the same version as your working cURL command
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })

  const data = await response.json()

  // Improved error handling to ensure we only return success when the message is actually sent
  if (!response.ok) {
    console.error('WhatsApp API Error:', data);
    const metaMessage = mapMetaAccessTokenError(data.error?.message || `WhatsApp API error: ${response.status} ${response.statusText}`)
    const unsupportedPost = /unsupported post request/i.test(metaMessage)
    if (unsupportedPost || data.error?.code === 100) {
      throw new Error('Phone Number ID is invalid, inaccessible for this token, or you pasted a Business Account ID instead of a Phone Number ID.')
    }
    throw new Error(metaMessage)
  }

  // Additional validation that the message was accepted
  if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
    console.error('Unexpected WhatsApp API response:', data);
    throw new Error('WhatsApp API returned unexpected response format')
  }

  return data
}

// Function to save incoming WhatsApp messages to database
async function saveIncomingMessage(messageData, userId = 'default') {
  console.log('saveIncomingMessage called with:', JSON.stringify(messageData, null, 2));

  // Extract data based on message type
  const { from, text, timestamp, type, image, document, audio, video, location, contacts } = messageData;

  // Create message object
  const message = {
    id: uuidv4(),
    userId,
    recipient: from, // This is the customer's phone number
    phone: from, // Also store phone number directly for easier querying
    message: '', // Will be populated based on message type
    isCustomer: true,
    timestamp: new Date(timestamp ? timestamp * 1000 : Date.now()), // Convert WhatsApp timestamp to JS Date
    whatsappMessageId: messageData.id,
    status: 'received',
    messageType: type || 'unknown'
  };

  // Handle different message types
  if (type === 'text' && text?.body) {
    message.message = text.body;
  } else if (type === 'interactive') {
    // Button reply or list reply from interactive menu
    const btnReply = messageData?.interactive?.button_reply
    const listReply = messageData?.interactive?.list_reply
    const title = btnReply?.title || listReply?.title || ''
    message.message = title ? `✅ ${title}` : '[Option selected]'
  } else if (type === 'image') {
    message.message = '[Image message received]';
  } else if (type === 'document') {
    message.message = '[Document message received]';
  } else if (type === 'audio') {
    message.message = '[Audio message received]';
  } else if (type === 'video') {
    message.message = '[Video message received]';
  } else if (type === 'location' && location) {
    message.message = `[Location: ${location.latitude}, ${location.longitude}]`;
  } else if (type === 'contacts' && contacts) {
    message.message = '[Contact information received]';
  } else {
    // Fallback for unknown message types
    message.message = '[Message received]';
    console.log('Unknown message type:', JSON.stringify(messageData, null, 2));
  }

  console.log('Saving message to database:', JSON.stringify(message, null, 2));

  await insertStoredMessage(message);

  // Update or create chat in the chats collection
  const chat = await getStoredChatByPhone(from, userId);
  await upsertStoredChat({
    phone: from,
    name: chat?.name || `Customer ${from}`,
    lastMessage: message.message,
    timestamp: message.timestamp,
    unread: (chat?.unread || 0) + 1
  }, userId);

  return message;
}

// Function to save outgoing WhatsApp messages to database
async function saveOutgoingMessage(to, messageText, whatsappResponse, userId = 'default') {
  const message = {
    id: uuidv4(),
    userId,
    recipient: to,
    phone: to, // Also store phone number directly for easier querying
    message: messageText,
    isCustomer: false,
    timestamp: new Date(),
    whatsappMessageId: whatsappResponse.messages?.[0]?.id,
    status: 'sent'
  };

  await insertStoredMessage(message);

  // Update or create chat in the chats collection
  const chat = await getStoredChatByPhone(to, userId);
  await upsertStoredChat({
    phone: to,
    name: chat?.name || `Customer ${to}`,
    lastMessage: messageText,
    timestamp: new Date(),
    unread: chat?.unread || 0
  }, userId);

  return message;
}

async function sendOrderStatusUpdate(phoneNumberId, accessToken, to, order, newStatus) {
  // Format the status message
  let statusMessage = '';
  let statusEmoji = '';

  switch (newStatus) {
    case 'fulfilled':
      statusEmoji = '✅';
      statusMessage = `Your order #${order.orderNumber} has been fulfilled and is on its way!`;
      break;
    case 'shipped':
      statusEmoji = '🚚';
      statusMessage = `Your order #${order.orderNumber} has been shipped!`;
      break;
    case 'cancelled':
      statusEmoji = '❌';
      statusMessage = `Your order #${order.orderNumber} has been cancelled.`;
      break;
    case 'refunded':
      statusEmoji = '💰';
      statusMessage = `Your order #${order.orderNumber} has been refunded.`;
      break;
    default:
      statusEmoji = '🔄';
      statusMessage = `Your order #${order.orderNumber} status has been updated to: ${newStatus}`;
  }

  const messageData = {
    messaging_product: "whatsapp",
    to: to.replace(/\D/g, ''),
    type: "text",
    text: {
      body: `${statusEmoji} *Order Status Update*

${statusMessage}

Thank you for your purchase!`
    }
  };

  return await sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData);
}

// Shopify API functions
async function fetchShopifyProducts(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/products.json`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify API error')
  }

  return data.products.map(product => ({
    id: product.id.toString(),
    title: product.title,
    description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 200),
    price: product.variants[0]?.price || '0.00',
    image: product.images[0]?.src,
    handle: product.handle
  }))
}

async function fetchShopifyOrders(shopify) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/orders.json?status=any`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify API error')
  }

  // Transform Shopify orders to match our internal format
  return data.orders.map(order => ({
    id: `shopify-${order.id}`,
    userId: 'default',
    shopifyOrderId: order.id.toString(),
    orderNumber: order.order_number,
    customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
    customerEmail: order.customer?.email,
    customerPhone: order.customer?.phone,
    total: order.total_price,
    currency: order.currency,
    status: order.financial_status,
    lineItems: order.line_items || [],
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at || order.created_at)
  }))
}

async function fetchCompleteShopifyOrder(shopify, orderId) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/orders/${orderId}.json`;

  console.log(`Fetching complete order ${orderId} from Shopify API: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`Shopify API error fetching complete order ${orderId}:`, data.errors || response.status);
    throw new Error(data.errors || 'Shopify API error fetching complete order');
  }

  console.log(`Successfully fetched complete order ${orderId}`);
  return data.order;
}

async function createShopifyWebhook(shopify, topic, webhookUrl) {
  const accessToken = await getShopifyAccessToken(shopify)
  const { shopDomain } = shopify
  const url = `https://${shopDomain}/admin/api/2023-10/webhooks.json`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook: {
        topic: topic,
        address: webhookUrl,
        format: 'json'
      }
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify webhook creation error')
  }

  return data.webhook
}

// Stripe functions
async function createStripeCheckoutSession(lineItems, metadata) {
  // This would integrate with Stripe API
  // Placeholder for now
  const sessionId = uuidv4()
  const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`

  return {
    id: sessionId,
    url: checkoutUrl
  }
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  // Fix the route construction to properly handle webhook paths
  const route = path.length > 0 ? `/${path.join('/')}` : '/'
  const method = request.method
  const currentUserId = resolveRequestUserId(request)

  // Add debugging for route matching
  console.log(`Processing route: ${route}, method: ${method}, path array:`, path)
  console.log(`Full params:`, params)

  try {
    // WhatsApp webhook verification - MUST BE FAST to avoid Meta timeout
    if (route === '/webhook/whatsapp' && method === 'GET') {
      const verifyToken = request.nextUrl.searchParams.get('hub.verify_token')
      const challenge = request.nextUrl.searchParams.get('hub.challenge')

      if (verifyToken) {
        const envToken = process.env.WHATSAPP_VERIFY_TOKEN
        const fallbackToken = '41ddad7ee4b44d0418876d444b36f4ac817c042c36265b5d'
        
        let isVerified = (verifyToken === envToken) || (verifyToken === fallbackToken)
        
        if (!isVerified) {
          try {
            const defaultIntegrations = await getStoredIntegrations()
            const storedToken = defaultIntegrations?.whatsapp?.webhookVerifyToken
            if (storedToken && verifyToken === storedToken) {
              isVerified = true
            }
          } catch (e) {
            // Ignore DB errors for speed, if tokens match fallback it's fine
          }
        }

        if (isVerified) {
          console.log('WhatsApp webhook verification successful')
          return new NextResponse(challenge, {
            headers: { 'Content-Type': 'text/plain' }
          })
        } else {
          console.warn('WhatsApp webhook verification failed: Token mismatch')
          return new NextResponse('Forbidden', { status: 403 })
        }
      }

      // If no verify token provided, return a message indicating endpoint is configured
      return handleCORS(NextResponse.json({
        message: "WhatsApp webhook endpoint is configured. Provide hub.verify_token for verification.",
        status: "ready"
      }))
    }
    // Run background jobs without blocking the main request
    // This prevents 502/timeouts on slow DB operations
    if (method === 'GET' || route.includes('webhook')) {
      processDueAutomationJobs().catch(err => console.error('Background job error:', err))
    }

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "WhatsApp Commerce Hub API" }))
    }

    // Integrations endpoints
    if (route === '/integrations' && method === 'GET') {
      let integrations = null

      try {
        integrations = await getStoredIntegrations(currentUserId)
      } catch (error) {
        console.error('Failed to load stored integrations:', error)
      }

      const defaultIntegrations = {
        whatsapp: {
          connected: false,
          data: {
            phoneNumberId: '',
            businessAccountId: '',
            catalogId: '',
            webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || ''
          }
        },
        shopify: { connected: false, data: {} },
        stripe: { connected: false, data: {} }
      }

      if (integrations) {
        // getStoredIntegrations now returns parsed objects
        console.log('[GET /integrations] Integrations:', JSON.stringify(integrations))

        // Check if integrations are properly configured
        defaultIntegrations.whatsapp.connected = !!(integrations.whatsapp?.phoneNumberId && integrations.whatsapp?.accessToken)
        defaultIntegrations.shopify.connected = !!(
          integrations.shopify?.shopDomain &&
          integrations.shopify?.clientId &&
          integrations.shopify?.clientSecret
        )
        defaultIntegrations.stripe.connected = !!(integrations.stripe?.secretKey)

        // Return data without sensitive fields
        const normalizedWhatsApp = normalizeWhatsAppIntegrationData(integrations.whatsapp || {})
        defaultIntegrations.whatsapp.data = {
          phoneNumberId: normalizedWhatsApp.phoneNumberId,
          businessAccountId: normalizedWhatsApp.businessAccountId,
          catalogId: normalizedWhatsApp.catalogId,
          webhookVerifyToken: normalizedWhatsApp.webhookVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || ''
        }
        defaultIntegrations.shopify.data = {
          shopDomain: integrations.shopify?.shopDomain || '',
          clientId: integrations.shopify?.clientId || ''
        }
        defaultIntegrations.stripe.data = {
          publishableKey: integrations.stripe?.publishableKey || ''
        }
      }

      return handleCORS(NextResponse.json(defaultIntegrations))
    }

    if (route === '/integrations' && method === 'POST') {
      const body = await request.json()
      const { type } = body
      let { data } = body
      let warning = ''

      if (!type || !data) {
        return handleCORS(NextResponse.json(
          { error: "Type and data are required" },
          { status: 400 }
        ))
      }

      if (type === 'whatsapp') {
        data = normalizeWhatsAppIntegrationData(data)
      }

      // Test the integration before saving
      try {
        if (type === 'whatsapp' && data.phoneNumberId && data.accessToken) {
          await validateWhatsAppPhoneNumberAccess(
            data.phoneNumberId,
            data.accessToken,
            data.businessAccountId
          )
        }

        if (type === 'whatsapp' && data.catalogId) {
          try {
            await validateMetaCatalogAccess({
              catalogId: data.catalogId,
              accessToken: data.accessToken,
              businessAccountId: data.businessAccountId,
              phoneNumberId: data.phoneNumberId
            })
          } catch (error) {
            warning = `Catalog validation failed: ${error.message}. Catalog ID has been saved but may not work until the access token is refreshed.`
          }
        }

        if (type === 'shopify' && data.shopDomain && data.clientId && data.clientSecret) {
          // Test Shopify connection
          await fetchShopifyProducts(data)
        }

        if (type === 'stripe' && data.secretKey) {
          // Test Stripe connection (placeholder)
          if (!data.secretKey.startsWith('sk_')) {
            throw new Error('Invalid Stripe secret key format')
          }
        }
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Integration test failed: ${error.message}` },
          { status: 400 }
        ))
      }

      // Ensure WhatsApp configuration has the right structure
      if (type === 'whatsapp') {
        // Force use of environment token to prevent mismatch with Meta configuration
        data.webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || ''

        data.connected = !!(data.phoneNumberId && data.accessToken);
        // Ensure catalogId is properly handled
        if (data.catalogId === '') {
          delete data.catalogId;
        }
      }

      if (type === 'shopify') {
        data = {
          shopDomain: normalizeShopifyDomain(data.shopDomain || ''),
          clientId: data.clientId || '',
          clientSecret: data.clientSecret || ''
        }
      }

      // Save integration
      try {
        await saveStoredIntegration(type, data, currentUserId)
      } catch (saveError) {
        console.error('Failed to save integration:', saveError)
        return handleCORS(NextResponse.json(
          { error: `Failed to save integration: ${saveError.message}` },
          { status: 500 }
        ))
      }

      return handleCORS(NextResponse.json({ success: true, ...(warning ? { warning } : {}) }))
    }

    // Setup webhooks endpoint
    if (route === '/setup-webhooks' && method === 'POST') {
      const integrations = await getStoredIntegrations();

      if (!integrations?.shopify?.shopDomain || !integrations?.shopify?.clientId || !integrations?.shopify?.clientSecret) {
        return handleCORS(NextResponse.json(
          { error: "Shopify not configured" },
          { status: 400 }
        ))
      }

      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/shopify`

        // Create webhooks for order creation and status updates
        const webhooks = [
          { topic: 'orders/create', address: webhookUrl },
          { topic: 'orders/updated', address: webhookUrl },
          { topic: 'orders/paid', address: webhookUrl },
          { topic: 'orders/fulfilled', address: webhookUrl },
          { topic: 'orders/cancelled', address: webhookUrl },
          { topic: 'checkouts/create', address: webhookUrl },
          { topic: 'checkouts/update', address: webhookUrl },
          // NEW: Add customer webhooks to capture phone numbers
          { topic: 'customers/create', address: webhookUrl },
          { topic: 'customers/update', address: webhookUrl }
        ];

        const createdWebhooks = [];

        for (const webhook of webhooks) {
          try {
            const createdWebhook = await createShopifyWebhook(
              integrations.shopify,
              webhook.topic,
              webhook.address
            );

            createdWebhooks.push({
              webhookId: createdWebhook.id,
              topic: webhook.topic,
              address: webhook.address
            });
          } catch (error) {
            console.error(`Failed to create webhook for ${webhook.topic}:`, error.message);
            // Continue with other webhooks even if one fails
          }
        }

        // Save webhook info
        await saveStoredWebhooks(createdWebhooks)

        return handleCORS(NextResponse.json({
          success: true,
          webhooks: createdWebhooks
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to setup webhooks: ${error.message}` },
          { status: 400 }
        ))
      }
    }

    // Webhook logs endpoint
    if (route === '/webhook-logs' && method === 'GET') {
      try {
        const webhookUrl = new URL(request.url)
        const limit = parseInt(webhookUrl.searchParams.get('limit')) || 10
        const logs = await getWebhookLogs(limit)
        return handleCORS(NextResponse.json({ logs }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to get webhook logs: ${error.message}` },
          { status: 500 }
        ))
      }
    }

    // Webhooks endpoint - get registered webhooks
    if (route === '/webhooks' && method === 'GET') {
      const webhookUrl = new URL(request.url)
      const type = webhookUrl.searchParams.get('type') || 'shopify'
      let webhooks = null

      try {
        webhooks = await getStoredWebhooks(type)
      } catch (error) {
        console.error(`Failed to load stored ${type} webhooks:`, error)
      }

      return handleCORS(NextResponse.json({
        type,
        webhooks: webhooks?.webhooks || [],
        createdAt: webhooks?.createdAt || null
      }))
    }

    // Products endpoint
    if (route === '/products' && method === 'GET') {
      const integrations = await getStoredIntegrations()

      try {
        const hasMetaCatalog = !!(integrations?.whatsapp?.catalogId && integrations?.whatsapp?.accessToken)

        if (!hasMetaCatalog) {
          return handleCORS(NextResponse.json(
            { error: "Meta catalog not configured. Connect WhatsApp catalog access to load products." },
            { status: 400 }
          ))
        }

        const metaCatalogProducts = await fetchMetaCatalogProducts(integrations.whatsapp)
        const metaProducts = mapMetaCatalogProductsToAppProducts(metaCatalogProducts)
        await saveStoredProducts(metaProducts)
        return handleCORS(NextResponse.json(metaProducts))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to fetch products: ${error.message}` },
          { status: 400 }
        ))
      }
    }

    // Orders endpoint
    if (route === '/orders' && method === 'GET') {
      try {
        // Try to fetch orders from Shopify if integration is configured
        const integrations = await getStoredIntegrations()

        if (integrations?.shopify?.shopDomain && integrations?.shopify?.clientId && integrations?.shopify?.clientSecret) {
          try {
            // Fetch orders directly from Shopify
            const shopifyOrders = await fetchShopifyOrders(integrations.shopify)

            // Return Shopify orders
            return handleCORS(NextResponse.json(shopifyOrders))
          } catch (error) {
            console.error('Failed to fetch Shopify orders:', error)
            // Fall back to database orders if Shopify fetch fails
          }
        }

        // Fall back to database orders
        const orders = await getStoredOrders(100)
        const cleanedOrders = orders.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedOrders))
      } catch (error) {
        console.error('Failed to fetch orders:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch orders' },
          { status: 500 }
        ))
      }
    }

    if (route === '/cart-recovery/capture' && method === 'POST') {
      try {
        const body = await request.json()
        const eventType = typeof body.event === 'string'
          ? body.event
          : (typeof body.event_type === 'string' ? body.event_type : '')

        if (!eventType || !eventType.includes('.cart_')) {
          return handleCORS(NextResponse.json(
            { error: 'event or event_type is required and must look like shopify.cart_updated' },
            { status: 400 }
          ))
        }

        const persistedCart = await persistCartRecoveryEvent({
          userId: 'default',
          eventType,
          payload: body,
          platformHint: body.platform || eventType,
          metadata: {
            source: 'cart-recovery-capture-api'
          }
        })

        const context = {
          ...buildCartRecoveryContext(body, body.platform || eventType),
          ...(persistedCart?.context || {})
        }

        if (persistedCart?.session?.id) {
          context.cart_session_id = persistedCart.session.id
        }

        const shouldTriggerAutomation = (
          body.triggerAutomation !== false &&
          (eventType !== 'shopify.cart_recovered' && eventType !== 'woocommerce.cart_recovered'
            ? true
            : Boolean(persistedCart?.transitionedToRecovered))
        )

        if (shouldTriggerAutomation) {
          const integrations = await getStoredIntegrations()
          await executeAutomationsForEvent(eventType, context, integrations)
        }

        return handleCORS(NextResponse.json({
          success: true,
          event: eventType,
          session: persistedCart?.session || null,
          cancelledJobs: persistedCart?.cancelledJobs || 0,
          context
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to capture cart recovery event: ${error.message}` },
          { status: 500 }
        ))
      }
    }

    if (route === '/cart-recovery/process' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}))
        const thresholdMinutes = parseInt(String(body.thresholdMinutes || 60), 10) || 60
        const limit = parseInt(String(body.limit || 25), 10) || 25
        const dryRun = Boolean(body.dryRun)
        const platform = typeof body.platform === 'string' ? body.platform : ''

        const sessions = await findCartSessionsReadyForAbandonment({
          userId: 'default',
          thresholdMinutes,
          limit,
          platform
        })

        if (dryRun) {
          return handleCORS(NextResponse.json({
            success: true,
            dryRun: true,
            thresholdMinutes,
            limit,
            ready: sessions.length,
            sessions: sessions.map((session) => ({
              id: session.id,
              platform: session.platform,
              external_cart_id: session.external_cart_id,
              customer_phone: session.customer_phone,
              last_activity_at: session.last_activity_at
            }))
          }))
        }

        if (sessions.length === 0) {
          return handleCORS(NextResponse.json({
            success: true,
            processed: 0,
            failed: 0,
            message: 'No cart sessions are ready for abandonment processing.'
          }))
        }

        const integrations = await getStoredIntegrations()
        let processed = 0
        let failed = 0
        const errors = []

        for (const session of sessions) {
          try {
            const abandonedSession = await markCartSessionAbandoned(session.id)
            const activeSession = abandonedSession || session
            const eventPlatform = String(activeSession.platform || '').toLowerCase()

            if (eventPlatform !== 'shopify' && eventPlatform !== 'woocommerce') {
              continue
            }

            const context = {
              ...mapCartSessionToContext(activeSession),
              cart_session_id: activeSession.id,
              status: 'abandoned'
            }

            await executeAutomationsForEvent(
              `${eventPlatform}.cart_abandoned`,
              context,
              integrations
            )

            processed += 1
          } catch (error) {
            failed += 1
            errors.push({
              sessionId: session.id,
              error: error.message
            })
          }
        }

        return handleCORS(NextResponse.json({
          success: true,
          processed,
          failed,
          errors
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to process cart recovery sessions: ${error.message}` },
          { status: 500 }
        ))
      }
    }

    // Update the send catalog endpoint to support template selection and multiple recipients
    if (route === '/send-catalog' && method === 'POST') {
      try {
        const body = await request.json();
        const { products: productIds, recipient, recipients, templateName, templateLanguage, templateComponents, templateVariables, templateHeaderImageUrl } = body;
        const normalizedProductIds = Array.isArray(productIds) ? productIds : []

        // Handle both single recipient and multiple recipients
        let recipientList = [];
        if (recipients && Array.isArray(recipients) && recipients.length > 0) {
          recipientList = recipients;
        } else if (recipient) {
          // Support both single recipient and comma-separated recipients
          recipientList = recipient.split(',').map(r => r.trim()).filter(r => r);
        } else {
          return handleCORS(NextResponse.json(
            { error: "Recipient phone number(s) required" },
            { status: 400 }
          ));
        }

        // Get integrations
        const integrations = await getStoredIntegrations();

        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { error: "WhatsApp not configured" },
            { status: 400 }
          ));
        }

        // Get products
        const storedProducts = await getStoredProducts();
        if (normalizedProductIds.length > 0 && (!storedProducts || storedProducts.length === 0)) {
          return handleCORS(NextResponse.json(
            { error: "No products found. Please sync products first." },
            { status: 400 }
          ));
        }

        const selectedProducts = Array.isArray(storedProducts)
          ? storedProducts.filter(p => normalizedProductIds.includes(p.id))
          : [];
        const productContext = buildCatalogProductContext(selectedProducts, integrations.shopify, integrations.whatsapp);
        const selectedTemplateComponents = Array.isArray(templateComponents) ? templateComponents : []
        const selectedTemplateVariables = Array.isArray(templateVariables) ? templateVariables : []
        const requiresProducts = templateName
          ? templateRequiresProductContext(selectedTemplateComponents, selectedTemplateVariables, templateName)
          : false
        const requiresOrderContext = templateName
          ? templateRequiresOrderContext(selectedTemplateComponents, selectedTemplateVariables, templateName)
          : false

        if (normalizedProductIds.length > 0 && selectedProducts.length === 0) {
          return handleCORS(NextResponse.json(
            { error: "Selected products not found" },
            { status: 400 }
          ));
        }

        if (requiresProducts && selectedProducts.length === 0) {
          return handleCORS(NextResponse.json(
            { error: "This template requires product selection. Choose at least one WhatsApp-ready product." },
            { status: 400 }
          ));
        }

        // Send to each recipient
        const results = [];
        for (const recipient of recipientList) {
          try {
            // Validate and format phone number
            const formattedRecipient = recipient.replace(/\D/g, '');

            // Log the recipient number for debugging
            console.log(`Sending catalog to: ${recipient}, formatted: ${formattedRecipient}`);

            // Check if the number seems valid
            if (formattedRecipient.length < 10) {
              results.push({
                recipient: recipient,
                success: false,
                error: "Invalid phone number format. Please include country code."
              });
              continue;
            }

            // Check if we're using a template
            if (templateName) {
              const [existingChat, latestOrder] = await Promise.all([
                getStoredChatByPhone(formattedRecipient),
                getLatestStoredOrderByPhone(formattedRecipient)
              ])

              if (requiresOrderContext && !latestOrder) {
                results.push({
                  recipient,
                  success: false,
                  error: 'This template is mapped to order or purchased-product fields, but no recent order was found for this recipient.'
                })
                continue
              }

              const orderProductContext = buildOrderProductContext(latestOrder)
              const templatePayload = buildCatalogTemplatePayload({
                templateName,
                templateLanguage,
                templateComponents: selectedTemplateComponents,
                templateVariables: selectedTemplateVariables,
                templateHeaderImageUrl,
                productContext: { ...productContext, ...orderProductContext },
                recipientContext: {
                  customer_name: existingChat?.name || latestOrder?.customerName || 'Customer',
                  customer_phone: formattedRecipient,
                  order_number: latestOrder?.orderNumber || '',
                  tracking_number: '',
                  tracking_url: '',
                  order_total: latestOrder?.total ? String(latestOrder.total) : '',
                  currency: latestOrder?.currency || ''
                }
              })

              // Debug log the template payload
              console.log('Template payload:', JSON.stringify(templatePayload, null, 2))

              // Send using the selected template
              const messageData = {
                messaging_product: "whatsapp",
                to: formattedRecipient,
                type: "template",
                template: templatePayload
              };

              const result = await sendWhatsAppMessage(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                formattedRecipient,
                messageData
              );

              // Log the message
              await insertStoredMessage({
                id: uuidv4(),
                userId: 'default',
                recipient: formattedRecipient,
                phone: formattedRecipient,
                message: `Catalog template sent: ${templateName}`,
                isCustomer: false,
                timestamp: new Date(),
                products: selectedProducts,
                template: templateName,
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              });

              results.push({
                recipient: recipient,
                success: true,
                messageId: result.messages?.[0]?.id
              });
            } else {
              // Use the existing text-based approach
              const hasCatalogId = integrations.whatsapp.catalogId;

              // Always use text-based messages to avoid template approval requirements
              // Create a catalog link
              const businessAccountId = integrations.whatsapp.businessAccountId || integrations.whatsapp.phoneNumberId;
              const catalogLink = `https://wa.me/c/${businessAccountId}`;

              // Create a message that includes information about selected products with images
              let productInfo = ''
              if (selectedProducts.length > 0) {
                productInfo = "Selected products:\n"
                selectedProducts.slice(0, 3).forEach((product, index) => {
                  let productEntry = `${index + 1}. *${product.title}* - $${product.price}\n`;
                  if (product.image) {
                    productEntry += `   📷 Image: ${product.image}\n`;
                  }
                  if (product.description) {
                    productEntry += `   📝 ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}\n`;
                  }
                  productInfo += productEntry + "\n";
                });
                if (selectedProducts.length > 3) {
                  productInfo += `...and ${selectedProducts.length - 3} more items\n`;
                }
              }

              const catalogMessage = `🛍️ *Our Product Catalog*

Check out our latest products:
${catalogLink}

${productInfo ? `${productInfo}` : ''}Browse our full collection and find something special just for you!

🛍️ *Shop Now* - Click the link above to browse our catalog with images`;

              const messageData = {
                messaging_product: "whatsapp",
                to: formattedRecipient,
                type: "text",
                text: {
                  body: catalogMessage,
                  preview_url: true
                }
              };

              console.log('Sending message with data:', JSON.stringify(messageData, null, 2));

              const result = await sendWhatsAppMessage(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                formattedRecipient,
                messageData
              );

              console.log('WhatsApp API response:', JSON.stringify(result, null, 2));

              // Log the message
              await insertStoredMessage({
                id: uuidv4(),
                userId: 'default',
                recipient: formattedRecipient,
                phone: formattedRecipient,
                message: catalogMessage,
                isCustomer: false,
                timestamp: new Date(),
                products: selectedProducts,
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              });

              const existingChat = await getStoredChatByPhone(formattedRecipient);
              await upsertStoredChat({
                phone: formattedRecipient,
                name: existingChat?.name || `Customer ${formattedRecipient}`,
                lastMessage: 'Catalog sent',
                timestamp: new Date(),
                unread: existingChat?.unread || 0
              });

              results.push({
                recipient: recipient,
                success: true,
                messageId: result.messages?.[0]?.id
              });
            }
          } catch (error) {
            console.error(`Failed to send catalog message to ${recipient}:`, error);
            results.push({
              recipient: recipient,
              success: false,
              error: error.message || 'Failed to send message'
            });
          }
        }

        // Return results
        const successfulSends = results.filter(r => r.success).length;
        const failedSends = results.filter(r => !r.success).length;

        return handleCORS(NextResponse.json({
          success: successfulSends > 0,
          sentCount: successfulSends,
          failedCount: failedSends,
          results: results
        }));
      } catch (error) {
        console.error('Failed to send catalog:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to send catalog' },
          { status: 500 }
        ));
      }
    }

    // Get automation logs/state
    if (route === '/automations/logs' && method === 'GET') {
      try {
        const automationId = request.nextUrl.searchParams.get('automationId')
        if (!automationId) {
          return handleCORS(NextResponse.json({ error: 'automationId is required' }, { status: 400 }))
        }

        const states = await queryMany(
          `SELECT id, recipient, state, payload, updatedAt
           FROM automation_conversation_state
           WHERE userId = ? AND automationId = ?
           ORDER BY updatedAt DESC
           LIMIT 10`,
          [currentUserId, automationId]
        )

        return handleCORS(NextResponse.json(states || []))
      } catch (error) {
        console.error('Failed to fetch automation logs:', error)
        return handleCORS(NextResponse.json({ error: 'Failed to fetch automation logs' }, { status: 500 }))
      }
    }

    // Automations PUT handler - delegate to separate route file or handle here
    if (route === '/automations' && method === 'PUT') {
      try {
        await ensureAutomationJobsTable()
        await ensureKnowledgeBaseTable()
        console.log('All settings tables ensured')
        const body = await request.json()
        const automations = Array.isArray(body) ? body : body.automations

        if (!Array.isArray(automations)) {
          return handleCORS(NextResponse.json({ error: 'Automations array is required' }, { status: 400 }))
        }

        const connection = await getMysqlPool().getConnection()

        try {
          await connection.beginTransaction()

          const automationIds = []

          for (const automation of automations) {
            const automationId = automation.id || `auto-${Date.now()}`
            const steps = typeof automation.steps === 'string' ? JSON.parse(automation.steps) : automation.steps
            const metrics = typeof automation.metrics === 'string' ? JSON.parse(automation.metrics) : (automation.metrics || { sent: 0, openRate: 0, conversions: 0 })

            automationIds.push(automationId)

            await connection.execute(
              `INSERT INTO automations (id, userId, name, status, source, summary, steps, metrics, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
               ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), source = VALUES(source),
               summary = VALUES(summary), steps = VALUES(steps), metrics = VALUES(metrics), updatedAt = NOW()`,
              [
                automationId,
                currentUserId,
                automation.name || 'Unnamed',
                automation.status !== undefined ? (automation.status ? 1 : 0) : 0,
                automation.source || 'Custom',
                automation.summary || '',
                JSON.stringify(steps || []),
                JSON.stringify(metrics)
              ]
            )
          }

          if (automationIds.length > 0) {
            const placeholders = automationIds.map(() => '?').join(', ')
            await connection.execute(
              `DELETE FROM automations
               WHERE userId = ?
               AND id NOT IN (${placeholders})`,
              [currentUserId, ...automationIds]
            )
          } else {
            await connection.execute('DELETE FROM automations WHERE userId = ?', [currentUserId])
          }

          await connection.commit()
        } catch (error) {
          await connection.rollback()
          throw error
        } finally {
          connection.release()
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('Error saving automations:', error)
        return handleCORS(NextResponse.json({ error: 'Failed to save automations', details: error.message }, { status: 500 }))
      }
    }

    // Automations GET handler
    if (route === '/automations' && method === 'GET') {
      try {
        await ensureAutomationsTable()
        await seedDefaultAutomationsForUser(currentUserId)

        let [rows] = await query(
          `SELECT id, name, status, source, summary, steps, metrics, createdAt, updatedAt
           FROM automations
           WHERE userId = ?
           ORDER BY updatedAt DESC, createdAt DESC`,
          [currentUserId]
        )

        // Parse JSON columns
        const parsedRows = (rows || []).map(row => ({
          ...row,
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
          metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics
        }))
        console.log('Returning automations:', parsedRows.map(a => ({ id: a.id, stepsCount: a.steps?.length })))

        return handleCORS(NextResponse.json(parsedRows || []))
      } catch (error) {
        console.error('Error fetching automations:', error)
        return handleCORS(NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 }))
      }
    }

    // New endpoint to fetch WhatsApp templates
    if (route === '/whatsapp-templates' && method === 'GET') {
      try {
        // Get WhatsApp integration details
        const integrations = await getStoredIntegrations();

        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            {
              error: "WhatsApp not configured properly. Missing phone number ID or access token.",
              guidance: "Please check your WhatsApp integration settings in the dashboard."
            },
            { status: 400 }
          ));
        }

        // Use the business account ID from integration settings
        const businessAccountId = integrations.whatsapp.businessAccountId;

        if (!businessAccountId) {
          return handleCORS(NextResponse.json(
            {
              error: "Business account ID not found in integration settings",
              guidance: "Please ensure your WhatsApp Business Account is properly configured."
            },
            { status: 400 }
          ));
        }

        // Fetch templates from WhatsApp API using the business account ID
        const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;

        const templateResponse = await fetch(url, {
          headers: {
            ...buildMetaAuthHeaders(integrations.whatsapp.accessToken),
            'Content-Type': 'application/json'
          }
        });

        const data = await templateResponse.json();

        if (!templateResponse.ok) {
          console.error('WhatsApp Templates API Error:', data);

          // Provide more detailed error information
          let errorMessage = "Failed to fetch templates from WhatsApp API";
          let guidance = "";

          if (data.error?.code === 100) {
            if (data.error?.message?.includes('message_templates')) {
              errorMessage = "Unable to access message templates";
              guidance = "Your business account may not have the required permissions or the account ID may be incorrect.";
            } else {
              errorMessage = "Invalid request to WhatsApp API";
              guidance = "There may be an issue with your business account configuration.";
            }
          } else if (data.error?.code === 200) {
            errorMessage = "Insufficient permissions";
            guidance = "Your access token may not have the required business_management permissions.";
          }

          // Return an empty array with error details instead of an error to allow the UI to still function
          return handleCORS(NextResponse.json({
            data: [],
            error: errorMessage,
            guidance: guidance,
            apiError: data.error
          }));
        }

        // Filter for approved templates only
        const approvedTemplates = data.data?.filter(template =>
          template.status === 'APPROVED'
        ) || [];

        return handleCORS(NextResponse.json(approvedTemplates));
      } catch (error) {
        console.error('Failed to fetch WhatsApp templates:', error);
        return handleCORS(NextResponse.json(
          {
            error: 'Failed to fetch WhatsApp templates',
            guidance: "Please check your internet connection and WhatsApp integration settings.",
            technicalError: error.message
          },
          { status: 500 }
        ));
      }
    }


    if (route === '/webhook/whatsapp' && method === 'POST') {
      try {
        const body = await request.json()

        // Log webhook for debugging
        await insertWebhookLog('whatsapp', null, body)

        console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

        // Process incoming WhatsApp messages
        if (body.entry && Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            if (entry.changes && Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                console.log('Processing change field:', change.field);

                // Handle incoming messages
                if (change.field === 'messages') {
                  console.log('Found messages field in change value');
                  const incomingPhoneNumberId = change.value?.metadata?.phone_number_id || ''
                  const incomingUserId = await getUserIdByWhatsAppPhoneNumberId(incomingPhoneNumberId)
                  const contactsByWaId = new Map(
                    (change.value?.contacts || [])
                      .filter((contact) => contact?.wa_id)
                      .map((contact) => [contact.wa_id, contact])
                  )

                    // Check for actual messages
                    if (change.value?.messages && Array.isArray(change.value.messages)) {
                      console.log('Processing incoming messages, count:', change.value.messages.length);
                      
                      console.log('[Webhook] Getting integrations...');
                      const automationIntegrations = await getStoredIntegrations(incomingUserId)
                      console.log('[Webhook] Got integrations:', JSON.stringify(automationIntegrations));
                      
                      for (const message of change.value.messages) {
                        console.log('[Webhook] Saving incoming message:', JSON.stringify(message, null, 2));
                        // Save incoming message to database
                        const contact = contactsByWaId.get(message.from)
                        const savedMessage = await saveIncomingMessage(message, incomingUserId)
                        console.log('[Webhook] Saved message, id:', savedMessage?.id);
                        
                        const context = buildIncomingWhatsAppAutomationContext(message, savedMessage, contact)
                        console.log('[Webhook] Automation context:', JSON.stringify(context));
                        
                        await executeAutomationsForEvent(
                          'whatsapp.message_received',
                          context,
                          automationIntegrations,
                          incomingUserId
                        )
                      }
                  } else {
                    console.log('No messages in change.value');
                  }

                  // Handle message statuses (delivery/read receipts)
                  if (change.value?.statuses && Array.isArray(change.value.statuses)) {
                    console.log('Processing message statuses');
                    for (const status of change.value.statuses) {
                      console.log('Message status update:', JSON.stringify(status, null, 2));
                      // We could save status updates to a separate collection if needed
                      // For now, we'll just log them
                    }
                  }

                  // Handle contacts (new conversations)
                  if (change.value?.contacts && Array.isArray(change.value.contacts)) {
                    console.log('Processing contacts');
                    for (const contact of change.value.contacts) {
                      console.log('New contact:', JSON.stringify(contact, null, 2));
                      // We could save contact information if needed
                    }
                  }
                }
              }
            }
          }
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('WhatsApp webhook processing error:', error)
        // Always return success to WhatsApp even if we have errors
        // This prevents WhatsApp from retrying the webhook
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // Webhook endpoint for Shopify
    // Fixed the route matching to properly handle webhook paths
    if (route === '/webhook/shopify' && method === 'POST') {
      try {
        const body = await request.json()
        const topic = request.headers.get('x-shopify-topic')

        // Log webhook for debugging
        await insertWebhookLog('shopify', topic, body)

        if ((topic === 'customers/create' || topic === 'customers/update') && body?.id) {
          const discoveredPhone = body.phone || body.default_address?.phone || body.addresses?.find((address) => address.phone)?.phone || null
          if (discoveredPhone) {
            await upsertStoredShopifyCustomer(body.id.toString(), discoveredPhone)
            await upsertStoredShopifyCustomer(`guest-${body.id.toString()}`, discoveredPhone)
          }
        }

        if ((topic === 'checkouts/create' || topic === 'checkouts/update') && body?.id) {
          const checkoutRecovered = Boolean(
            body.completed_at ||
            body.completedAt ||
            body.order_id ||
            body.orderId ||
            body.closed_at ||
            body.closedAt
          )
          const checkoutEvent = topic === 'checkouts/create'
            ? 'shopify.cart_created'
            : (checkoutRecovered ? 'shopify.cart_recovered' : 'shopify.cart_updated')

          const persistedCart = await persistCartRecoveryEvent({
            userId: 'default',
            eventType: checkoutEvent,
            payload: body,
            platformHint: 'shopify',
            metadata: {
              webhook_topic: topic
            }
          })

          const cartContext = {
            ...buildCartRecoveryContext(body, 'shopify'),
            ...(persistedCart?.context || {})
          }

          if (persistedCart?.session?.id) {
            cartContext.cart_session_id = persistedCart.session.id
          }

          if (persistedCart?.cancelledJobs > 0) {
            console.log(`Cancelled ${persistedCart.cancelledJobs} pending cart reminder job(s) after checkout recovery`)
          }

          if (checkoutEvent !== 'shopify.cart_recovered' || persistedCart?.transitionedToRecovered) {
            const automationIntegrations = await getStoredIntegrations()
            await executeAutomationsForEvent(
              checkoutEvent,
              cartContext,
              automationIntegrations
            )
          }
        }

        // Process different Shopify webhook topics
        if (topic === 'orders/create' && body.id) {
          // Log detailed information about the incoming order
          console.log(`=== NEW ORDER RECEIVED ===`);
          console.log(`Order Number: ${body.order_number}`);
          console.log(`Order ID: ${body.id}`);
          console.log(`Customer ID: ${body.customer?.id}`);
          console.log(`Customer Email: ${body.customer?.email}`);

          // Enhanced order creation logic to handle missing customer data
          // Look for phone number in multiple places
          let customerPhone = null;

          // Log what data we received
          console.log(`Received customer data:`, JSON.stringify(body.customer, null, 2));
          console.log(`Received shipping address:`, JSON.stringify(body.shipping_address, null, 2));
          console.log(`Received billing address:`, JSON.stringify(body.billing_address, null, 2));

          // Check customer object
          if (body.customer && body.customer.phone) {
            customerPhone = body.customer.phone;
            console.log(`Found phone in customer.phone: ${customerPhone}`);
          }
          // Check shipping address
          else if (body.shipping_address && body.shipping_address.phone) {
            customerPhone = body.shipping_address.phone;
            console.log(`Found phone in shipping_address.phone: ${customerPhone}`);
          }
          // Check billing address
          else if (body.billing_address && body.billing_address.phone) {
            customerPhone = body.billing_address.phone;
            console.log(`Found phone in billing_address.phone: ${customerPhone}`);
          }

          // NEW: Additional check for phone numbers in address fields
          // Sometimes Shopify doesn't send phone in dedicated phone field but in address fields
          if (!customerPhone) {
            console.log('Checking for phone numbers in name/address fields...');

            // Check if phone is in shipping address fields
            if (body.shipping_address) {
              // Look for phone in first_name, last_name, or address fields as a fallback
              const shippingFields = [
                body.shipping_address.first_name,
                body.shipping_address.last_name,
                body.shipping_address.address1,
                body.shipping_address.address2
              ];

              console.log('Shipping address fields to check:', shippingFields);

              for (const field of shippingFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in shipping address field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }

            // Check if phone is in billing address fields
            if (!customerPhone && body.billing_address) {
              const billingFields = [
                body.billing_address.first_name,
                body.billing_address.last_name,
                body.billing_address.address1,
                body.billing_address.address2
              ];

              console.log('Billing address fields to check:', billingFields);

              for (const field of billingFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in billing address field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }

            // Check if phone is in customer name fields
            if (!customerPhone && body.customer) {
              const customerFields = [
                body.customer.first_name,
                body.customer.last_name
              ];

              console.log('Customer name fields to check:', customerFields);

              for (const field of customerFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in customer name field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }
          }

          // NEW: If still no phone found, check our customer database for regular customers
          if (!customerPhone && body.customer && body.customer.id) {
            try {
              console.log(`No phone found in webhook data for order ${body.order_number}, checking customer database for regular customer`);
              const customerRecord = await getStoredShopifyCustomer(body.customer.id.toString());

              if (customerRecord && customerRecord.phone) {
                customerPhone = customerRecord.phone;
                console.log(`Found phone in customer database for regular customer: ${customerPhone}`);
              } else {
                console.log('No customer record found in database or no phone in record for regular customer');
              }
            } catch (dbError) {
              console.error('Error checking customer database for regular customer:', dbError.message);
            }
          }

          // NEW: If still no phone found, check our customer database for guest customers
          if (!customerPhone && body.customer && body.customer.id) {
            try {
              console.log(`No phone found for regular customer, checking customer database for guest customer`);
              const guestCustomerRecord = await getStoredShopifyCustomer(`guest-${body.customer.id.toString()}`);

              if (guestCustomerRecord && guestCustomerRecord.phone) {
                customerPhone = guestCustomerRecord.phone;
                console.log(`Found phone in customer database for guest customer: ${customerPhone}`);
              } else {
                console.log('No customer record found in database or no phone in record for guest customer');
              }
            } catch (dbError) {
              console.error('Error checking customer database for guest customer:', dbError.message);
            }
          }

          // NEW: If still no phone found, fetch complete order from Shopify API
          if (!customerPhone) {
            try {
              console.log(`No phone found in webhook data for order ${body.order_number}, fetching complete order from Shopify API`);
              const integrations = await getStoredIntegrations();

              if (integrations?.shopify?.shopDomain && integrations?.shopify?.clientId && integrations?.shopify?.clientSecret) {
                const completeOrder = await fetchCompleteShopifyOrder(
                  integrations.shopify,
                  body.id
                );

                console.log(`Complete order fetched for order ${body.order_number}`);

                // Log what data we received from the complete order
                console.log(`Complete order customer data:`, JSON.stringify(completeOrder.customer, null, 2));
                console.log(`Complete order shipping address:`, JSON.stringify(completeOrder.shipping_address, null, 2));
                console.log(`Complete order billing address:`, JSON.stringify(completeOrder.billing_address, null, 2));

                // Try to find phone in the complete order data
                if (completeOrder.customer && completeOrder.customer.phone) {
                  customerPhone = completeOrder.customer.phone;
                  console.log(`Found phone in complete order customer data: ${customerPhone}`);
                } else if (completeOrder.shipping_address && completeOrder.shipping_address.phone) {
                  customerPhone = completeOrder.shipping_address.phone;
                  console.log(`Found phone in complete order shipping address: ${customerPhone}`);
                } else if (completeOrder.billing_address && completeOrder.billing_address.phone) {
                  customerPhone = completeOrder.billing_address.phone;
                  console.log(`Found phone in complete order billing address: ${customerPhone}`);
                }

                // If still not found, check for phone numbers in name/address fields of complete order
                if (!customerPhone) {
                  console.log('Checking complete order for phone numbers in name/address fields');

                  // Check shipping address fields
                  if (completeOrder.shipping_address) {
                    const shippingFields = [
                      completeOrder.shipping_address.first_name,
                      completeOrder.shipping_address.last_name,
                      completeOrder.shipping_address.address1,
                      completeOrder.shipping_address.address2
                    ];

                    console.log('Shipping address fields to check:', shippingFields);

                    for (const field of shippingFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order shipping address field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }

                  // Check billing address fields
                  if (!customerPhone && completeOrder.billing_address) {
                    const billingFields = [
                      completeOrder.billing_address.first_name,
                      completeOrder.billing_address.last_name,
                      completeOrder.billing_address.address1,
                      completeOrder.billing_address.address2
                    ];

                    console.log('Billing address fields to check:', billingFields);

                    for (const field of billingFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order billing address field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }

                  // Check customer name fields
                  if (!customerPhone && completeOrder.customer) {
                    const customerFields = [
                      completeOrder.customer.first_name,
                      completeOrder.customer.last_name
                    ];

                    console.log('Customer name fields to check:', customerFields);

                    for (const field of customerFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order customer name field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }
                }
              } else {
                console.log('Shopify integration not configured, cannot fetch complete order');
              }
            } catch (fetchError) {
              console.error('Error fetching complete order from Shopify API:', fetchError.message);
            }
          }

          const order = {
            id: uuidv4(),
            userId: 'default',
            shopifyOrderId: body.id.toString(),
            orderNumber: body.order_number || body.name,
            customerName: body.customer ?
              `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() :
              'Unknown Customer',
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

          // Save order to database
          await insertStoredOrder(order)

          const { checkoutToken, externalCartId } = extractShopifyOrderCartIdentifiers(body)
          if (checkoutToken || externalCartId) {
            const recoveredSessions = await markCartSessionsRecovered({
              userId: 'default',
              platform: 'shopify',
              checkoutToken,
              externalCartId,
              recoveredOrderId: order.shopifyOrderId
            })

            if (recoveredSessions.length > 0) {
              await cancelPendingCartRecoveryJobs({
                userId: 'default',
                sessionIds: recoveredSessions.map((session) => session.id),
                externalCartIds: recoveredSessions.map((session) => session.external_cart_id),
                checkoutTokens: recoveredSessions.map((session) => session.checkout_token),
                reason: 'cart_recovered_order_created'
              })

              const cartAutomationIntegrations = await getStoredIntegrations()
              for (const session of recoveredSessions) {
                await executeAutomationsForEvent(
                  'shopify.cart_recovered',
                  {
                    ...mapCartSessionToContext(session),
                    cart_session_id: session.id,
                    recovered_order_id: order.shopifyOrderId,
                    status: 'recovered'
                  },
                  cartAutomationIntegrations
                )
              }
            }
          }

          console.log(`=== ORDER PROCESSING COMPLETE ===`);
          console.log(`Order ${order.orderNumber} saved.`);
          console.log(`Customer phone: ${customerPhone ? customerPhone : 'NOT FOUND'}`);
          console.log(`WhatsApp notification: ${customerPhone ? 'WILL BE SENT' : 'SKIPPED (no phone)'}`);

          // Send WhatsApp confirmation to customer if phone number exists
          if (customerPhone) {
            const integrations = await getStoredIntegrations()

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
                  text: {
                    body: confirmationMessage
                  }
                }

                const result = await sendWhatsAppMessage(
                  integrations.whatsapp.phoneNumberId,
                  integrations.whatsapp.accessToken,
                  customerPhone,
                  messageData
                )

                // Update order to mark WhatsApp as sent
                await updateStoredOrderByShopifyOrderId(order.shopifyOrderId, {
                  whatsappSent: true,
                  whatsappMessageId: result.messages?.[0]?.id,
                  whatsappSentAt: new Date(),
                  updatedAt: new Date()
                })

                // Log the message
                await insertStoredMessage({
                  id: uuidv4(),
                  userId: 'default',
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

                console.log(`WhatsApp confirmation sent for order ${order.orderNumber}`);

              } catch (whatsappError) {
                console.error('Failed to send WhatsApp confirmation:', whatsappError)
                // Don't fail the webhook if WhatsApp fails
              }
            } else {
              console.log('WhatsApp not configured, skipping notification');
            }
          } else {
            console.log(`No phone number found for order ${order.orderNumber}, skipping WhatsApp notification`);
          }

          if (body.customer?.id && customerPhone) {
            await upsertStoredShopifyCustomer(body.customer.id.toString(), customerPhone)
          }

          const automationIntegrations = await getStoredIntegrations()
          await executeAutomationsForEvent('shopify.order_created', {
            customer_name: order.customerName,
            customerPhone: customerPhone,
            order_number: order.orderNumber,
            financial_status: order.status,
            order_total: order.total,
            currency: order.currency,
            review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
            ...buildOrderProductContext(order)
          }, automationIntegrations)
        }
        // Handle order status updates
        else if (topic && topic.startsWith('orders/') && body.id) {
          // Get the order from our database
          const existingOrder = await getStoredOrderByShopifyOrderId(body.id.toString())

          if (existingOrder) {
            // Extract the status from the topic (orders/fulfilled -> fulfilled)
            const newStatus = topic.replace('orders/', '')

            // Update order in database
            await updateStoredOrderByShopifyOrderId(body.id.toString(), {
              status: newStatus,
              updatedAt: new Date()
            })

            // Send WhatsApp notification if customer phone exists and status has changed
            if (existingOrder.customerPhone && existingOrder.status !== newStatus) {
              const integrations = await getStoredIntegrations()

              if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
                try {
                  // Send status update notification
                  const result = await sendOrderStatusUpdate(
                    integrations.whatsapp.phoneNumberId,
                    integrations.whatsapp.accessToken,
                    existingOrder.customerPhone,
                    existingOrder,
                    newStatus
                  )

                  // Log the message
                  await insertStoredMessage({
                    id: uuidv4(),
                    userId: 'default',
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

                  console.log(`WhatsApp status update sent for order ${existingOrder.orderNumber} (${newStatus})`);

                } catch (whatsappError) {
                  console.error('Failed to send WhatsApp status update:', whatsappError)
                  // Don't fail the webhook if WhatsApp fails
                }
              }

              const trackingNumber = body.fulfillments?.[0]?.tracking_number || body.fulfillments?.[0]?.tracking_numbers?.[0] || ''
              const trackingUrl = body.fulfillments?.[0]?.tracking_url || body.fulfillments?.[0]?.tracking_urls?.[0] || ''
              const automationIntegrations = await getStoredIntegrations()
              if (trackingNumber || topic === 'orders/fulfilled') {
                await executeAutomationsForEvent('shopify.fulfillment_created', {
                  customer_name: existingOrder.customerName,
                  customerPhone: existingOrder.customerPhone,
                  order_number: existingOrder.orderNumber,
                  tracking_number: trackingNumber,
                  tracking_url: trackingUrl,
                  financial_status: newStatus,
                  review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
                  ...buildOrderProductContext(existingOrder)
                }, automationIntegrations)
              }
              if (topic === 'orders/fulfilled') {
                await executeAutomationsForEvent('shopify.order_delivered', {
                  customer_name: existingOrder.customerName,
                  customerPhone: existingOrder.customerPhone,
                  order_number: existingOrder.orderNumber,
                  tracking_number: trackingNumber,
                  tracking_url: trackingUrl,
                  financial_status: newStatus,
                  review_link: process.env.NEXT_PUBLIC_BASE_URL || '',
                  ...buildOrderProductContext(existingOrder)
                }, automationIntegrations)
              }
            }
          }
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('Shopify webhook processing error:', error)
        // Always return success to Shopify even if we have errors
        // This prevents Shopify from retrying the webhook
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // Add a specific handler for debugging the route
    if (route === '/webhook/shopify' && method === 'GET') {
      return handleCORS(NextResponse.json({
        message: "Shopify webhook endpoint is working",
        method: "GET",
        note: "Shopify webhooks use POST method"
      }))
    }

    // New endpoint to send WhatsApp messages from the dashboard
    if (route === '/send-whatsapp-message' && method === 'POST') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
        const body = await request.json()
        const { to, message, accountId } = body

        if (!to || !message) {
          return handleCORS(NextResponse.json(
            { error: "Recipient and message are required" },
            { status: 400 }
          ))
        }

        let phoneNumberId, accessToken, businessAccountId

        // Get WhatsApp account - use accountId if provided, otherwise fallback to legacy integration
        if (accountId) {
          const waAccount = await getWhatsAppAccountById(accountId, authenticatedUserId)
          if (!waAccount) {
            return handleCORS(NextResponse.json(
              { error: "WhatsApp account not found" },
              { status: 404 }
            ))
          }
          phoneNumberId = waAccount.phoneNumberId
          accessToken = waAccount.accessToken
          businessAccountId = waAccount.businessAccountId || ''
        } else {
          // Legacy: Get from single integration
          const integrations = await getStoredIntegrations(authenticatedUserId)
          const waIntegration = typeof integrations?.whatsapp === 'string' 
            ? JSON.parse(integrations.whatsapp) 
            : integrations?.whatsapp

          if (!waIntegration?.phoneNumberId || !waIntegration?.accessToken) {
            return handleCORS(NextResponse.json(
              { error: "WhatsApp not configured. Please add a WhatsApp account first." },
              { status: 400 }
            ))
          }
          phoneNumberId = waIntegration.phoneNumberId
          accessToken = waIntegration.accessToken
          businessAccountId = waIntegration.businessAccountId || ''
        }

        await validateWhatsAppPhoneNumberAccess(phoneNumberId, accessToken, businessAccountId)

        // Prepare message data
        const messageData = {
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ''), // Remove any non-digit characters
          type: "text",
          text: {
            body: message
          }
        }

        // Send message via WhatsApp API
        const result = await sendWhatsAppMessage(
          phoneNumberId,
          accessToken,
          to,
          messageData
        )

        // Save message to database
        const savedMessage = await saveOutgoingMessage(to, message, result, authenticatedUserId)

        // Return the saved message object
        const messageResponse = {
          id: savedMessage.id,
          text: savedMessage.message,
          isCustomer: savedMessage.isCustomer,
          timestamp: savedMessage.timestamp,
          phone: savedMessage.phone
        }

        return handleCORS(NextResponse.json({
          success: true,
          message: messageResponse,
          messageId: result.messages?.[0]?.id
        }))

      } catch (error) {
        console.error('Failed to send WhatsApp message:', error)
        const isRecipientAllowlistError =
          error.message?.includes('Recipient phone number not in allowed list')

        return handleCORS(NextResponse.json(
          {
            error: isRecipientAllowlistError
              ? 'This phone number is not in your WhatsApp test recipient list.'
              : `Failed to send message: ${error.message}`,
            guidance: isRecipientAllowlistError
              ? 'In Meta Developer Dashboard, add this number to the WhatsApp API allowed recipients list, then try again.'
              : undefined
          },
          { status: isRecipientAllowlistError ? 400 : 500 }
        ))
      }
    }

    // New endpoint to get chats for the dashboard
    if (route === '/chats' && method === 'GET') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
        const chats = await getStoredChats(authenticatedUserId)
        console.log('[GET /chats] user:', authenticatedUserId, 'chatCount:', chats.length)

        const cleanedChats = chats.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedChats))
      } catch (error) {
        console.error('Failed to fetch chats:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch chats' },
          { status: 500 }
        ))
      }
    }

    // New endpoint to get messages for a specific chat
    if (route.startsWith('/chats/') && route.endsWith('/messages') && method === 'GET') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
        const phone = route.split('/')[2]; // Extract phone number from route

        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Fetch all messages for this phone number (both incoming from customer and outgoing to customer)
        const messages = await getStoredMessagesByPhone(phone, authenticatedUserId);
        console.log('[GET /chats/:phone/messages] user:', authenticatedUserId, 'phone:', phone, 'messageCount:', messages.length)
        if (messages[0]) {
          console.log('[GET /chats/:phone/messages] newest message snapshot:', JSON.stringify(messages[messages.length - 1]))
        }

        // Transform messages to ensure consistent structure for the frontend
        const transformedMessages = messages.map(msg => {
          // Robustly determine if this is a customer message
          const isCustomer = Boolean(msg.isCustomer === true || msg.isCustomer === 1 || msg.isCustomer === '1' || msg.isCustomer === 'true');
          
          if (isCustomer) {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: true,
              timestamp: msg.timestamp || new Date(),
              phone: msg.phone || phone
            };
          } else {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: false,
              timestamp: msg.timestamp || new Date(),
              phone: msg.recipient || phone
            };
          }
        });

        console.log('[GET /chats/:phone/messages] transformedCount:', transformedMessages.length)
        return handleCORS(NextResponse.json(transformedMessages));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch messages' },
          { status: 500 }
        ));
      }
    }

    // New endpoint to create a new chat
    if (route === '/chats' && method === 'POST') {
      try {
        const authenticatedUserId = requireRequestUserId(request)
        let body;
        try {
          body = await request.json();
        } catch (parseError) {
          console.error('Failed to parse JSON body:', parseError);
          return handleCORS(NextResponse.json(
            { error: "Invalid JSON in request body" },
            { status: 400 }
          ));
        }

        const { phone, name } = body;

        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Format the phone number
        const formattedPhone = phone.replace(/\D/g, '');

        // Check if chat already exists
        const existingChat = await getStoredChatByPhone(formattedPhone, authenticatedUserId);

        if (existingChat) {
          return handleCORS(NextResponse.json(existingChat));
        }

        // Create new chat
        const newChat = await upsertStoredChat({
          phone: formattedPhone,
          name: name || `Customer ${formattedPhone}`,
          lastMessage: 'Chat created',
          timestamp: new Date(),
          unread: 0
        }, authenticatedUserId);

        const { _id, ...cleanedChat } = newChat;
        return handleCORS(NextResponse.json(cleanedChat));
      } catch (error) {
        console.error('Failed to create chat:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to create chat' },
          { status: 500 }
        ));
      }
    }

    // Route not found
    console.log(`Route not found: ${route}, method: ${method}`)
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` },
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
