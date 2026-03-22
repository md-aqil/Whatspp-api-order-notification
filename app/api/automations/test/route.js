import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'
import { buildAutomationTemplateComponents } from '@/lib/automation-template'
import { queryOne } from '@/lib/postgres'

function interpolateTemplateText(template, context) {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key]
    return value === undefined || value === null ? '' : String(value)
  })
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

function parseDelayToMs(step) {
  const value = parseInt(step.delayValue || '0', 10)
  if (!value) return 0
  if (step.delayUnit === 'minutes') return value * 60 * 1000
  if (step.delayUnit === 'days') return value * 24 * 60 * 60 * 1000
  return value * 60 * 60 * 1000
}

function resolveAutomationRecipient(step, context) {
  if (step?.recipientMode === 'fixed_number') {
    const fixedRecipient = typeof step.recipientNumber === 'string' ? step.recipientNumber.replace(/\D/g, '') : ''
    return fixedRecipient || null
  }

  const customerRecipient = typeof context.customerPhone === 'string' ? context.customerPhone.replace(/\D/g, '') : ''
  return customerRecipient || null
}

async function sendWhatsAppMessage(phoneNumberId, accessToken, messageData) {
  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      ...buildMetaAuthHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(mapMetaAccessTokenError(data.error?.message || 'WhatsApp API request failed'))
  }

  return data
}

