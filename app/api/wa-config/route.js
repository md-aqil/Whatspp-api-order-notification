import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

const SHOPIFY_WEBHOOK_TOPICS = [
  { value: 'shopify.order_created', label: 'Order Created', topic: 'orders/create', description: 'When a new order is created' },
  { value: 'shopify.order_updated', label: 'Order Updated', topic: 'orders/updated', description: 'When an order is updated' },
  { value: 'shopify.order_paid', label: 'Order Paid', topic: 'orders/paid', description: 'When payment is received for an order' },
  { value: 'shopify.fulfillment_created', label: 'Fulfillment Created', topic: 'orders/fulfilled', description: 'When tracking is created' },
  { value: 'shopify.order_cancelled', label: 'Order Cancelled', topic: 'orders/cancelled', description: 'When an order is cancelled' },
  { value: 'shopify.order_delivered', label: 'Order Delivered', topic: 'orders/delivered', description: 'When delivery is confirmed' },
  { value: 'shopify.cart_created', label: 'Checkout Created', topic: 'checkouts/create', description: 'When a checkout/cart is created' },
  { value: 'shopify.cart_updated', label: 'Checkout Updated', topic: 'checkouts/update', description: 'When a checkout/cart is updated' },
  { value: 'shopify.customer_created', label: 'Customer Created', topic: 'customers/create', description: 'When a new customer registers' },
  { value: 'shopify.customer_updated', label: 'Customer Updated', topic: 'customers/update', description: 'When customer information is updated' },
]

const EMPTY_WORDPRESS_CONFIG = {
  wordpress_url: '',
  woocommerce: {
    enabled: false,
    triggers: []
  },
  custom_tables: {
    enabled: false,
    tables: []
  }
}

const EMPTY_CONFIG = {
  ...EMPTY_WORDPRESS_CONFIG,
  shopify: {
    enabled: false,
    connected: false,
    triggers: []
  },
  whatsapp: {
    enabled: false,
    connected: false
  },
  connection: null,
  selected_wordpress_connection_id: null
}

function normalizeConnection(row) {
  if (!row) return null

  return {
    id: row.id,
    site_id: row.site_id,
    site_name: row.site_name,
    site_url: row.site_url,
    status: row.status,
    plugin_version: row.plugin_version || '',
    webhook_secret: row.webhook_secret || '',
    lastSeenAt: row.lastSeenAt || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  }
}

function normalizeWordPressConfig(config, fallbackUrl = '') {
  if (!config || typeof config !== 'object') {
    return {
      ...EMPTY_WORDPRESS_CONFIG,
      wordpress_url: fallbackUrl
    }
  }

  return {
    wordpress_url: config.wordpress_url || fallbackUrl || '',
    woocommerce: {
      enabled: Boolean(config?.woocommerce?.enabled),
      triggers: Array.isArray(config?.woocommerce?.triggers) ? config.woocommerce.triggers : []
    },
    custom_tables: {
      enabled: Boolean(config?.custom_tables?.enabled),
      tables: Array.isArray(config?.custom_tables?.tables) ? config.custom_tables.tables : []
    }
  }
}

async function getShopifyConfig(userId) {
  let shopifyConfig = { enabled: false, connected: false, triggers: [] }

  try {
    const [shopifyRows] = await query(
      `SELECT shopify FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1`,
      [userId]
    )

    if (shopifyRows[0]?.shopify) {
      const shopify = shopifyRows[0].shopify
      const isConnected = !!(shopify.shopDomain && shopify.clientId && shopify.clientSecret)
      shopifyConfig = {
        enabled: true,
        connected: isConnected,
        shopDomain: shopify.shopDomain || '',
        triggers: SHOPIFY_WEBHOOK_TOPICS
      }
    }
  } catch (error) {
    console.log('Shopify integration check skipped:', error.message)
  }

  return shopifyConfig
}

async function getWhatsAppConfig(userId) {
  let waConfig = { enabled: false, connected: false }

  try {
    const [waRows] = await query(
      `SELECT whatsapp FROM integrations WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC, id DESC LIMIT 1`,
      [userId]
    )

    if (waRows[0]?.whatsapp) {
      const wa = waRows[0].whatsapp
      waConfig = {
        enabled: true,
        connected: !!(wa.phoneNumberId && wa.accessToken),
        phoneNumberId: wa.phoneNumberId || '',
        businessAccountId: wa.businessAccountId || ''
      }
    }
  } catch (error) {
    console.log('WhatsApp integration check skipped:', error.message)
  }

  return waConfig
}

