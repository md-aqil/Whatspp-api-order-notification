import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { Pool } from 'pg'
import { ensureSettingsTables } from '@/lib/settings-db'

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
    customer_email: ['customer_email', 'customerEmail', 'email', 'billing_email'],
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
        await ensureSettingsTables()

        const rawBody = await request.text()
        const body = rawBody ? JSON.parse(rawBody) : {}

        const requestSiteId = body.site_id || request.headers.get('x-wordpress-site-id') || null
        const requestSignature = request.headers.get('x-wordpress-webhook-signature')
        let signatureVerified = false

        if (requestSiteId && requestSignature) {
            const connection = await query(
                `SELECT webhook_secret FROM wordpress_connections
                 WHERE site_id = $1 AND "userId" = $2
                 ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC
                 LIMIT 1`,
                [requestSiteId, 'default']
            )

            const webhookSecret = connection?.rows?.[0]?.webhook_secret
            if (webhookSecret) {
                const expectedSignature = crypto
                    .createHmac('sha256', webhookSecret)
                    .update(rawBody)
                    .digest('hex')

                if (expectedSignature !== requestSignature) {
                    return NextResponse.json(
                        { error: 'Invalid webhook signature' },
                        { status: 401 }
                    )
                }

                signatureVerified = true
            }
        }

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

        // Log to webhook_logs table with site identification
        try {
            const siteId = body.site_id || body.siteName || 'unknown'
            const siteName = body.site_name || body.siteName || 'Unknown Site'
            const siteUrl = body.site_url || 'unknown'

            await query(
                `INSERT INTO webhook_logs (id, type, topic, payload, "receivedAt", "createdAt")
                 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
                [
                    `custom_${Date.now()}`,
                    'custom',
                    eventType,
                    JSON.stringify({
                        ...body,
                        _site_info: {
                            site_id: siteId,
                            site_name: siteName,
                            site_url: siteUrl,
                            source: 'wordpress-plugin'
                        }
                    })
                ]
            )
            console.log('Webhook logged with site info:', { siteId, siteName, siteUrl })

            if (requestSiteId) {
                await query(
                    `UPDATE wordpress_connections
                     SET "lastSeenAt" = NOW(),
                         status = CASE WHEN $2 THEN 'active' ELSE status END,
                         "updatedAt" = NOW(),
                         metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
                     WHERE site_id = $3 AND "userId" = $4`,
                    [
                        JSON.stringify({
                            last_webhook_at: new Date().toISOString(),
                            last_webhook_topic: eventType,
                            last_webhook_signature_verified: signatureVerified,
                            last_webhook_payload_source: 'custom-webhook'
                        }),
                        signatureVerified,
                        requestSiteId,
                        'default'
                    ]
                )
            }
        } catch (logError) {
            console.error('Failed to log webhook:', logError)
        }

        const matchingAutomations = await getMatchingAutomations(eventType)
        const warnings = []
        const validation = validateWebhookContext(eventType, context, matchingAutomations)

        if (validation.missingFields.length > 0) {
            warnings.push(`Missing fields for direct customer delivery: ${validation.missingFields.join(', ')}`)
        }

        // Get user integrations
        const integrations = await query(
            `SELECT whatsapp FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1`,
            ['default']
        )

        if (!integrations?.rows?.[0]?.whatsapp) {
            return NextResponse.json({
                success: true,
                event: eventType,
                processed: 0,
                matchedAutomations: matchingAutomations.length,
                warnings: [...warnings, 'WhatsApp is not configured yet. Webhook was received and logged, but no automation messages were sent.'],
                context
            })
        }

        // Find and execute automations for this event type
        const automationResult = await executeCustomWebhookAutomations(
            eventType,
            context,
            integrations.rows[0].whatsapp,
            matchingAutomations,
            body
        )

        warnings.push(...automationResult.warnings)

        return NextResponse.json({
            success: true,
            event: eventType,
            processed: automationResult.processed,
            matchedAutomations: automationResult.matchedAutomations,
            message: `Processed ${automationResult.processed} automation message(s)`,
            warnings,
            context
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
        customer_email,
        customerEmail,
        email,
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
        customer_email: customer_email || customerEmail || email || '',
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

function getValueByPath(source, path = '') {
    if (!source || !path) return undefined

    return String(path)
        .split('.')
        .filter(Boolean)
        .reduce((current, segment) => {
            if (current === undefined || current === null) return undefined
            return current[segment]
        }, source)
}

function normalizeComparableValue(value) {
    if (value === undefined || value === null) return ''
    return String(value).trim()
}

function inferCustomWebhookChangeType(eventType, payload = {}) {
    const candidates = [
        payload.change_type,
        payload.changeType,
        payload.operation,
        payload.action,
        payload.event_action,
        payload.eventAction
    ].filter(Boolean)

    const normalizedCandidate = candidates
        .map(value => String(value).trim().toLowerCase())
        .find(Boolean)

    if (normalizedCandidate) {
        if (normalizedCandidate.includes('create') || normalizedCandidate.includes('insert')) return 'created'
        if (normalizedCandidate.includes('update')) return 'updated'
    }

    if (eventType === 'custom.order_created') return 'created'
    if (Array.isArray(payload.changed_columns || payload.changedColumns)) return 'updated'
    if (payload.previous_values || payload.previousValues || payload.previous || payload.before) return 'updated'

    return 'unknown'
}

function getColumnChangeSnapshot(payload = {}, context = {}, columnPath = '') {
    const changedColumns = payload.changed_columns || payload.changedColumns || []
    const previousValue =
        getValueByPath(payload, `previous_values.${columnPath}`) ??
        getValueByPath(payload, `previousValues.${columnPath}`) ??
        getValueByPath(payload, `previous.${columnPath}`) ??
        getValueByPath(payload, `before.${columnPath}`) ??
        payload[`previous_${columnPath}`]

    const currentValue =
        getValueByPath(payload, `current_values.${columnPath}`) ??
        getValueByPath(payload, `currentValues.${columnPath}`) ??
        getValueByPath(payload, `current.${columnPath}`) ??
        getValueByPath(payload, `after.${columnPath}`) ??
        getValueByPath(payload, columnPath) ??
        getValueByPath(context, columnPath)

    const changed = (
        (Array.isArray(changedColumns) && changedColumns.map(String).includes(columnPath)) ||
        (previousValue !== undefined && currentValue !== undefined && normalizeComparableValue(previousValue) !== normalizeComparableValue(currentValue))
    )

    return {
        previousValue,
        currentValue,
        changed
    }
}

function applyTriggerFieldMappings(baseContext = {}, payload = {}, mappings = []) {
    if (!Array.isArray(mappings) || mappings.length === 0) return baseContext

    const mappedContext = { ...baseContext }

    for (const mapping of mappings) {
        const targetField = typeof mapping?.targetField === 'string' ? mapping.targetField.trim() : ''
        const sourceField = typeof mapping?.sourceField === 'string' ? mapping.sourceField.trim() : ''
        if (!targetField || !sourceField) continue

        const mappedValue =
            getValueByPath(payload, sourceField) ??
            getValueByPath(baseContext, sourceField)

        if (mappedValue !== undefined && mappedValue !== null && mappedValue !== '') {
            mappedContext[targetField] = mappedValue
        }
    }

    return mappedContext
}

function matchesCustomWebhookTrigger(triggerStep = {}, eventType, payload = {}, context = {}) {
    if (triggerStep?.event !== 'custom.webhook') {
        return { matched: true, reason: '' }
    }

    const mode = triggerStep.customTriggerMode || 'any'
    const expectedTable = typeof triggerStep.selectedTable === 'string' ? triggerStep.selectedTable.trim() : ''
    const payloadTable = payload.source_table || payload.sourceTable || payload.table || payload.table_name || payload.tableName || ''

    if (expectedTable && payloadTable && expectedTable !== payloadTable) {
        return {
            matched: false,
            reason: `Skipped "${triggerStep.title || 'Custom Webhook'}" because payload table "${payloadTable}" did not match "${expectedTable}".`
        }
    }

    if (mode === 'any') {
        return { matched: true, reason: '' }
    }

    const changeType = inferCustomWebhookChangeType(eventType, payload)

    if (mode === 'row_created') {
        return {
            matched: changeType === 'created',
            reason: changeType === 'created' ? '' : `Skipped "${triggerStep.title || 'Custom Webhook'}" because this payload is not marked as a row create event.`
        }
    }

    if (mode === 'row_updated') {
        return {
            matched: changeType === 'updated',
            reason: changeType === 'updated' ? '' : `Skipped "${triggerStep.title || 'Custom Webhook'}" because this payload is not marked as a row update event.`
        }
    }

    const watchedColumn = typeof triggerStep.customWatchedColumn === 'string' ? triggerStep.customWatchedColumn.trim() : ''
    if (!watchedColumn) {
        return {
            matched: false,
            reason: `Skipped "${triggerStep.title || 'Custom Webhook'}" because no watched column is configured.`
        }
    }

    const snapshot = getColumnChangeSnapshot(payload, context, watchedColumn)
    if (!snapshot.changed) {
        return {
            matched: false,
            reason: `Skipped "${triggerStep.title || 'Custom Webhook'}" because "${watchedColumn}" did not change.`
        }
    }

    if (mode === 'column_changed') {
        if (triggerStep.customPreviousValue) {
            const previousMatches = normalizeComparableValue(snapshot.previousValue) === normalizeComparableValue(triggerStep.customPreviousValue)
            return {
                matched: previousMatches,
                reason: previousMatches ? '' : `Skipped "${triggerStep.title || 'Custom Webhook'}" because previous value for "${watchedColumn}" did not match "${triggerStep.customPreviousValue}".`
            }
        }

        return { matched: true, reason: '' }
    }

    if (mode === 'column_changed_to_value') {
        const currentMatches = normalizeComparableValue(snapshot.currentValue) === normalizeComparableValue(triggerStep.customExpectedValue)
        const previousMatches = !triggerStep.customPreviousValue ||
            normalizeComparableValue(snapshot.previousValue) === normalizeComparableValue(triggerStep.customPreviousValue)

        return {
            matched: currentMatches && previousMatches,
            reason: currentMatches && previousMatches
                ? ''
                : `Skipped "${triggerStep.title || 'Custom Webhook'}" because "${watchedColumn}" transition did not match the configured values.`
        }
    }

    return { matched: true, reason: '' }
}

function parseDelayToMs(step) {
    const value = parseInt(step?.delayValue || '0', 10)
    if (!value) return 0
    if (step.delayUnit === 'minutes') return value * 60 * 1000
    if (step.delayUnit === 'days') return value * 24 * 60 * 60 * 1000
    return value * 60 * 60 * 1000
}

function getSequentialStepId(steps, currentStepId) {
    const index = steps.findIndex(step => step.id === currentStepId)
    if (index === -1) return ''
    return steps[index + 1]?.id || ''
}

function getNextAutomationStepId(steps, step, key = 'main') {
    const explicitTarget = step?.connections?.[key]
    if (explicitTarget) return explicitTarget
    if (key === 'fallback') return ''
    return getSequentialStepId(steps, step?.id)
}

function matchesCondition(rule, context) {
    if (!rule) return true
    const trimmed = rule.trim()

    if (trimmed.includes(' contains_any ')) {
        const [left, right] = trimmed.split(' contains_any ').map(value => value.trim())
        const haystack = String(context[left] ?? '').toLowerCase()
        return right.split('|').some(token => haystack.includes(token.trim().toLowerCase()))
    }

    if (trimmed.includes(' not contains ')) {
        const [left, right] = trimmed.split(' not contains ').map(value => value.trim())
        return !String(context[left] ?? '').toLowerCase().includes(right.toLowerCase())
    }

    if (trimmed.includes(' contains ')) {
        const [left, right] = trimmed.split(' contains ').map(value => value.trim())
        return String(context[left] ?? '').toLowerCase().includes(right.toLowerCase())
    }

    if (trimmed.includes('!=')) {
        const [left, right] = trimmed.split('!=').map(value => value.trim())
        return String(context[left] ?? '') !== right
    }

    if (trimmed.includes('=')) {
        const [left, right] = trimmed.split('=').map(value => value.trim())
        return String(context[left] ?? '') === right
    }

    return true
}

function resolveCustomWebhookTrigger(eventType) {
    const triggerMappings = {
        'custom.order_created': 'custom.webhook',
        'custom.order_updated': 'custom.webhook',
        'custom.order_status': 'custom.webhook',
        'custom.payment_received': 'custom.webhook',
        'custom.woocommerce.order_created': 'woocommerce.order_created',
        'custom.woocommerce.order_updated': 'woocommerce.order_updated'
    }

    const isWooCommerceEvent = eventType.startsWith('woocommerce.')
    return triggerMappings[eventType] || (isWooCommerceEvent ? eventType : 'custom.webhook')
}

function resolveAutomationRecipient(step, context) {
    if (step?.recipientMode === 'fixed_number') {
        const fixedRecipient = typeof step.recipientNumber === 'string'
            ? step.recipientNumber.replace(/\D/g, '')
            : ''
        return fixedRecipient || null
    }

    const customerRecipient = typeof context.customer_phone === 'string'
        ? context.customer_phone.replace(/\D/g, '')
        : ''
    return customerRecipient || null
}

function buildAutomationStateRecipient(steps, context) {
    for (const step of steps) {
        if (step?.type !== 'message') continue
        const recipient = resolveAutomationRecipient(step, context)
        if (recipient) return recipient
    }

    const emailKey = typeof context.customer_email === 'string'
        ? context.customer_email.replace(/[^\w.-]/g, '_')
        : ''
    return emailKey || `unknown_${Date.now()}`
}

function interpolateAutomationMessage(message = '', context = {}) {
    return String(message || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
        const value = context[key]
        return value === undefined || value === null ? '' : String(value)
    })
}

async function getMatchingAutomations(eventType) {
    const automations = await query(
        `SELECT id, name, status, steps FROM automations
         WHERE "userId" = $1 AND status = true`,
        ['default']
    )

    const mappedTrigger = resolveCustomWebhookTrigger(eventType)

    return automations.rows?.filter(automation => {
        if (!Array.isArray(automation.steps)) return false
        const triggerStep = automation.steps.find(step => step.type === 'trigger')
        return triggerStep?.event === mappedTrigger || triggerStep?.event === 'custom.webhook'
    }) || []
}

function validateWebhookContext(eventType, context, automations = []) {
    const requiredFields = REQUIRED_FIELDS[eventType] || REQUIRED_FIELDS['custom.webhook'] || []
    const missingFields = requiredFields.filter(field => {
        if (context[field]) return false
        if (field !== 'customer_phone') return true

        return !automations.some(automation => (
            Array.isArray(automation.steps) &&
            automation.steps.some(step => step.type === 'message' && !!resolveAutomationRecipient(step, context))
        ))
    })

    return { missingFields }
}

async function executeCustomWebhookAutomations(eventType, context, whatsappConfig, matchingAutomations, payload = {}) {
    let automationJobsCreated = 0
    const warnings = []

    try {
        // Process each matching automation
        for (const automation of matchingAutomations) {
            try {
                const steps = Array.isArray(automation.steps) ? automation.steps : []
                const triggerStep = steps.find(step => step.type === 'trigger')
                if (!triggerStep) continue

                const triggerMatch = matchesCustomWebhookTrigger(triggerStep, eventType, payload, context)
                if (!triggerMatch.matched) {
                    if (triggerMatch.reason) warnings.push(triggerMatch.reason)
                    continue
                }

                const automationContext = applyTriggerFieldMappings(
                    context,
                    payload,
                    triggerStep.customFieldMappings || []
                )

                const stateRecipient = buildAutomationStateRecipient(steps, automationContext)
                const stateId = `${automation.id}:${stateRecipient}`

                await query(
                    `INSERT INTO automation_conversation_state
                     (id, "userId", "automationId", recipient, state, "lastInboundAt", payload, "updatedAt")
                     VALUES ($1, $2, $3, $4, $5, NOW(), $6::jsonb, NOW())
                     ON CONFLICT (id) DO UPDATE SET
                     payload = EXCLUDED.payload,
                     "lastInboundAt" = NOW(),
                     "updatedAt" = NOW()`,
                    [stateId, 'default', automation.id, stateRecipient, 'active', JSON.stringify(automationContext)]
                )

                let totalDelayMs = 0
                let currentStepId = getNextAutomationStepId(steps, triggerStep, 'main')
                const visited = new Set([triggerStep.id])

                while (currentStepId && !visited.has(currentStepId)) {
                    visited.add(currentStepId)
                    const step = steps.find(item => item.id === currentStepId)
                    if (!step) break

                    if (step.type === 'condition') {
                        const passed = matchesCondition(step.rule, automationContext)
                        currentStepId = getNextAutomationStepId(steps, step, passed ? 'main' : 'fallback')
                        continue
                    }

                    if (step.type === 'delay') {
                        totalDelayMs += parseDelayToMs(step)
                        currentStepId = getNextAutomationStepId(steps, step, 'main')
                        continue
                    }

                    if (step.type === 'message') {
                        const recipient = resolveAutomationRecipient(step, automationContext)
                        if (!recipient) {
                            warnings.push(`Skipped "${automation.name}" step "${step.title || step.id}" because no recipient was available.`)
                            currentStepId = getNextAutomationStepId(steps, step, 'main')
                            continue
                        }

                        await query(
                            `INSERT INTO automation_jobs (id, "automationId", "userId", recipient, message, template, payload, status, "runAt", "createdAt")
                             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', $8, NOW())`,
                            [
                                crypto.randomUUID(),
                                automation.id,
                                'default',
                                recipient,
                                interpolateAutomationMessage(step.message, automationContext),
                                step.template || null,
                                JSON.stringify({
                                    ...automationContext,
                                    recipientMode: step.recipientMode || 'customer',
                                    recipientNumber: step.recipientNumber || '',
                                    templateLanguage: step.templateLanguage || 'en_US',
                                    templateComponents: step.templateComponents || [],
                                    variableMappings: step.variableMappings || []
                                }),
                                new Date(Date.now() + totalDelayMs)
                            ]
                        )

                        automationJobsCreated++
                    }

                    currentStepId = getNextAutomationStepId(steps, step, 'main')
                }
            } catch (automationError) {
                console.error(`Error processing automation ${automation.id}:`, automationError)
                warnings.push(`Automation "${automation.name}" failed: ${automationError.message}`)
            }
        }

        return {
            processed: automationJobsCreated,
            matchedAutomations: matchingAutomations.length,
            warnings
        }
    } catch (error) {
        console.error('Error in executeCustomWebhookAutomations:', error)
        return {
            processed: 0,
            matchedAutomations: matchingAutomations?.length || 0,
            warnings: [`Automation execution failed: ${error.message}`]
        }
    }
}
