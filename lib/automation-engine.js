import { v4 as uuidv4 } from 'uuid'
import { getPool, query, queryOne, queryMany } from './mysql'
import { generateAIResponse } from './ai'
import { buildMetaAuthHeaders } from './meta-auth'
import { decrypt } from './encryption'
import { enqueueAutomationEvent, enqueueDelayedStep } from './queue'
import { httpClient } from './httpClient'
import { metricsService } from './metrics'
import { getZohoClient } from './zoho-api'

const WHATSAPP_SUPPORT_HANDOFF_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * Core automation engine to process events asynchronously.
 * This is the high-performance replacement for the legacy executeAutomationsForEvent.
 */
export async function processAutomationEvent(jobData) {
  const { event, context, userId, automationId, stepId } = jobData
  
  console.log(`[Automation Engine] Processing ${event || 'delayed-step'} for user ${userId}`)

  // 1. Fetch active integrations (needed for API tokens)
  const integrationRow = await queryOne(
    'SELECT whatsapp, shopify FROM integrations WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1',
    [userId]
  )
  if (!integrationRow) return
  
  const decryptIfNeeded = (val) => {
    if (!val || typeof val !== 'string') return val
    const decrypted = decrypt(val)
    try {
      return JSON.parse(decrypted)
    } catch (e) {
      return val
    }
  }

  const integrations = {
    whatsapp: decryptIfNeeded(integrationRow.whatsapp),
    shopify: decryptIfNeeded(integrationRow.shopify)
  }

  const waPhone = integrations.whatsapp?.phoneNumberId
  const waToken = integrations.whatsapp?.accessToken
  console.log(`[Automation Engine] WA credentials check — phoneNumberId: ${waPhone ? waPhone.substring(0,8)+'...' : 'MISSING'}, accessToken: ${waToken ? 'present('+waToken.length+' chars)' : 'MISSING'}`)

  if (!waPhone || !waToken) {
    console.log('[Automation Engine] WhatsApp integration incomplete. Skipping.')
    return
  }

  // 2. Identify potential automations
  if (automationId && stepId) {
    // Resume a specific automation from a specific step (DELAY/RESUME)
    const row = await queryOne(
      `SELECT id, name, steps, metrics FROM automations WHERE id = ? AND userId = ?`,
      [automationId, userId]
    )
    if (row) {
      const automation = {
        ...row,
        steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps
      }
      await runAutomationLoop(automation, context, integrations, userId, event, stepId)
    }
  } else {
    // Normal event-based trigger
    const rows = await queryMany(
      `SELECT id, name, steps, metrics
       FROM automations
       WHERE userId = ? AND status = 1`,
      [userId]
    )
    
    const automations = (rows || []).map(row => ({
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps
    }))

    for (const automation of automations) {
      await runAutomationLoop(automation, context, integrations, userId, event)
    }
  }
}

export async function triggerAutomationEvent(event, context, integrations, userId = 'default') {
  console.log(`[Queue] Enqueuing automation event: ${event} for user ${userId}`)
  await enqueueAutomationEvent(event, context, integrations, userId)
}

