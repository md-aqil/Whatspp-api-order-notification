import { NextResponse } from 'next/server'
import { query, queryMany, queryOne } from '@/lib/postgres'
import { defaultAutomations } from '@/lib/automation-defaults'

const legacyDummyTemplates = new Set(['order_confirmation', 'tracking_update', 'feedback_request'])
const legacySeededDefaultTestStepIds = new Set(['step-test-1', 'step-test-2', 'step-test-3'])

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
    status: typeof inputAutomation.status === 'boolean' ? inputAutomation.status : !!defaultAutomation?.status,
    source: inputAutomation.source || defaultAutomation?.source || 'Shopify',
    summary: inputAutomation.summary || defaultAutomation?.summary || '',
    metrics: inputAutomation.metrics || defaultAutomation?.metrics || {},
    steps
  }
}

async function upsertAutomationRow(automation) {
  await query(
    `INSERT INTO automations (id, "userId", name, status, source, summary, steps, metrics, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       name = EXCLUDED.name,
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       summary = EXCLUDED.summary,
       steps = EXCLUDED.steps,
       metrics = EXCLUDED.metrics,
       "updatedAt" = NOW()`,
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

async function ensureAutomationsSeeded() {
  const existing = await queryOne('SELECT id FROM automations LIMIT 1')
  if (existing) return

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

    const filteredSteps = (existing.steps || []).filter((step) => !legacySeededDefaultTestStepIds.has(step.id))

    if (filteredSteps.length === (existing.steps || []).length) continue

    await upsertAutomationRow(sanitizeAutomation({
      ...existing,
      steps: filteredSteps
    }))
  }
}

export async function GET() {
  try {
    await ensureAutomationsSeeded()

    const rows = await queryMany(
      `SELECT id, name, status, source, summary, steps, metrics, "createdAt", "updatedAt"
       FROM automations
       WHERE "userId" = $1
       ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC NULLS LAST`,
      ['default']
    )

    await syncDefaultAutomations(rows)

    const refreshedRows = await queryMany(
      `SELECT id, name, status, source, summary, steps, metrics, "createdAt", "updatedAt"
       FROM automations
       WHERE "userId" = $1
       ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC NULLS LAST`,
      ['default']
    )

    return NextResponse.json(refreshedRows)
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

    await query('DELETE FROM automations WHERE "userId" = $1', ['default'])

    for (const automation of automations) {
      await upsertAutomationRow(sanitizeAutomation(automation))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving automations:', error)
    return NextResponse.json({ error: 'Failed to save automations' }, { status: 500 })
  }
}
