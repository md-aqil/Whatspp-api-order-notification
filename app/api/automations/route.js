import { NextResponse } from 'next/server'
import { query, queryMany, queryOne } from '@/lib/postgres'
import { defaultAutomations, sortAutomations } from '@/lib/automation-defaults'

const legacyDummyTemplates = new Set(['order_confirmation', 'tracking_update', 'feedback_request'])
const legacySeededDefaultTestStepIds = new Set(['step-test-1', 'step-test-2', 'step-test-3'])
const legacyWhatsAppReplySummary = 'Reply automatically when a customer messages you on WhatsApp.'
const legacyWhatsAppReplySummaryV2 = 'Start a warm WhatsApp conversation with brand information when a customer messages you.'
const legacyWhatsAppReplySummaryV3 = 'Start a warm four-step WhatsApp conversation with welcome, brand information, and guided next steps.'
const legacyWhatsAppReplySummaryV4 = 'Start a warm WhatsApp conversation with welcome, brand information, and a simple reply menu for common customer needs.'
const legacyWhatsAppReplySummaryV5 = 'Start with a welcome message, share quick options, then branch into the right WhatsApp reply.'
const legacyWhatsAppReplyRule = 'customer_message contains catalog'
const legacyWhatsAppReplyMessage = 'Hi {{customer_name}}, thanks for your message. We will share the catalog with you shortly.'
const legacyWhatsAppReplyMessageV2 = 'Hi {{customer_name}}, welcome to Vaclav Fashion. We are a premium fashion brand and we are here to help with collections, sizing, order updates, and styling support. Tell us what you are looking for and we will guide you.'
const legacyWhatsAppReplyMessageV3 = 'Reply with what you need, for example: catalog, sizing, order status, or support, and our team will guide you.'
const legacyWhatsAppReplySummaries = new Set([
  legacyWhatsAppReplySummary,
  legacyWhatsAppReplySummaryV2,
  legacyWhatsAppReplySummaryV3,
  legacyWhatsAppReplySummaryV4,
  legacyWhatsAppReplySummaryV5
])
const legacyWhatsAppReplyMessages = new Set([
  legacyWhatsAppReplyMessageV2,
  'Hi {{customer_name}}, thanks for messaging Vaclav Fashion.'
])
const legacyWhatsAppReplyMenus = new Set([
  legacyWhatsAppReplyMessageV3,
  'Reply with a number so we can help faster:\n1. Catalog\n2. New arrivals\n3. Order status\n4. Size guide\n5. Support'
])

function shouldReplaceLegacyWhatsAppDefaultFlow(steps = []) {
  const trigger = steps.find((step) => step.id === 'step-trigger-4')
  const welcome = steps.find((step) => step.id === 'step-message-4')
  const menu = steps.find((step) => step.id === 'step-message-6')

  const hasLegacyMessages = 
    trigger?.connections?.main === 'step-message-4' &&
    welcome?.connections?.main === 'step-message-6' &&
    menu?.connections?.main === 'step-condition-4' &&
    legacyWhatsAppReplyMessages.has(welcome?.message) &&
    legacyWhatsAppReplyMenus.has(menu?.message)

  const hasV5Intermediate =
    trigger?.connections?.main === 'step-interactive-1' &&
    steps.find((s) => s.id === 'step-interactive-1')?.message?.includes('thanks for messaging us') &&
    !steps.find((s) => s.id === 'step-interactive-shop')

  return hasLegacyMessages || hasV5Intermediate
}

function syncLegacyWhatsAppReplyStep(step, defaultStep) {
  if (!step || !defaultStep) return step

  if (step.id === 'step-message-4' && step.message === legacyWhatsAppReplyMessageV2) {
    return {
      ...step,
      title: defaultStep.title,
      message: defaultStep.message
    }
  }

  if (step.id === 'step-message-6' && step.message === legacyWhatsAppReplyMessageV3) {
    return {
      ...step,
      title: defaultStep.title,
      message: defaultStep.message
    }
  }

  if (
    step.id === 'step-message-5' &&
    step.title === 'Share brand information' &&
    step.message === 'We are a premium fashion brand and we can help with collections, new arrivals, sizing guidance, order updates, and styling support.'
  ) {
    return {
      ...step,
      title: defaultStep.title,
      message: defaultStep.message,
      description: defaultStep.description || ''
    }
  }

  return step
}

function sanitizeAutomation(inputAutomation) {
  if (!inputAutomation) return inputAutomation

  const defaultAutomation = defaultAutomations.find((automation) => automation.id === inputAutomation.id)
  const steps = Array.isArray(inputAutomation.steps)
    ? inputAutomation.steps.map((step) => {
        if (step.type !== 'message') return step

        const nextTemplate = legacyDummyTemplates.has(step.template) ? '' : (step.template || '')
        return {
          ...step,
          template: nextTemplate,
          templateLanguage: nextTemplate ? (step.templateLanguage || '') : '',
          templateComponents: nextTemplate ? (step.templateComponents || []) : [],
          variableMappings: Array.isArray(step.variableMappings) ? step.variableMappings : [],
          recipientMode: step.recipientMode || 'customer',
          recipientNumber: step.recipientNumber || ''
        }
      })
    : (defaultAutomation?.steps || [])

  return {
    ...defaultAutomation,
    ...inputAutomation,
    status: typeof inputAutomation.status !== 'undefined' ? !!inputAutomation.status : !!defaultAutomation?.status,
    source: inputAutomation.source || defaultAutomation?.source || 'Shopify',
    summary: inputAutomation.summary || defaultAutomation?.summary || '',
    metrics: inputAutomation.metrics || defaultAutomation?.metrics || {},
    steps
  }
}