async function runAutomationLoop(automation, context, integrations, userId, eventType, startFromStepId = null) {
  const steps = Array.isArray(automation.steps) ? automation.steps : []
  const trigger = steps.find((step) => step.type === 'trigger')
  const isIncomingWhatsApp = eventType === 'whatsapp.message_received'
  
  const recipient = normalizeRecipient(resolveRecipient({ recipientMode: 'customer' }, context))
  if (!recipient) return

  let state = await getAutomationConversationState(automation.id, recipient, userId)
  const now = new Date()

  // Handoff Check
  if (state?.handoffUntil && new Date(state.handoffUntil) > now) {
    if (isIncomingWhatsApp) {
      console.log(`[Automation Engine] Handoff active for ${recipient}. Clearing due to new message.`)
      state = await saveAutomationConversationState(automation.id, recipient, state, { handoffUntil: null }, userId)
    } else {
      return
    }
  }

  let currentStepId = startFromStepId
  
  if (!currentStepId) {
    // 1. Check for Trigger Keywords
    if (isIncomingWhatsApp && trigger?.config?.keywords) {
      const keywords = trigger.config.keywords.split(',').map(k => k.trim().toLowerCase())
      const msg = (context.customer_message || '').toLowerCase().trim()
      if (keywords.includes(msg)) {
        currentStepId = getNextStepId(steps, trigger, 'main')
        console.log(`[Automation Engine] Trigger keyword match! Starting flow.`)
      }
    }

    // 2. Check for Interactive Replies (Branching)
    if (!currentStepId && isIncomingWhatsApp && context._isInteractiveReply) {
      const awaitingId = state?.awaitingInteractiveStepId
      if (awaitingId) {
        const awaitingStep = steps.find(s => s.id === awaitingId)
        currentStepId = resolveInteractiveBranch(awaitingStep, context._chosenOptionId, context.customer_message)
        
        if (currentStepId) {
          console.log(`[Automation Engine] Interactive branch resolved: ${currentStepId}`)
          state = await saveAutomationConversationState(automation.id, recipient, state, { awaitingInteractiveStepId: null }, userId)
        }
      }
      
      // Historical/Deep Match Fallback
      if (!currentStepId) {
        for (const s of steps.filter(step => step.type === 'interactive' || (step.type === 'message' && step.connections))) {
          const branchId = resolveInteractiveBranch(s, context._chosenOptionId, context.customer_message)
          if (branchId) {
            currentStepId = branchId
            console.log(`[Automation Engine] Deep branch match found in step ${s.id}`)
            break
          }
        }
      }
    }

    // 3. Global Event Trigger (e.g. order.created)
    if (!currentStepId && trigger && trigger.event === eventType) {
      currentStepId = getNextStepId(steps, trigger, 'main')
    }
  }

  if (!currentStepId) return

  // Execution Loop
  const visited = new Set()
  let messagesSentCount = 0

  while (currentStepId && !visited.has(currentStepId)) {
    visited.add(currentStepId)
    const step = steps.find(s => s.id === currentStepId)
    if (!step) break

    console.log(`[Automation Engine] Executing: ${step.type} (${step.id})`)

    if (step.type === 'condition') {
      const passed = matchesCondition(step.rule, context)
      currentStepId = getNextStepId(steps, step, passed ? 'main' : 'fallback')
      continue
    }

    if (step.type === 'delay') {
      const delayValue = parseFloat(step.delayValue || step.config?.delayValue || '1')
      const delayUnit = step.delayUnit || step.config?.delayUnit || 'minutes'
      
      let delayMs = delayValue * 60 * 1000 // default minutes
      if (delayUnit === 'hours') delayMs = delayValue * 60 * 60 * 1000
      if (delayUnit === 'days') delayMs = delayValue * 24 * 60 * 60 * 1000
      if (delayUnit === 'seconds') delayMs = delayValue * 1000

      const nextStepId = getNextStepId(steps, step, 'main')
      if (nextStepId) {
        console.log(`[Automation Engine] Scheduling DELAY: ${delayValue} ${delayUnit} (${delayMs}ms) for step ${nextStepId}`)
        await enqueueDelayedStep({
          userId,
          automationId: automation.id,
          stepId: nextStepId,
          context,
          timestamp: new Date().toISOString()
        }, delayMs)
      }
      
      // Stop the loop - the delayed worker will pick it up
      break
    }

    if (step.type === 'ai_reply') {
      await handleAIStep(step, context, integrations, automation, userId, recipient)
      currentStepId = getNextStepId(steps, step, 'main')
      continue
    }

    if (step.type === 'http_request') {
      await handleHttpRequestStep(step, context, userId)
      currentStepId = getNextStepId(steps, step, 'main')
      continue
    }

    if (step.type === 'zoho_action') {
      await handleZohoActionStep(step, context, userId)
      currentStepId = getNextStepId(steps, step, 'main')
      continue
    }

    if (step.type === 'message' || step.type === 'interactive') {
      const usesApprovedTemplate = Boolean(step.template || step.templateName || step.config?.template || step.config?.templateName)
      if (!isIncomingWhatsApp && !usesApprovedTemplate) {
        const hasOpenWindow = await hasRecentInboundWhatsAppMessage(userId, recipient, now)
        if (!hasOpenWindow) {
          console.warn(
            `[Automation Engine] Skipping ${step.type} step ${step.id} for ${recipient}: outside the 24-hour WhatsApp customer service window. Use an approved template for re-engagement.`
          )
          break
        }
      }

      // Simulate human-like behavior
      if (isIncomingWhatsApp) {
        const delay = calcTypingDelay(step.message || step.config?.body)
        if (messagesSentCount === 0 && context._inboundWamid) {
          await sendTypingIndicator(integrations.whatsapp.phoneNumberId, integrations.whatsapp.accessToken, recipient, context._inboundWamid)
        }
        await sleep(delay)
      }

      const sentResult = await handleMessageStep(step, context, integrations, recipient)
      messagesSentCount++

      if (sentResult?.success) {
        await logMessage(userId, recipient, step.message || '[Interactive]', sentResult.wamid)
        await incrementMetric(automation.id, 'sent')
        
        // Update State
        const hasBranching = step.connections && Object.keys(step.connections).some(k => k !== 'main')
        const isSupport = (step.message || '').toLowerCase().includes('support') || (step.message || '').toLowerCase().includes('agent')
        
        state = await saveAutomationConversationState(automation.id, recipient, state, {
          state: step.id,
          lastReplyKey: step.id,
          lastReplyAt: new Date(),
          awaitingInteractiveStepId: hasBranching ? step.id : null,
          handoffUntil: isSupport ? new Date(Date.now() + WHATSAPP_SUPPORT_HANDOFF_MS) : state?.handoffUntil
        }, userId)
      }

      currentStepId = getNextStepId(steps, step, 'main')
      continue
    }

    break
  }
}