async function getStoredWaConfig(userId) {
  const [rows] = await query(
    `SELECT id, config FROM wa_config WHERE userId = ? ORDER BY updatedAt IS NULL, updatedAt DESC LIMIT 1`,
    [userId]
  )

  return rows[0] || null
}

async function getPreferredWordPressConnection({ userId, connectionId, siteId, selectedConnectionId }) {
  if (connectionId) {
    const [rows] = await query(
      'SELECT * FROM wordpress_connections WHERE id = ? AND userId = ? LIMIT 1',
      [connectionId, userId]
    )
    return rows[0] || null
  }

  if (siteId) {
    const [rows] = await query(
      'SELECT * FROM wordpress_connections WHERE site_id = ? AND userId = ? LIMIT 1',
      [siteId, userId]
    )
    return rows[0] || null
  }

  if (selectedConnectionId) {
    const [rows] = await query(
      'SELECT * FROM wordpress_connections WHERE id = ? AND userId = ? LIMIT 1',
      [selectedConnectionId, userId]
    )
    if (rows[0]) {
      return rows[0]
    }
  }

  const [rows] = await query(
    `SELECT * FROM wordpress_connections
     WHERE userId = ?
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updatedAt DESC, createdAt DESC
     LIMIT 1`,
    [userId]
  )

  return rows[0] || null
}

async function upsertWaConfig(userId, config) {
  const existing = await getStoredWaConfig(userId)

  if (existing?.id) {
    await query(
      `UPDATE wa_config SET config = ?, updatedAt = NOW() WHERE id = ?`,
      [JSON.stringify(config), existing.id]
    )
    return existing.id
  }

  await query(
    `INSERT INTO wa_config (userId, config, createdAt, updatedAt)
     VALUES (?, ?, NOW(), NOW())`,
    [userId, JSON.stringify(config)]
  )

  return null
}

async function cacheConnectionConfig(connectionId, config, status = 'active') {
  const metadataPatch = {
    cached_plugin_config: config,
    cached_plugin_config_at: new Date().toISOString()
  }

  await query(
    `UPDATE wordpress_connections
     SET metadata = JSON_MERGE_PATCH(COALESCE(metadata, '{}'), ?),
         status = ?,
         lastSeenAt = NOW(),
         updatedAt = NOW()
     WHERE id = ?`,
    [JSON.stringify(metadataPatch), status, connectionId]
  )
}

function buildResponse({ wordpressConfig, shopifyConfig, whatsappConfig, connection, selectedConnectionId }) {
  return {
    ...wordpressConfig,
    shopify: shopifyConfig,
    whatsapp: whatsappConfig,
    connection,
    selected_wordpress_connection_id: selectedConnectionId || null
  }
}

export async function GET(request) {
  try {
    await ensureSettingsTables()

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'default'
    const connectionId = url.searchParams.get('connectionId') || url.searchParams.get('connection_id')
    const siteId = url.searchParams.get('siteId') || url.searchParams.get('site_id')

    const [shopifyConfig, whatsappConfig, storedConfigRow] = await Promise.all([
      getShopifyConfig(userId),
      getWhatsAppConfig(userId),
      getStoredWaConfig(userId)
    ])

    const storedConfig = storedConfigRow?.config && typeof storedConfigRow.config === 'object'
      ? storedConfigRow.config
      : {}

    const preferredConnectionRow = await getPreferredWordPressConnection({
      userId,
      connectionId,
      siteId,
      selectedConnectionId: storedConfig.selected_wordpress_connection_id
    })

    const preferredConnection = normalizeConnection(preferredConnectionRow)
    const fallbackWordPressUrl = preferredConnection?.site_url
      || storedConfig.wordpress_url
      || process.env.WORDPRESS_URL
      || process.env.NEXT_PUBLIC_WORDPRESS_URL
      || ''

    if (!fallbackWordPressUrl) {
      return NextResponse.json(
        buildResponse({
          wordpressConfig: normalizeWordPressConfig(storedConfig),
          shopifyConfig,
          whatsappConfig,
          connection: preferredConnection,
          selectedConnectionId: preferredConnection?.id || storedConfig.selected_wordpress_connection_id || null
        })
      )
    }

    const wpUrl = `${fallbackWordPressUrl}/wp-admin/admin-ajax.php?action=wa_get_config`

    try {
      const response = await fetch(wpUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      })

      if (response.ok) {
        const fetchedConfig = await response.json()
        const normalizedConfig = normalizeWordPressConfig(fetchedConfig, fallbackWordPressUrl)
        const selectedConnectionId = preferredConnection?.id || storedConfig.selected_wordpress_connection_id || null

        const persistedConfig = {
          ...normalizedConfig,
          selected_wordpress_connection_id: selectedConnectionId
        }

        await upsertWaConfig(userId, persistedConfig)

        if (preferredConnection?.id) {
          await cacheConnectionConfig(preferredConnection.id, normalizedConfig, 'active')
        }

        return NextResponse.json(
          buildResponse({
            wordpressConfig: normalizedConfig,
            shopifyConfig,
            whatsappConfig,
            connection: preferredConnection,
            selectedConnectionId
          })
        )
      }
    } catch (fetchError) {
      console.log('Failed to fetch from WordPress:', fetchError.message)
    }

    const cachedPluginConfig = preferredConnection?.metadata?.cached_plugin_config
    const fallbackConfig = normalizeWordPressConfig(
      cachedPluginConfig || storedConfig,
      fallbackWordPressUrl
    )

    return NextResponse.json(
      buildResponse({
        wordpressConfig: fallbackConfig,
        shopifyConfig,
        whatsappConfig,
        connection: preferredConnection,
        selectedConnectionId: preferredConnection?.id || storedConfig.selected_wordpress_connection_id || null
      })
    )
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json(EMPTY_CONFIG)
  }
}

