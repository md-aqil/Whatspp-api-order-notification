import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { Pool } from 'pg'

// WordPress database pool (configured via environment variables)
let wpPool

function getWordPressPool() {
    if (wpPool) return wpPool

    if (!process.env.WP_DB_HOST) {
        return null
    }

    wpPool = new Pool({
        host: process.env.WP_DB_HOST,
        port: parseInt(process.env.WP_DB_PORT || '3306'),
        database: process.env.WP_DB_NAME,
        user: process.env.WP_DB_USER,
        password: process.env.WP_DB_PASSWORD
    })

    return wpPool
}

// Required fields for WhatsApp notification
const REQUIRED_FIELDS = {
    'custom.webhook': ['customer_phone'],
    'custom.order_created': ['customer_phone', 'customer_name'],
    'custom.payment_received': ['customer_phone', 'order_total'],
    'woocommerce.order_created': ['customer_phone', 'order_number'],
    'woocommerce.order_updated': ['customer_phone', 'order_number']
}

// Field mappings for different data sources
const FIELD_MAPPINGS = {
    customer_name: ['customer_name', 'customerName', 'name', 'billing_name', 'first_name'],
    customer_phone: ['customer_phone', 'customerPhone', 'phone', 'billing_phone', 'tel'],
    order_number: ['order_number', 'orderNumber', 'order_id', 'orderId', 'id'],
    order_total: ['order_total', 'orderTotal', 'total', 'amount'],
    currency: ['currency', 'currency_code'],
    order_product_name: ['product_name', 'productName', 'item_name'],
    order_product_names: ['product_names', 'productNames', 'items']
}

// GET endpoint for verification - shows required data structure
export async function GET(request) {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'schema') {
        // Return the expected data schema for each event type
        return NextResponse.json({
            message: 'Custom Webhook Data Schemas',
            schemas: {
                'custom.order_created': {
                    required: ['customer_phone', 'customer_name'],
                    optional: ['order_number', 'order_total', 'currency', 'order_product_name'],
                    example: {
                        event: 'custom.order_created',
                        customer_name: 'John Doe',
                        customer_phone: '919876543210',
                        order_number: 'ORD-12345',
                        order_total: '150.00',
                        currency: 'USD'
                    }
                },
                'custom.payment_received': {
                    required: ['customer_phone', 'order_total'],
                    optional: ['customer_name', 'order_number', 'currency'],
                    example: {
                        event: 'custom.payment_received',
                        customer_name: 'Jane Smith',
                        customer_phone: '919876543210',
                        order_number: 'PAY-67890',
                        order_total: '250.00',
                        currency: 'INR'
                    }
                },
                'custom.webhook': {
                    required: [],
                    optional: ['customer_name', 'customer_phone', 'order_number', 'order_total', 'currency'],
                    example: {
                        event: 'custom.webhook',
                        customer_name: 'Alex Brown',
                        customer_phone: '918877665544',
                        order_number: 'REF-111',
                        order_total: '75.00'
                    }
                },
                'woocommerce.order_created': {
                    required: ['customer_phone', 'order_number'],
                    optional: ['customer_name', 'order_total', 'currency'],
                    example: {
                        event: 'woocommerce.order_created',
                        customer_name: 'Woo Customer',
                        customer_phone: '919988877766',
                        order_number: 'WOOC-1234',
                        order_total: '99.99',
                        currency: 'USD'
                    }
                }
            },
            field_aliases: FIELD_MAPPINGS,
            wordpress_example: {
                note: 'If WP_DB_* env vars are set, you can query your WordPress table directly',
                example: {
                    source_table: 'wp_your_custom_table',
                    source_id: '123',
                    event: 'custom.order_created'
                }
            }
        })
    }

    return NextResponse.json({
        message: 'Custom webhook endpoint is configured and ready',
        status: 'ready',
        webhook_url: '/api/webhook/custom',
        usage: 'POST with event data to trigger automations',
        get_schema: 'GET /api/webhook/custom?action=schema',
        example_payload: {
            event: 'custom.order_created',
            customer_name: 'John Doe',
            customer_phone: '919876543210',
            order_number: 'WOOC-12345',
            order_total: '99.99',
            currency: 'USD',
            order_product_name: 'Product Name'
        }
    })
}