// --- Specialized Handlers ---

async function handleHttpRequestStep(step, context, userId) {
  const method = step.method || 'POST'
  const url = interpolate(step.url || '', context)
  const headersText = interpolate(step.headers || '{}', context)
  const bodyText = interpolate(step.body || '{}', context)

  console.log(`[Automation Engine] External Request: ${method} ${url}`)

  try {
    let headers = {}
    try { headers = JSON.parse(headersText) } catch (e) { console.error('Failed to parse HTTP headers:', e.message) }

    let body = {}
    try { body = JSON.parse(bodyText) } catch (e) { body = bodyText }

    const startTime = Date.now()
    const response = await httpClient.request({
      method,
      url,
      headers,
      data: body,
    })
    const latency = Date.now() - startTime
    
    // Record success metrics
    metricsService.incrementCounter('http_requests_total', { 
      method: method.toUpperCase(), 
      status: 'success',
      url: url
    })
    metricsService.recordHistogram('http_request_latency_ms', latency, {
      method: method.toUpperCase(),
      url: url
    })

    console.log(`[Automation Engine] HTTP Success: ${response.status}`)
  } catch (err) {
    // Record failure metrics
    metricsService.incrementCounter('http_requests_total', { 
      method: method.toUpperCase(), 
      status: 'error',
      url: url
    })
    
    console.error(`[Automation Engine] HTTP Error (${url}):`, err.response?.data || err.message)
    // We don't break the flow for HTTP errors unless we implement fallback branches for it later
  }
}

async function handleZohoActionStep(step, context, userId) {
  const action = step.action || step.config?.action
  const zoho = await getZohoClient(userId)

  if (!zoho) {
    console.warn(`[Automation Engine] Zoho integration not found for user ${userId}. Skipping action.`)
    return
  }

  try {
    if (action === 'upsert_lead') {
      const payload = buildZohoLeadPayload(step, context)
      await zoho.upsertLead(payload, payload.searchPhone)
    } else if (action === 'update_status') {
      const leadId = interpolate(step.leadId || step.config?.leadId || '{{zoho_lead_id}}', context)
      const status = interpolate(step.status || step.config?.status || 'Contacted', context)
      if (leadId && status) {
        await zoho.updateLeadStatus(leadId, status)
      }
    } else if (action === 'add_note') {
      const targetModule = step.module || step.config?.module || 'Leads'
      const recordId = interpolate(step.recordId || step.config?.recordId || '{{zoho_lead_id}}', context)
      const content = interpolate(step.content || step.config?.content || 'WhatsApp conversation logged.', context)
      const title = interpolate(step.title || step.config?.title || 'WhatsApp Note', context)
      if (recordId && content) {
        await zoho.addNote(targetModule, recordId, content, title)
      }
    }
    console.log(`[Automation Engine] Zoho Action Success: ${action}`)
  } catch (err) {
    console.error(`[Automation Engine] Zoho Action Error (${action}):`, err.message)
  }
}

