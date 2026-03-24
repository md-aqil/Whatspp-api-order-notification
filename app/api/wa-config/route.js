import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

// Standard Shopify webhook topics mapped to internal trigger events
const SHOPIFY_WEBHOOK_TOPICS = [
    { value: 'shopify.order_created', label: 'Order Created', topic: 'orders/create', description: 'When a new order is created' },
    { value: 'shopify.order_updated', label: 'Order Updated', topic: 'orders/updated', description: 'When an order is updated' },
    { value: 'shopify.order_paid', label: 'Order Paid', topic: 'orders/paid', description: 'When payment is received for an order' },
    { value: 'shopify.fulfillment_created', label: 'Fulfillment Created', topic: 'orders/fulfilled', description: 'When tracking is created' },
    { value: 'shopify.order_cancelled', label: 'Order Cancelled', topic: 'orders/cancelled', description: 'When an order is cancelled' },
    { value: 'shopify.order_delivered', label: 'Order Delivered', topic: 'orders/delivered', description: 'When delivery is confirmed' },
    { value: 'shopify.customer_created', label: 'Customer Created', topic: 'customers/create', description: 'When a new customer registers' },
    { value: 'shopify.customer_updated', label: 'Customer Updated', topic: 'customers/update', description: 'When customer information is updated' },
]

const EMPTY_CONFIG = {
    wordpress_url: '',
    woocommerce: {
        enabled: false,
        triggers: []
    },
    custom_tables: {
        enabled: false,
        tables: []
    },
    shopify: {
        enabled: false,
        connected: false,
        triggers: []
    }
}

// Fetch configuration from WordPress plugin
// This allows Automation Studio to show only configured tables and triggers

export async function GET() {
    try {
        await ensureSettingsTables()

        // Get WordPress site URL from database first, then environment
        let wordpressUrl = process.env.WORDPRESS_URL || process.env.NEXT_PUBLIC_WORDPRESS_URL

        // Try to get from database if not in env
        if (!wordpressUrl) {
            const storedConfig = await query(
                `SELECT config FROM wa_config WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
                ['default']
            )

            if (storedConfig?.rows?.[0]?.config?.wordpress_url) {
                wordpressUrl = storedConfig.rows[0].config.wordpress_url
            }
        }

        // Get Shopify integration status
        let shopifyConfig = { enabled: false, connected: false, triggers: [] }
        try {
            const shopifyIntegration = await query(
                `SELECT shopify FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1`,
                ['default']
            )

            if (shopifyIntegration?.rows?.[0]?.shopify) {
                const shopify = shopifyIntegration.rows[0].shopify
                const isConnected = !!(shopify.shopDomain && shopify.clientId && shopify.clientSecret)
                shopifyConfig = {
                    enabled: true,
                    connected: isConnected,
                    shopDomain: shopify.shopDomain || '',
                    triggers: SHOPIFY_WEBHOOK_TOPICS
                }
            }
        } catch (err) {
            console.log('Shopify integration check skipped:', err.message)
        }

        if (!wordpressUrl || wordpressUrl === 'undefined' || wordpressUrl === '') {
            // Return stored config from database as fallback
            const stored = await query(
                `SELECT config FROM wa_config WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
                ['default']
            )

            if (stored?.rows?.[0]?.config) {
                // Ensure we return the wordpress_url even if not in plugin config
                const config = stored.rows[0].config
                return NextResponse.json({
                    wordpress_url: config.wordpress_url || '',
                    woocommerce: config.woocommerce || { enabled: false, triggers: [] },
                    custom_tables: config.custom_tables || { enabled: false, tables: [] },
                    shopify: shopifyConfig
                })
            }

            return NextResponse.json({
                wordpress_url: '',
                woocommerce: {
                    enabled: false,
                    triggers: []
                },
                custom_tables: {
                    enabled: false,
                    tables: []
                },
                shopify: shopifyConfig
            })
        }

        // Fetch from WordPress admin AJAX
        const wpUrl = `${wordpressUrl}/wp-admin/admin-ajax.php?action=wa_get_config`

        try {
            const response = await fetch(wpUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-store' // Don't cache - fetch fresh from WordPress every time
            })

            if (response.ok) {
                const config = await response.json()

                // Store config in database for offline access.
                const existing = await query(
                    `SELECT id FROM wa_config WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
                    ['default']
                )

                if (existing?.rows?.[0]?.id) {
                    await query(
                        `UPDATE wa_config SET config = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
                        [JSON.stringify(config), existing.rows[0].id]
                    )
                } else {
                    await query(
                        `INSERT INTO wa_config ("userId", config, "createdAt", "updatedAt")
                         VALUES ($1, $2::jsonb, NOW(), NOW())`,
                        ['default', JSON.stringify(config)]
                    )
                }

                // Return combined config with Shopify
                return NextResponse.json({
                    ...config,
                    shopify: shopifyConfig
                })
            }
        } catch (fetchError) {
            console.log('Failed to fetch from WordPress:', fetchError.message)
        }

        // Return stored config as fallback
        const stored = await query(
            `SELECT config FROM wa_config WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
            ['default']
        )

        if (stored?.rows?.[0]?.config) {
            const config = stored.rows[0].config
            return NextResponse.json({
                wordpress_url: config.wordpress_url || '',
                woocommerce: config.woocommerce || { enabled: false, triggers: [] },
                custom_tables: config.custom_tables || { enabled: false, tables: [] },
                shopify: shopifyConfig
            })
        }

        return NextResponse.json({
            wordpress_url: '',
            woocommerce: {
                enabled: false,
                triggers: []
            },
            custom_tables: {
                enabled: false,
                tables: []
            },
            shopify: shopifyConfig
        })

    } catch (error) {
        console.error('Error fetching config:', error)
        return NextResponse.json(EMPTY_CONFIG)
    }
}

// Store manual config update
export async function POST(request) {
    try {
        await ensureSettingsTables()

        const body = await request.json()
        const { wordpress_url, woocommerce_triggers, custom_tables } = body

        // Store WordPress URL in config
        const config = {
            wordpress_url: wordpress_url || '',
            woocommerce: {
                enabled: true,
                triggers: woocommerce_triggers || []
            },
            custom_tables: {
                enabled: true,
                tables: custom_tables || []
            }
        }

        // Try to update first, then insert if not exists
        const existing = await query(
            `SELECT id FROM wa_config WHERE "userId" = $1`,
            ['default']
        )

        if (existing?.rows?.length > 0) {
            await query(
                `UPDATE wa_config SET config = $1, "updatedAt" = NOW() WHERE "userId" = $2`,
                [JSON.stringify(config), 'default']
            )
        } else {
            await query(
                `INSERT INTO wa_config ("userId", config, "createdAt", "updatedAt")
                VALUES ($1, $2::jsonb, NOW(), NOW())`,
                ['default', JSON.stringify(config)]
            )
        }

        return NextResponse.json({ success: true, config })
    } catch (error) {
        console.error('Error saving config:', error)
        return NextResponse.json(
            { error: 'Failed to save configuration' },
            { status: 500 }
        )
    }
}