// POST endpoint to receive custom webhook events from WordPress, WooCommerce, or other sources
export async function POST(request) {
    try {
        const body = await request.json()

        // Check if this is a query-based request (WordPress database lookup)
        const { source_table, source_id, source_mode, field_mapping, event, event_type, ...inlineData } = body

        let context = {}
        let eventType = event || event_type || 'custom.webhook'

        // Parse field mapping if provided
        let fieldMap = {}
        try {
            if (field_mapping && typeof field_mapping === 'string') {
                fieldMap = JSON.parse(field_mapping)
            } else if (field_mapping && typeof field_mapping === 'object') {
                fieldMap = field_mapping
            }
        } catch (e) {
            console.log('Field mapping parse error, using defaults')
        }

        // If source_table is provided (WordPress DB mode)
        if (source_table && source_id) {
            const dbResult = await fetchFromWordPressTable(source_table, source_id, eventType, fieldMap)
            if (!dbResult.success) {
                return NextResponse.json({ error: dbResult.error }, { status: 400 })
            }
            context = dbResult.data
            eventType = event || event_type || dbResult.inferredEvent
        } else {
            // Use inline data from webhook payload with custom field mapping
            context = buildContextFromPayload(body, fieldMap)
        }

        // Log the received webhook for debugging
        console.log('Custom webhook received:', {
            eventType,
            context,
            sourceTable: source_table || 'inline',
            sourceId: source_id || 'N/A'
        })

        // Validate required fields
        const requiredFields = REQUIRED_FIELDS[eventType] || REQUIRED_FIELDS['custom.webhook']
        const missingFields = requiredFields.filter(field => !context[field])

        if (missingFields.length > 0) {
            return NextResponse.json({
                error: 'Missing required fields',
                required: missingFields,
                received: Object.keys(context),
                hint: `Send these fields in your webhook: ${missingFields.join(', ')}`
            }, { status: 400 })
        }

        // Get user integrations
        const integrations = await query(
            `SELECT whatsapp FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1`,
            ['default']
        )

        if (!integrations?.rows?.[0]?.whatsapp) {
            return NextResponse.json(
                { error: 'WhatsApp not configured' },
                { status: 400 }
            )
        }

        // Find and execute automations for this event type
        const automationResult = await executeCustomWebhookAutomations(
            eventType,
            context,
            integrations.rows[0].whatsapp
        )

        return NextResponse.json({
            success: true,
            event: eventType,
            processed: automationResult.processed,
            message: `Processed ${automationResult.processed} automation(s)`,
            context: context
        })
    } catch (error) {
        console.error('Error processing custom webhook:', error)
        return NextResponse.json(
            { error: 'Failed to process custom webhook', details: error.message },
            { status: 500 }
        )
    }
}

// Fetch data from WordPress custom table
async function fetchFromWordPressTable(tableName, recordId, eventType, fieldMap = {}) {
    const pool = getWordPressPool()

    if (!pool) {
        return {
            success: false,
            error: 'WordPress database not configured. Set WP_DB_HOST, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD in .env'
        }
    }

    try {
        // Try to find the record - check common ID column names
        const idColumns = ['id', 'ID', 'order_id', 'orderId', 'record_id', 'recordId']
        let query = `SELECT * FROM ${tableName} WHERE `

        const whereClauses = idColumns.map(col => `${col} = $1`).join(' OR ')
        query += whereClauses + ' LIMIT 1'

        const result = await pool.query(query, [recordId.toString()])

        if (result.rows.length === 0) {
            return {
                success: false,
                error: `No record found in ${tableName} with id ${recordId}`
            }
        }

        const row = result.rows[0]

        // Infer event type based on table name if not provided
        let inferredEvent = eventType
        if (!eventType || eventType === 'custom.webhook') {
            const tableLower = tableName.toLowerCase()
            if (tableLower.includes('order')) {
                inferredEvent = 'custom.order_created'
            } else if (tableLower.includes('payment')) {
                inferredEvent = 'custom.payment_received'
            }
        }

        // Map WordPress table columns to automation context with custom mapping
        const context = mapWordPressRowToContext(row, inferredEvent, fieldMap)

        return {
            success: true,
            data: context,
            inferredEvent
        }
    } catch (error) {
        console.error('WordPress DB query error:', error)
        return {
            success: false,
            error: `Database query failed: ${error.message}`
        }
    }
}

// Map WordPress table row to automation context with custom field mapping
function mapWordPressRowToContext(row, eventType, fieldMap = {}) {
    const context = {}

    // First apply custom field mapping if provided
    if (Object.keys(fieldMap).length > 0) {
        for (const [targetField, sourceField] of Object.entries(fieldMap)) {
            if (row[sourceField] !== undefined && row[sourceField] !== null) {
                context[targetField] = row[sourceField]
            }
        }
    }

    // Then fill in any missing fields with default mappings
    for (const [key, aliases] of Object.entries(FIELD_MAPPINGS)) {
        if (context[key] !== undefined) continue // Skip if already set from custom mapping

        for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== null) {
                context[key] = row[alias]
                break
            }
        }
    }

    // Add any unmapped fields as custom_fields
    const mappedKeys = Object.values(FIELD_MAPPINGS).flat()
    context.custom_fields = {}

    for (const [key, value] of Object.entries(row)) {
        if (!mappedKeys.includes(key) && key !== 'id' && key !== 'ID' && !Object.values(fieldMap).includes(key)) {
            context.custom_fields[key] = value
        }
    }

    return context
}