function interpolateFieldMap(fields = {}, context = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, interpolate(String(value ?? ''), context)])
  )
}

function compactZohoFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
  )
}

function buildZohoLeadPayload(step, context) {
  const fallbackName = 'ourname'
  const customerName = String(context.customer_name || context.customerName || '').trim()
  const messageTime = context.last_inbound_message_at || context.timestamp || new Date()
  const isoMessageTime = new Date(messageTime).toISOString()
  const configuredCreateFields = interpolateFieldMap(step.createFields || step.config?.createFields || {}, context)
  const configuredUpdateFields = interpolateFieldMap(step.updateFields || step.config?.updateFields || {}, context)
  const createFields = compactZohoFields({
    ...configuredCreateFields,
    Last_Name: configuredCreateFields.Last_Name || customerName || fallbackName,
    Company: configuredCreateFields.Company || context.company || context.Company || fallbackName,
    Phone: configuredCreateFields.Phone || context.customer_phone || context.customerPhone || context.from,
    WhatsApp_Number: configuredCreateFields.WhatsApp_Number || context.customer_phone || context.customerPhone || context.from,
    Lead_Source: configuredCreateFields.Lead_Source || context.lead_source || 'WhatsApp',
    Lead_Status: configuredCreateFields.Lead_Status || 'New',
    Bot_Status: configuredCreateFields.Bot_Status || 'Bot Active',
    First_Message_At: configuredCreateFields.First_Message_At || (context.first_message_at ? new Date(context.first_message_at).toISOString() : isoMessageTime),
    Last_Inbound_Message_At: configuredCreateFields.Last_Inbound_Message_At || isoMessageTime,
    Project_Brief_Summary: configuredCreateFields.Project_Brief_Summary || context.project_brief_summary || context.customer_message,
    Chatflow_Contact_ID: configuredCreateFields.Chatflow_Contact_ID || context.chatflow_contact_id || context.customer_phone || context.from,
    Chatflow_Conversation_ID: configuredCreateFields.Chatflow_Conversation_ID || context.chatflow_conversation_id
  })
  const updateFields = compactZohoFields({
    ...configuredUpdateFields,
    Last_Inbound_Message_At: isoMessageTime,
    Human_Handover_Required: context.human_handover_required || context.humanHandoverRequired || '',
    Service_Interest_Primary: context.service_interest_primary || context.serviceInterestPrimary || '',
    Budget_Range: context.budget_range || context.budgetRange || '',
    Timeline: context.timeline || '',
    Project_Brief_Summary: context.project_brief_summary || context.customer_message
  })

  return {
    searchPhone: createFields.Phone || createFields.WhatsApp_Number,
    createFields,
    updateFields
  }
}

async function handleAIStep(step, context, integrations, automation, userId, recipient) {
  try {
    const kbRows = await queryMany('SELECT content FROM knowledge_base WHERE userId = ?', [userId])
    const kbContent = kbRows.map(r => r.content).join('\n\n')
    const businessName = integrations.whatsapp?.name || 'Our Business'
    
    // Context: Last 5 messages
    const history = await queryMany(
      'SELECT message, isCustomer FROM messages WHERE userId = ? AND (phone = ? OR recipient = ?) ORDER BY timestamp DESC LIMIT 5',
      [userId, recipient, recipient]
    )

    const aiResponse = await generateAIResponse(context.customer_message, kbContent, businessName, history.reverse())
    
    // Split into parts for natural flow
    const parts = aiResponse.split(/\n\n+/).filter(p => p.trim())
    for (const part of parts) {
      await sleep(calcTypingDelay(part))
      const result = await sendWhatsAppMessage(integrations.whatsapp.phoneNumberId, integrations.whatsapp.accessToken, recipient, {
        type: 'text',
        text: { body: part }
      })
      await logMessage(userId, recipient, part, result?.messages?.[0]?.id)
    }
  } catch (err) {
    console.error('[Automation Engine] AI Error:', err)
  }
}