function stepHasOwnTemplateSelection(step) {
  return Object.prototype.hasOwnProperty.call(step || {}, 'template')
}

async function upsertAutomationRow(automation) {
  const [existing] = await query('SELECT id FROM automations WHERE id = ?', [automation.id])

  if (existing[0]) {
    await query(
      `UPDATE automations SET
        name = ?,
        status = ?,
        source = ?,
        summary = ?,
        steps = ?,
        metrics = ?,
        updatedAt = NOW()
      WHERE id = ?`,
      [
        automation.name,
        !!automation.status,
        automation.source || 'Shopify',
        automation.summary || '',
        JSON.stringify(automation.steps || []),
        JSON.stringify(automation.metrics || {}),
        automation.id
      ]
    )
  } else {
    await query(
      `INSERT INTO automations (id, userId, name, status, source, summary, steps, metrics, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        automation.id,
        'default',
        automation.name,
        !!automation.status,
        automation.source || 'Shopify',
        automation.summary || '',
        JSON.stringify(automation.steps || []),
        JSON.stringify(automation.metrics || {})
      ]
    )
  }
}

async function ensureAutomationsSeeded() {
  const [rows] = await query('SELECT id FROM automations LIMIT 1')
  if (rows[0]) return

  for (const automation of defaultAutomations) {
    await upsertAutomationRow(automation)
  }
}

async function syncDefaultAutomations(rows) {
  for (const defaultAutomation of defaultAutomations) {
    const existing = rows.find((row) => row.id === defaultAutomation.id)
    if (!existing) {
      await upsertAutomationRow(defaultAutomation)
      continue
    }

    let changed = false
    const defaultStepMap = new Map((defaultAutomation.steps || []).map((step) => [step.id, step]))
    let filteredSteps = (existing.steps || []).filter((step) => {
      const keep = !legacySeededDefaultTestStepIds.has(step.id)
      if (!keep) changed = true
      return keep
    }).map((step) => {
      const defaultStep = defaultStepMap.get(step.id)
      if (defaultStep?.position) {
        const pos = step.position
        const hasLegacyLayout =
          !pos ||
          typeof pos.x !== 'number' ||
          typeof pos.y !== 'number' ||
          !Number.isInteger(pos.x) ||
          !Number.isInteger(pos.y)

        if (hasLegacyLayout) {
          changed = true
          step = {
            ...step,
            position: defaultStep.position
          }
        }
      }

      if (defaultAutomation.id === 'default-whatsapp-reply') {
        const syncedLegacyStep = syncLegacyWhatsAppReplyStep(step, defaultStep)
        if (syncedLegacyStep !== step) {
          changed = true
          step = syncedLegacyStep
        }
      }

      if (step.type !== 'message') return step
      if (!defaultStep?.template) return step

      // Only backfill missing legacy template fields.
      // If the user explicitly cleared the template to "", keep that choice.
      if (!stepHasOwnTemplateSelection(step)) {
        changed = true
        return {
          ...step,
          template: defaultStep.template,
          templateLanguage: defaultStep.templateLanguage || '',
          templateComponents: step.templateComponents || [],
          variableMappings: Array.isArray(step.variableMappings) ? step.variableMappings : []
        }
      }

      return step
    })

    if (
      defaultAutomation.id === 'default-whatsapp-reply' &&
      shouldReplaceLegacyWhatsAppDefaultFlow(filteredSteps)
    ) {
      changed = true
      filteredSteps = defaultAutomation.steps
    }

    let nextAutomation = existing
    if (
      defaultAutomation.id === 'default-whatsapp-reply' &&
      (!existing.summary || legacyWhatsAppReplySummaries.has(existing.summary))
    ) {
      changed = true
      nextAutomation = {
        ...nextAutomation,
        summary: defaultAutomation.summary
      }
    }

    if (!changed) continue

    await upsertAutomationRow(sanitizeAutomation({
      ...nextAutomation,
      steps: filteredSteps
    }))
  }
}

export async function GET() {
  try {
    await ensureAutomationsSeeded()

    const [rows] = await query(
      `SELECT id, name, status, source, summary, steps, metrics, createdAt, updatedAt
       FROM automations
       WHERE userId = ?
       ORDER BY updatedAt DESC, createdAt DESC`,
      ['default']
    )

    console.log('[automations] Rows fetched:', rows?.length)
    console.log('[automations] First row steps:', rows?.[0]?.steps)

    try {
      await syncDefaultAutomations(rows || [])
    } catch (syncError) {
      console.error('[automations] Sync error:', syncError.message)
    }

    const [refreshedRows] = await query(
      `SELECT id, name, status, source, summary, steps, metrics, createdAt, updatedAt
       FROM automations
       WHERE userId = ?
       ORDER BY updatedAt DESC, createdAt DESC`,
      ['default']
    )

    // Parse JSON columns from MySQL
    const parsedRows = (refreshedRows || []).map(row => ({
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics
    }))

    return NextResponse.json(sortAutomations(parsedRows))
  } catch (error) {
    console.error('Error fetching automations:', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const automations = Array.isArray(body) ? body : body.automations

    if (!Array.isArray(automations)) {
      return NextResponse.json({ error: 'Automations array is required' }, { status: 400 })
    }

    await query('DELETE FROM automations WHERE userId = ?', ['default'])

    for (const automation of automations) {
      await upsertAutomationRow(sanitizeAutomation(automation))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving automations:', error)
    return NextResponse.json({ error: 'Failed to save automations', details: error.message, stack: error.stack }, { status: 500 })
  }
}