// Build context from inline webhook payload with optional field mapping
function buildContextFromPayload(body, fieldMap = {}) {
    const {
        customer_name,
        customer_phone,
        customerName,
        customerPhone,
        phone,
        order_number,
        orderNumber,
        order_id,
        orderId,
        order_total,
        orderTotal,
        total,
        currency,
        products,
        custom_fields,
        metadata,
        ...extra
    } = body

    // Build base context
    let context = {
        customer_name: customer_name || customerName || '',
        customer_phone: customer_phone || customerPhone || phone || '',
        order_number: order_number || orderNumber || order_id || orderId || '',
        order_total: order_total || orderTotal || total || '',
        currency: currency || 'USD',
        order_product_names: products?.map(p => p.name).join(', ') || '',
        order_product_name: products?.[0]?.name || '',
        ...custom_fields,
        ...metadata,
        ...extra
    }

    // Apply custom field mapping if provided
    if (Object.keys(fieldMap).length > 0) {
        const mappedContext = {}
        for (const [targetField, sourceField] of Object.entries(fieldMap)) {
            if (context[sourceField] !== undefined && context[sourceField] !== null) {
                mappedContext[targetField] = context[sourceField]
            } else if (context[targetField] !== undefined) {
                // Keep original if not found in mapped field
                mappedContext[targetField] = context[targetField]
            }
        }
        // Merge unmapped fields
        context = { ...context, ...mappedContext }
    }

    return context
}

async function executeCustomWebhookAutomations(eventType, context, whatsappConfig) {
    const processed = 0
    let automationJobsCreated = 0

    try {
        // Fetch enabled automations that should trigger for this event
        // Map custom events to automation triggers
        const triggerMappings = {
            'custom.order_created': 'custom.webhook',
            'custom.order_updated': 'custom.webhook',
            'custom.order_status': 'custom.webhook',
            'custom.payment_received': 'custom.webhook',
            'custom.woocommerce.order_created': 'woocommerce.order_created',
            'custom.woocommerce.order_updated': 'woocommerce.order_updated'
        }

        const mappedTrigger = triggerMappings[eventType] || 'custom.webhook'

        // Get automations that match our trigger
        const automations = await query(
            `SELECT id, name, status, steps FROM automations 
       WHERE "userId" = $1 AND status = true`,
            ['default']
        )

        // Find matching automations
        const matchingAutomations = automations.rows?.filter(automation => {
            if (!automation.steps || !Array.isArray(automation.steps)) return false

            const triggerStep = automation.steps.find(step => step.type === 'trigger')
            return triggerStep?.event === mappedTrigger || triggerStep?.event === 'custom.webhook'
        }) || []

        // Process each matching automation
        for (const automation of matchingAutomations) {
            try {
                // Find all message steps in the automation
                const messageSteps = automation.steps.filter(
                    step => step.type === 'message' && step.channel === 'whatsapp'
                )

                for (const messageStep of messageSteps) {
                    // Build the message content from variables
                    let messageContent = messageStep.message || ''

                    // Replace variables in the message
                    messageContent = messageContent.replace(/\{\{\s*customer_name\s*\}\}/g, context.customer_name || '')
                    messageContent = messageContent.replace(/\{\{\s*order_number\s*\}\}/g, context.order_number || '')
                    messageContent = messageContent.replace(/\{\{\s*order_total\s*\}\}/g, context.order_total || '')
                    messageContent = messageContent.replace(/\{\{\s*currency\s*\}\}/g, context.currency || 'USD')
                    messageContent = messageContent.replace(/\{\{\s*order_product_name\s*\}\}/g, context.order_product_name || '')
                    messageContent = messageContent.replace(/\{\{\s*order_product_names\s*\}\}/g, context.order_product_names || '')

                    // Queue the automation job
                    if (context.customer_phone) {
                        await query(
                            `INSERT INTO automation_jobs (id, "automationId", "userId", recipient, message, template, payload, status, "runAt", "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())`,
                            [
                                crypto.randomUUID(),
                                automation.id,
                                'default',
                                context.customer_phone,
                                messageContent,
                                messageStep.template || null,
                                JSON.stringify({
                                    ...context,
                                    templateLanguage: messageStep.templateLanguage,
                                    templateComponents: messageStep.templateComponents,
                                    variableMappings: messageStep.variableMappings
                                })
                            ]
                        )
                        automationJobsCreated++
                    }
                }
            } catch (automationError) {
                console.error(`Error processing automation ${automation.id}:`, automationError)
            }
        }

        return {
            processed: automationJobsCreated,
            matchedAutomations: matchingAutomations.length
        }
    } catch (error) {
        console.error('Error in executeCustomWebhookAutomations:', error)
        return { processed: 0 }
    }
}