async function handleMessageStep(step, context, integrations, recipient) {
  const bodyText = step.message || step.config?.body || ''
  const body = interpolate(bodyText, context)
  let messageData = { type: 'text', text: { body } }

  if (step.type === 'interactive') {
    // Map buttons from step.options (standard in DB) or step.config.buttons (legacy)
    const rawButtons = step.options || step.config?.buttons || []
    const buttons = rawButtons.slice(0, 3).map(b => ({
      type: 'reply',
      reply: { 
        id: b.id || b.reply?.id || 'opt_' + Math.random().toString(36).substr(2, 5), 
        title: (b.label || b.title || b.reply?.title || 'Option').substring(0, 20) 
      }
    }))

    if (buttons.length === 0) {
      console.warn(`[Automation Engine] Interactive step ${step.id} has no buttons. Falling back to text message.`)
    } else {
      messageData = {
        type: 'interactive',
        interactive: {
          type: 'button', // WhatsApp API only supports 'button' for 1-3 buttons
          body: { text: body },
          action: { buttons }
        }
      }
    }
  }

  try {
    const res = await sendWhatsAppMessage(integrations.whatsapp.phoneNumberId, integrations.whatsapp.accessToken, recipient, messageData)
    
    // Check if result has messages (success)
    if (res?.messages?.[0]?.id) {
      return { success: true, wamid: res.messages[0].id }
    }
    
    // Check for API error in result
    if (res?.error) {
      return { success: false, error: res.error.message || 'API Error' }
    }

    return { success: false, error: 'Unknown API error' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// --- Utils ---

function getNextStepId(steps, step, key = 'main') {
  if (step.connections && step.connections[key]) return step.connections[key]
  // Fallback to sequential for messages
  if (key === 'main' && step.type === 'message' && (!step.connections || Object.keys(step.connections).length === 0)) {
    const idx = steps.findIndex(s => s.id === step.id)
    return steps[idx + 1]?.id || null
  }
  return null
}

function resolveInteractiveBranch(step, chosenId, chosenTitle) {
  if (!step?.connections) return null
  if (chosenId && step.connections[chosenId]) return step.connections[chosenId]
  
  const cleanTitle = (chosenTitle || '').trim().toLowerCase()
  for (const [key, target] of Object.entries(step.connections)) {
    if (key.trim().toLowerCase() === cleanTitle) return target
  }
  return null
}

function matchesCondition(rule, context) {
  if (!rule) return true;
  try {
    // Simple expression evaluator for rules like "total_price > 100" or "status == 'paid'"
    const operators = ['>=', '<=', '>', '<', '==', '!='];
    let operator = null;
    let parts = [];

    for (const op of operators) {
      if (rule.includes(op)) {
        operator = op;
        parts = rule.split(op).map(s => s.trim());
        break;
      }
    }

    if (!operator || parts.length !== 2) return true;

    const leftRaw = parts[0];
    const rightRaw = parts[1];

    // Resolve left side (variable or literal)
    const left = leftRaw.startsWith('{{') ? context[leftRaw.replace(/[{}]/g, '').trim()] : context[leftRaw] || leftRaw;
    
    // Resolve right side (literal)
    let right = rightRaw.replace(/['"]/g, '');
    const isNumeric = !isNaN(right) && right !== '';
    
    const leftVal = isNumeric ? parseFloat(left) : String(left);
    const rightVal = isNumeric ? parseFloat(right) : String(right);

    switch (operator) {
      case '>': return leftVal > rightVal;
      case '<': return leftVal < rightVal;
      case '>=': return leftVal >= rightVal;
      case '<=': return leftVal <= rightVal;
      case '==': return leftVal == rightVal;
      case '!=': return leftVal != rightVal;
      default: return true;
    }
  } catch (err) {
    console.error('[Automation Engine] Condition Error:', err.message);
    return true;
  }
}

function normalizeRecipient(phone) {
  return String(phone || '').replace(/\D/g, '')
}

function resolveRecipient(step, context) {
  if (step?.recipientMode === 'fixed_number') return step.recipientNumber
  return context.customerPhone || context.customer_phone || context.phone || context.from
}

async function hasRecentInboundWhatsAppMessage(userId, recipient, now = new Date()) {
  const lastInbound = await queryOne(
    `SELECT timestamp
     FROM messages
     WHERE userId = ? AND isCustomer = 1 AND (phone = ? OR recipient = ?)
     ORDER BY timestamp DESC
     LIMIT 1`,
    [userId, recipient, recipient]
  )

  if (!lastInbound?.timestamp) return false

  const lastInboundAt = new Date(lastInbound.timestamp)
  if (Number.isNaN(lastInboundAt.getTime())) return false

  return now.getTime() - lastInboundAt.getTime() <= WHATSAPP_SUPPORT_HANDOFF_MS
}

function interpolate(text, context) {
  if (!text) return ''
  return text.replace(/\{\{(.*?)\}\}/g, (_, p) => {
    const key = p.trim()
    // Try both camelCase and snake_case versions
    const value = context[key] 
      || context[key.toLowerCase()] 
      || context[key.replace(/_/g, '').toLowerCase()] 
      || context[key.replace(/([A-Z])/g, '_$1').toLowerCase()]
    return value || ''
  })
}

function calcTypingDelay(text = '') {
  return Math.min(200 + (String(text).length * 20), 3000)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  const startTime = Date.now()
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
  const payload = { messaging_product: 'whatsapp', to, ...messageData }
  
  console.log(`[WA Send] POST ${url} → to: ${to}, type: ${messageData.type}`)
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...buildMetaAuthHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const latency = Date.now() - startTime
    const result = await res.json()
    
    if (!res.ok || result.error) {
      console.error(`[WA Send] API ERROR (${res.status}):`, JSON.stringify(result.error || result))
      metricsService.incrementCounter('whatsapp_messages_total', { status: 'error' })
      return result
    }
    
    console.log(`[WA Send] SUCCESS — wamid: ${result.messages?.[0]?.id}, latency: ${latency}ms`)
    metricsService.incrementCounter('whatsapp_messages_total', { status: 'success' })
    metricsService.recordHistogram('whatsapp_message_latency_ms', latency)
    return result
  } catch (err) {
    console.error(`[WA Send] FETCH ERROR:`, err.message)
    metricsService.incrementCounter('whatsapp_messages_total', { status: 'error' })
    throw err
  }
}

async function sendTypingIndicator(phoneNumberId, accessToken, to, wamid) {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
  await fetch(url, {
    method: 'POST',
    headers: { ...buildMetaAuthHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamid })
  })
}

async function getAutomationConversationState(automationId, recipient, userId) {
  const id = `${userId}:${automationId}:${recipient}`
  return queryOne('SELECT * FROM automation_conversation_state WHERE id = ?', [id])
}

async function saveAutomationConversationState(automationId, recipient, currentState, patch, userId) {
  const id = `${userId}:${automationId}:${recipient}`
  const keys = Object.keys(patch)
  const values = Object.values(patch)
  
  if (currentState) {
    const setClause = keys.map(k => `${k} = ?`).join(', ')
    await query(`UPDATE automation_conversation_state SET ${setClause}, updatedAt = NOW() WHERE id = ?`, [...values, id])
  } else {
    const cols = ['id', 'automationId', 'recipient', 'userId', ...keys]
    const placeholders = cols.map(() => '?').join(', ')
    await query(`INSERT INTO automation_conversation_state (${cols.join(', ')}, createdAt, updatedAt) VALUES (${placeholders}, NOW(), NOW())`, [id, automationId, recipient, userId, ...values])
  }
  return { ...currentState, ...patch }
}

async function logMessage(userId, phone, message, wamid) {
  await query(
    'INSERT INTO messages (id, userId, recipient, phone, message, isCustomer, timestamp, whatsappMessageId, status) VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, "sent")',
    [uuidv4(), userId, phone, phone, message, wamid || '']
  )
}

async function incrementMetric(automationId, field) {
  await query(
    `UPDATE automations SET metrics = JSON_SET(COALESCE(metrics, '{}'), '$.${field}', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.${field}')), 0) + 1) WHERE id = ?`,
    [automationId]
  )
}