export async function POST(request) {
  try {
    await ensureSettingsTables()

    const body = await request.json()
    const {
      userId = 'default',
      connection_id,
      site_id,
      wordpress_url,
      woocommerce_triggers,
      custom_tables
    } = body
    const storedConfigRow = await getStoredWaConfig(userId)
    const storedConfig = storedConfigRow?.config && typeof storedConfigRow.config === 'object'
      ? storedConfigRow.config
      : {}

    let selectedConnectionRow = null
    if (connection_id || site_id) {
      selectedConnectionRow = await getPreferredWordPressConnection({
        userId,
        connectionId: connection_id,
        siteId: site_id,
        selectedConnectionId: null
      })

      if (!selectedConnectionRow) {
        return NextResponse.json(
          { error: 'Selected WordPress connection was not found' },
          { status: 404 }
        )
      }
    }

    const selectedConnection = normalizeConnection(selectedConnectionRow)
    const existingConnectionConfig = selectedConnection?.metadata?.cached_plugin_config
      && typeof selectedConnection.metadata.cached_plugin_config === 'object'
      ? selectedConnection.metadata.cached_plugin_config
      : {}
    const nextConfig = {
      wordpress_url: selectedConnection?.site_url || wordpress_url || '',
      woocommerce: {
        enabled: Array.isArray(woocommerce_triggers)
          ? woocommerce_triggers.length > 0
          : Boolean(existingConnectionConfig?.woocommerce?.enabled || storedConfig?.woocommerce?.enabled),
        triggers: Array.isArray(woocommerce_triggers)
          ? woocommerce_triggers
          : (existingConnectionConfig?.woocommerce?.triggers || storedConfig?.woocommerce?.triggers || [])
      },
      custom_tables: {
        enabled: Array.isArray(custom_tables)
          ? custom_tables.length > 0
          : Boolean(existingConnectionConfig?.custom_tables?.enabled || storedConfig?.custom_tables?.enabled),
        tables: Array.isArray(custom_tables)
          ? custom_tables
          : (existingConnectionConfig?.custom_tables?.tables || storedConfig?.custom_tables?.tables || [])
      },
      selected_wordpress_connection_id: selectedConnection?.id || null
    }

    await upsertWaConfig(userId, nextConfig)

    if (selectedConnection?.id) {
      const shouldCacheManualConfig = nextConfig.woocommerce.triggers.length > 0 || nextConfig.custom_tables.tables.length > 0

      if (shouldCacheManualConfig) {
        await cacheConnectionConfig(selectedConnection.id, nextConfig, selectedConnection.status || 'pending')
      }
    }

    const shopifyConfig = await getShopifyConfig(userId)
    const whatsappConfig = await getWhatsAppConfig(userId)

    return NextResponse.json(
      buildResponse({
        wordpressConfig: nextConfig,
        shopifyConfig,
        whatsappConfig,
        connection: selectedConnection,
        selectedConnectionId: selectedConnection?.id || null
      })
    )
  } catch (error) {
    console.error('Error saving config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