async function getLatestOrderContext() {
  const order = await queryOne(
    `SELECT "orderNumber", "customerName", "customerPhone", total, currency, status, "lineItems"
     FROM orders
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC NULLS LAST
     LIMIT 1`,
    ['default']
  )

  if (!order) return null

  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : []
  const orderProductNames = lineItems
    .map((item) => String(item?.title || item?.name || item?.product_title || '').trim())
    .filter(Boolean)

  return {
    customer_name: order.customerName || 'Customer',
    customerPhone: order.customerPhone || '',
    order_number: order.orderNumber || '',
    order_product_name: orderProductNames[0] || '',
    order_product_names: orderProductNames.slice(0, 3).join(', '),
    tracking_number: 'TRACK-TEST-001',
    tracking_url: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/tracking` : 'https://example.com/tracking',
    financial_status: order.status || 'paid',
    order_total: order.total || '',
    currency: order.currency || 'INR',
    review_link: process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com/review'
  }
}

async function getLatestIncomingMessageContext() {
  const message = await queryOne(
    `SELECT recipient, message, timestamp
     FROM messages
     WHERE "userId" = $1 AND "isCustomer" = true
     ORDER BY timestamp DESC NULLS LAST, "createdAt" DESC NULLS LAST
     LIMIT 1`,
    ['default']
  )

  if (!message) return null

  return {
    customer_name: message.recipient || 'Customer',
    customer_phone: message.recipient || '',
    customerPhone: message.recipient || '',
    customer_message: message.message || 'Hi',
    order_number: '',
    tracking_number: '',
    tracking_url: '',
    financial_status: '',
    order_total: '',
    currency: 'INR',
    review_link: process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com/review',
    order_product_name: '',
    order_product_names: ''
  }
}

function getDummyContext() {
  return {
    customer_name: 'Test Customer',
    customer_phone: '',
    customerPhone: '',
    customer_message: 'Please send me the catalog',
    order_number: 'TEST-1001',
    tracking_number: 'TRACK-TEST-001',
    tracking_url: 'https://example.com/tracking/TRACK-TEST-001',
    financial_status: 'paid',
    order_total: '1499',
    currency: 'INR',
    review_link: process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com/review',
    order_product_name: 'Test Product',
    order_product_names: 'Test Product, Backup Product'
  }
}

export async function POST(request) {
  try {
    const { automationId, nodeId } = await request.json()

    if (!automationId) {
      return NextResponse.json({ error: 'automationId is required' }, { status: 400 })
    }

    const automation = await queryOne(
      `SELECT id, name, steps
       FROM automations
       WHERE id = $1 AND "userId" = $2
       LIMIT 1`,
      [automationId, 'default']
    )

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const steps = Array.isArray(automation.steps) ? automation.steps : []
    const stepMap = new Map(steps.map(step => [step.id, step]))
    const testNode = nodeId ? stepMap.get(nodeId) : steps.find(step => step.type === 'test')

    if (!testNode || testNode.type !== 'test') {
      return NextResponse.json({ error: 'Add a Test Node to this flow before running a test' }, { status: 400 })
    }

    const integrations = await queryOne(
      'SELECT whatsapp FROM integrations WHERE "userId" = $1 ORDER BY "updatedAt" DESC NULLS LAST, id DESC LIMIT 1',
      ['default']
    )

    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
    }

    const context = testNode.testSource === 'latest_order'
      ? (
          testNode.event === 'whatsapp.message_received'
            ? await getLatestIncomingMessageContext()
            : await getLatestOrderContext()
        )
      : getDummyContext()

    if (!context) {
      return NextResponse.json({
        error: testNode.event === 'whatsapp.message_received'
          ? 'No saved customer WhatsApp messages found for latest-message testing'
          : 'No saved orders found for latest-order testing'
      }, { status: 400 })
    }

    let currentStepId = testNode.connections?.main || ''
    let accumulatedDelayMs = 0
    const visited = new Set([testNode.id])
    const results = []

    while (currentStepId && !visited.has(currentStepId)) {
      visited.add(currentStepId)
      const step = stepMap.get(currentStepId)
      if (!step) break

      if (step.type === 'delay') {
        accumulatedDelayMs += parseDelayToMs(step)
        results.push({
          stepId: step.id,
          stepTitle: step.title,
          status: 'delay_skipped',
          detail: `Skipped ${step.delayValue || 0} ${step.delayUnit || 'hours'} for test run`
        })
        currentStepId = step.connections?.main || ''
        continue
      }

      if (step.type === 'condition') {
        const passed = matchesCondition(step.rule, context)
        results.push({
          stepId: step.id,
          stepTitle: step.title,
          status: passed ? 'condition_passed' : 'condition_failed',
          detail: step.rule || ''
        })
        currentStepId = passed ? (step.connections?.main || '') : (step.connections?.fallback || '')
        continue
      }

      if (step.type === 'message') {
        const recipient = resolveAutomationRecipient(step, context)
        if (!recipient) {
          results.push({
            stepId: step.id,
            stepTitle: step.title,
            status: 'skipped',
            error: step.recipientMode === 'fixed_number'
              ? 'Set a fixed number on this WhatsApp node'
              : 'No customer phone found. Use latest order with a customer phone or switch this node to Fixed number.'
          })
          currentStepId = step.connections?.main || ''
          continue
        }

        const body = interpolateTemplateText(step.message || '', context)
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
              text: {
                body
              }
            }

        try {
          const sendResult = await sendWhatsAppMessage(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            messageData
          )

          results.push({
            stepId: step.id,
            stepTitle: step.title,
            status: 'sent',
            recipient,
            template: step.template || null,
            message: body,
            whatsappMessageId: sendResult.messages?.[0]?.id || null
          })
        } catch (error) {
          results.push({
            stepId: step.id,
            stepTitle: step.title,
            status: 'failed',
            recipient,
            template: step.template || null,
            message: body,
            error: error.message
          })
        }

        currentStepId = step.connections?.main || ''
        continue
      }

      currentStepId = step.connections?.main || ''
    }

    return NextResponse.json({
      success: true,
      source: testNode.testSource || 'latest_order',
      skippedDelayMs: accumulatedDelayMs,
      contextPreview: {
        customer_name: context.customer_name,
        customerPhone: context.customerPhone,
        order_number: context.order_number
      },
      results
    })
  } catch (error) {
    console.error('Automation test failed:', error)
    return NextResponse.json({ error: 'Failed to run automation test' }, { status: 500 })
  }
}
