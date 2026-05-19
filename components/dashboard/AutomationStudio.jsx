'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { BellRing, CheckCircle2, Clock3, CopyPlus, Copy, Database, HelpCircle, History, MessageSquareText, PackageCheck, PlayCircle, Plus, Settings, Sparkles, Square, Trash2, Truck, Workflow, X, Zap, ZoomIn, ZoomOut, Maximize2, ArrowLeft, Download, Upload, LayoutGrid, MousePointer2, Search, Rocket, Activity, ChevronRight, ArrowRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ToggleLeft, Loader2, Instagram, Users } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { defaultAutomations, sortAutomations } from '@/lib/automation-defaults'
import { buildAutomationTemplateMappings, getAutomationTemplateBodyText, getAutomationTemplateParameterSlots, getAutomationVariableOptions, renderAutomationTemplateBodyPreview } from '@/lib/automation-template'

const TRIGGERS = [
  { value: 'shopify.order_created', label: 'Order Created (Shopify)', icon: PackageCheck, description: 'When an order is placed' },
  { value: 'shopify.fulfillment_created', label: 'Fulfillment Created (Shopify)', icon: Truck, description: 'When tracking is created' },
  { value: 'shopify.order_delivered', label: 'Order Delivered (Shopify)', icon: BellRing, description: 'When delivery is confirmed' },
  { value: 'shopify.cart_created', label: 'Cart Created (Shopify)', icon: PackageCheck, description: 'When a checkout is created' },
  { value: 'shopify.cart_updated', label: 'Cart Updated (Shopify)', icon: PackageCheck, description: 'When a checkout changes' },
  { value: 'shopify.cart_abandoned', label: 'Cart Abandoned (Shopify)', icon: Clock3, description: 'When a checkout becomes abandoned' },
  { value: 'shopify.cart_recovered', label: 'Cart Recovered (Shopify)', icon: CheckCircle2, description: 'When an abandoned checkout is recovered' },
  { value: 'woocommerce.cart_created', label: 'Cart Created (Woo)', icon: PackageCheck, description: 'When a WooCommerce cart is created' },
  { value: 'woocommerce.cart_updated', label: 'Cart Updated (Woo)', icon: PackageCheck, description: 'When a WooCommerce cart is updated' },
  { value: 'woocommerce.cart_abandoned', label: 'Cart Abandoned (Woo)', icon: Clock3, description: 'When a WooCommerce cart becomes abandoned' },
  { value: 'woocommerce.cart_recovered', label: 'Cart Recovered (Woo)', icon: CheckCircle2, description: 'When an abandoned WooCommerce cart is recovered' },
  { value: 'whatsapp.message_received', label: 'Incoming Message (WhatsApp)', icon: MessageSquareText, description: 'When a customer sends a WhatsApp message' },
  { value: 'instagram.message_received', label: 'Incoming DM (Instagram)', icon: MessageSquareText, description: 'When a customer sends an Instagram Direct Message' },
  { value: 'instagram.comment_created', label: 'New Comment (Instagram)', icon: Workflow, description: 'When a user comments on any of your Instagram posts' },
  { value: 'custom.webhook', label: 'Generic Webhook', icon: Workflow, description: 'When a webhook is received from any source' },
  { value: 'custom.order_created', label: 'Generic Order', icon: Workflow, description: 'When a custom order is created' },
  { value: 'custom.payment_received', label: 'Generic Payment', icon: Workflow, description: 'When payment is received' },
  { value: 'zoho.lead_updated', label: 'Lead Updated (Zoho)', icon: Workflow, description: 'When a lead status changes in Zoho CRM' },
  { value: 'custom.event_subscription', label: 'Event Subscribed', icon: Sparkles, description: 'When a user registers for an upcoming event' },
]
const BLOCKS = [
  { type: 'test', tab: 'Triggers', label: 'Test Node', icon: PlayCircle, color: 'pink', description: 'Manual test with latest order or dummy data', defaults: { title: 'Test Flow', event: 'shopify.order_created', testSource: 'latest_order', description: 'Run this flow with latest order data or dummy values' } },
  { type: 'trigger', tab: 'Triggers', label: 'Integration Trigger', icon: BellRing, color: 'violet', description: 'Start from a commerce event', defaults: { title: 'Order Trigger', event: 'shopify.order_created', description: 'When an order is placed' } },
  { type: 'delay', tab: 'Actions', label: 'Delay', icon: Clock3, color: 'blue', description: 'Pause before next action', defaults: { title: 'Wait 2 Hours', delayValue: '2', delayUnit: 'hours', description: 'Fixed time offset' } },
  { type: 'message', tab: 'Actions', label: 'WhatsApp Message', icon: MessageSquareText, color: 'emerald', description: 'Send a WhatsApp reply message', defaults: { title: 'Send Reply', template: '', templateLanguage: '', message: 'Hello {{customer_name}}, thank you for reaching out! ✨', description: 'Auto response message', recipientMode: 'customer', recipientNumber: '', variableMappings: [] } },
  { type: 'instagram_message', tab: 'Actions', label: 'Instagram Message', icon: Instagram, color: 'pink', description: 'Send an Instagram DM reply', defaults: { title: 'Instagram DM', channel: 'instagram', message: 'Hello {{customer_name}}, thank you for reaching out on Instagram! ✨', description: 'Auto response message via Instagram DM', recipientMode: 'customer', recipientNumber: '' } },
  { type: 'condition', tab: 'Actions', label: 'Condition', icon: Workflow, color: 'amber', description: 'Branch logic on a rule', defaults: { title: 'Order > $100', rule: 'total_price > 100', description: 'Conditional branch' } },
  { type: 'interactive', tab: 'Actions', label: 'Interactive Menu', icon: HelpCircle, color: 'fuchsia', description: 'Send a menu with reply options', defaults: { title: 'Auto Reply Menu', message: 'Hello {{customer_name}}, welcome! 👋 We\'re here to provide you with a premium experience. How can we assist you today? Please select an option below:', options: [{ id: 'opt0', label: '📦 Order Status' }, { id: 'opt1', label: '💬 Talk to Specialist' }], description: 'Professional interactive menu' } },
  { type: 'ai_reply', tab: 'Actions', label: 'AI Assistant', icon: Sparkles, color: 'indigo', description: 'Natural AI response using knowledge base', defaults: { title: 'AI Assistant', description: 'AI-powered reply', recipientMode: 'customer' } },
  { type: 'zoho_action', tab: 'Actions', label: 'Zoho CRM', icon: Database, color: 'orange', description: 'Update CRM records or log notes', defaults: { title: 'Update Zoho CRM', action: 'add_note', content: 'Customer interacted with WhatsApp', status: 'Contacted', description: 'Real-time CRM writeback', createFields: { Company: '{{company}}', Last_Name: '{{customer_name}}' } } },
  { type: 'google_sheets_action', tab: 'Actions', label: 'Google Sheets', icon: Database, color: 'green', description: 'Append lead & order data to spreadsheet', defaults: { title: 'Write to Google Sheet', spreadsheetId: '', sheetName: 'Sheet1', description: 'Log profile & checkout info dynamically' } },
  { type: 'http_request', tab: 'Actions', label: 'External API', icon: Workflow, color: 'sky', description: 'Connect to CRMs like Zoho, Salesforce, or custom APIs', defaults: { title: 'Zoho CRM Sync', method: 'POST', url: 'https://www.zohoapis.com/crm/v2/Leads', headers: '{\n  "Authorization": "Zoho-oauthtoken {{zoho_token}}",\n  "Content-Type": "application/json"\n}', body: '{\n  "data": [\n    {\n      "Last_Name": "{{customer_name}}",\n      "Phone": "{{customer_phone}}",\n      "Description": "Lead from WhatsApp Automation"\n    }\n  ]\n}', description: 'Send data to external CRM' } },
]
const COLORS = {
  test: { border: 'border-pink-500/40', bg: 'bg-[#1d0f18]', hdr: 'bg-pink-600/15', icon: 'bg-pink-600/25 text-pink-300', lbl: 'text-pink-300', dot: 'bg-pink-500' },
  trigger: { border: 'border-violet-500/50', bg: 'bg-[#13102a]', hdr: 'bg-violet-600/20', icon: 'bg-violet-600/30 text-violet-300', lbl: 'text-violet-300', dot: 'bg-violet-500' },
  delay: { border: 'border-blue-500/40', bg: 'bg-[#0f1525]', hdr: 'bg-blue-600/15', icon: 'bg-blue-600/25 text-blue-300', lbl: 'text-blue-300', dot: 'bg-blue-500' },
  message: { border: 'border-emerald-500/40', bg: 'bg-[#0f1a16]', hdr: 'bg-emerald-600/15', icon: 'bg-emerald-600/25 text-emerald-300', lbl: 'text-emerald-300', dot: 'bg-emerald-500' },
  condition: { border: 'border-amber-500/40', bg: 'bg-[#1a1508]', hdr: 'bg-amber-600/15', icon: 'bg-amber-600/25 text-amber-300', lbl: 'text-amber-300', dot: 'bg-amber-500' },
  interactive: { border: 'border-fuchsia-500/40', bg: 'bg-[#1a0f18]', hdr: 'bg-fuchsia-600/15', icon: 'bg-fuchsia-600/25 text-fuchsia-300', lbl: 'text-fuchsia-300', dot: 'bg-fuchsia-500' },
  ai_reply: { border: 'border-indigo-500/40', bg: 'bg-[#0f1125]', hdr: 'bg-indigo-600/15', icon: 'bg-indigo-600/25 text-indigo-300', lbl: 'text-indigo-300', dot: 'bg-indigo-500' },
  zoho_action: { border: 'border-orange-500/40', bg: 'bg-[#1d130f]', hdr: 'bg-orange-600/15', icon: 'bg-orange-600/25 text-orange-300', lbl: 'text-orange-300', dot: 'bg-orange-500' },
  google_sheets_action: { border: 'border-green-500/40', bg: 'bg-[#0f1d13]', hdr: 'bg-green-600/15', icon: 'bg-green-600/25 text-green-300', lbl: 'text-green-300', dot: 'bg-green-500' },
  http_request: { border: 'border-sky-500/40', bg: 'bg-[#0f1a25]', hdr: 'bg-sky-600/15', icon: 'bg-sky-600/25 text-sky-300', lbl: 'text-sky-300', dot: 'bg-sky-500' },
}
const uid = p => `${p}-${Math.random().toString(36).slice(2, 9)}`
const isDefault = id => defaultAutomations.some(a => a.id === id)
const DEFAULT_FLOW_IDS_BY_EVENT = {
  'shopify.order_created': 'default-order-confirmation',
  'shopify.fulfillment_created': 'default-tracking-update',
  'shopify.order_delivered': 'default-feedback-flow',
  'shopify.cart_abandoned': 'default-shopify-cart-recovery',
  'whatsapp.message_received': 'default-whatsapp-reply',
  'instagram.message_received': 'default-instagram-reply',
  'instagram.comment_created': 'default-instagram-reply',
  'woocommerce.order_created': 'default-woocommerce-order',
  'woocommerce.order_updated': 'default-woocommerce-order',
  'woocommerce.cart_abandoned': 'default-woocommerce-cart-recovery',
  'custom.webhook': 'default-custom-webhook',
  'custom.order_created': 'default-custom-webhook',
  'custom.payment_received': 'default-custom-webhook',
  'zoho.lead_updated': 'default-zoho-lead-status-notification'
}
const getTrig = ev => TRIGGERS.find(t => t.value === ev) || TRIGGERS[0]
const getBlock = type => BLOCKS.find(b => b.type === type) || BLOCKS[0]

function formatWebhookFieldLabel(path = '') {
  const normalized = String(path || '').replace(/\.(\d+)\./g, ' $1 ').replace(/[._]/g, ' ').trim()
  if (!normalized) return 'Webhook field'
  return normalized.replace(/\b\w/g, char => char.toUpperCase())
}

function flattenWebhookPayload(payload, prefix = '', options = []) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return options

  Object.entries(payload).forEach(([key, value]) => {
    if (String(key).startsWith('_')) return
    const nextPath = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      options.push({ value: `{{${nextPath}}}`, label: `Webhook: ${formatWebhookFieldLabel(nextPath)}`, path: nextPath })
      return
    }

    if (Array.isArray(value)) {
      return
    }

    if (typeof value === 'object') {
      return
    }

    options.push({ value: `{{${nextPath}}}`, label: `Webhook: ${formatWebhookFieldLabel(nextPath)}`, path: nextPath })
  })

  return options
}

function matchesWebhookLogForTrigger(log, triggerEvent = '') {
  if (!log || !triggerEvent) return false

  if (triggerEvent.startsWith('woocommerce.') || triggerEvent.startsWith('custom.')) {
    if (log.type !== 'custom') return false
    if (triggerEvent === 'custom.webhook') return true
    return log.topic === triggerEvent
  }

  if (triggerEvent.startsWith('shopify.')) {
    return log.type === 'shopify'
  }

  if (triggerEvent.startsWith('whatsapp.')) {
    return log.type === 'whatsapp'
  }

  return false
}

function mergeVariableOptions(staticOptions = [], webhookOptions = []) {
  const seen = new Set()
  return [...webhookOptions, ...staticOptions].filter((option) => {
    if (!option?.value || seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

const CUSTOM_WEBHOOK_TARGET_FIELDS = [
  { value: 'customer_name', label: 'Customer name' },
  { value: 'customer_phone', label: 'Customer phone' },
  { value: 'customer_email', label: 'Customer email' },
  { value: 'order_number', label: 'Order number' },
  { value: 'order_total', label: 'Order total' },
  { value: 'currency', label: 'Currency' },
  { value: 'order_status', label: 'Order status' },
  { value: 'order_id', label: 'Order ID' },
  { value: 'order_product_name', label: 'Order product name' },
  { value: 'order_product_names', label: 'Order product names' }
]

function applyDefaultTemplateToMessageStep(step, availableTemplates = [], triggerEvent = '') {
  if (step?.type !== 'message' || !step.template || availableTemplates.length === 0) return step
  const defaultTemplate = availableTemplates.find((template) => template.name === step.template)
  if (!defaultTemplate) return step

  return {
    ...step,
    templateLanguage: step.templateLanguage || defaultTemplate.language || '',
    templateComponents: step.templateComponents?.length ? step.templateComponents : (defaultTemplate.components || []),
    variableMappings: buildAutomationTemplateMappings(defaultTemplate, step.variableMappings || [], triggerEvent)
  }
}
function applyDefaultTemplateToAutomation(automation, availableTemplates = []) {
  if (!automation || availableTemplates.length === 0) return automation
  const triggerEvent = automation?.steps?.find((step) => step.type === 'trigger')?.event || ''
  return normalize({
    ...automation,
    steps: (automation.steps || []).map((step) => applyDefaultTemplateToMessageStep(step, availableTemplates, triggerEvent))
  })
}
function remapTemplateStepsForTrigger(automation, availableTemplates = [], triggerEvent = '') {
  return {
    ...automation,
    steps: (automation.steps || []).map((step) => {
      if (step.type !== 'message' || !step.template) return step
      const template = availableTemplates.find((entry) => entry.name === step.template) || { components: step.templateComponents || [] }
      return {
        ...step,
        variableMappings: buildAutomationTemplateMappings(template, step.variableMappings || [], triggerEvent)
      }
    })
  }
}
function getDefaultTargetIdForAutomation(automation) {
  const triggerEvent = automation?.steps?.find((step) => step.type === 'trigger')?.event
  return triggerEvent ? (DEFAULT_FLOW_IDS_BY_EVENT[triggerEvent] || null) : null
}
function alignDefaultAutomationLayout(automation) {
  if (!automation || !isDefault(automation.id)) return automation
  const layoutMap = new Map(
    (defaultAutomations.find((item) => item.id === automation.id)?.steps || [])
      .filter((step) => step.position)
      .map((step) => [step.id, step.position])
  )

  if (layoutMap.size === 0) return automation

  return {
    ...automation,
    steps: (automation.steps || []).map((step) => (
      layoutMap.has(step.id) && (
        !step.position ||
        typeof step.position.x !== 'number' ||
        typeof step.position.y !== 'number'
      )
        ? { ...step, position: layoutMap.get(step.id) }
        : step
    ))
  }
}

function mapStep(step, i, arr) {
  const dflt = { test: { x: 100, y: 120 }, trigger: { x: 100, y: 180 }, delay: { x: 520, y: 310 }, condition: { x: 940, y: 310 }, message: { x: 1360, y: i % 2 === 0 ? 180 : 430 } }
  const nxt = arr[i + 1]; const ex = step.connections || {}
  return {
    ...step, position: step.position || dflt[step.type] || { x: 100 + i * 380, y: 220 },
    testSource: step.type === 'test' ? (step.testSource || 'latest_order') : step.testSource,
    recipientMode: (step.type === 'message' || step.type === 'ai_reply') ? (step.recipientMode || 'customer') : step.recipientMode,
    recipientNumber: (step.type === 'message' || step.type === 'ai_reply') ? (step.recipientNumber || '') : step.recipientNumber,
    customTriggerMode: step.type === 'trigger' ? (step.customTriggerMode || 'any') : step.customTriggerMode,
    customWatchedColumn: step.type === 'trigger' ? (step.customWatchedColumn || '') : step.customWatchedColumn,
    customExpectedValue: step.type === 'trigger' ? (step.customExpectedValue || '') : step.customExpectedValue,
    customPreviousValue: step.type === 'trigger' ? (step.customPreviousValue || '') : step.customPreviousValue,
    customFieldMappings: step.type === 'trigger' && Array.isArray(step.customFieldMappings)
      ? step.customFieldMappings.map(mapping => ({
        sourceField: mapping?.sourceField || '',
        targetField: mapping?.targetField || ''
      }))
      : [],
    variableMappings: Array.isArray(step.variableMappings) ? step.variableMappings : [],
    options: step.type === 'interactive' ? (Array.isArray(step.options) ? step.options.map((o, idx) => ({ ...o, id: o.id || `opt${idx}` })) : [{ id: 'opt0', label: 'Check Order Status' }, { id: 'opt1', label: 'Talk to Support' }]) : undefined,
    connections: (() => {
      const validate = (tid) => (tid && tid !== 'DISCONNECTED' && arr.some(n => n.id === tid)) ? tid : (tid === 'DISCONNECTED' ? 'DISCONNECTED' : '');
      if (step.type === 'condition' || step.type === 'ai_reply') {
        return { main: validate(ex.main), fallback: validate(ex.fallback) };
      } else if (step.type === 'interactive') {
        return Object.fromEntries((step.options || []).map(o => [o.id, validate(ex[o.id])]));
      } else if (step.type === 'zoho_action') {
        return { main: validate(ex.main) };
      } else {
        return { main: validate(ex.main) };
      }
    })()
  }
}
const normalize = a => {
  const defaultSeed = defaultAutomations.find(item => item.id === a?.id)
  return {
    ...a,
    zohoFieldSummary: a?.zohoFieldSummary || defaultSeed?.zohoFieldSummary,
    metrics: a?.metrics || { sent: 0, openRate: 0, conversions: 0 },
    steps: (Array.isArray(a?.steps) ? a.steps : []).map((s, i, arr) => mapStep(s, i, arr))
  }
}

function cloneFlow(a, name) {
  const n = normalize(a); const m = new Map(n.steps.map(s => [s.id, uid('step')]))
  return {
    ...n, id: uid('automation'), name, metrics: { sent: 0, openRate: 0, conversions: 0 }, status: false,
    steps: n.steps.map(s => ({ ...s, id: m.get(s.id), position: { ...s.position }, connections: Object.fromEntries(Object.entries(s.connections || {}).map(([k, v]) => [k, v ? m.get(v) || '' : ''])) }))
  }
}
function blankFlow(name) {
  const id = uid('step')
  return normalize({
    id: uid('automation'), name, status: false, source: 'Custom', summary: 'Custom automation.',
    steps: [{ id, type: 'trigger', title: 'Shopify Order', event: 'shopify.order_created', description: 'When an order is placed', position: { x: 100, y: 180 }, connections: { main: '' } }]
  })
}
function buildEdges(steps) {
  const m = new Map(steps.map(s => [s.id, s])); const edges = []
  steps.forEach(s => {
    let outs = [{ key: 'main', label: '' }]
    if (s.type === 'condition' || s.type === 'ai_reply') outs = [{ key: 'main', label: s.type === 'ai_reply' ? 'Success' : 'Yes' }, { key: 'fallback', label: s.type === 'ai_reply' ? 'Error' : 'No' }]
    else if (s.type === 'interactive') outs = (s.options || []).map((opt) => ({ key: opt.id, label: '' }))
    outs.forEach(({ key, label }) => { const tid = s.connections?.[key]; if (tid && tid !== 'DISCONNECTED' && m.has(tid)) edges.push({ id: `${s.id}-${key}`, sourceId: s.id, targetId: tid, key, label }) })
  }); return edges
}
function outPt(s, key) {
  const x = s.position.x + 256
  // Condition/AI branch offsets
  if (s.type === 'condition' || s.type === 'ai_reply') {
    if (key === 'main') return { x, y: s.position.y + 42 } // Matches top-[32px] + 10px center
    if (key === 'fallback') return { x, y: s.position.y + 92 } // Matches top-[82px] + 10px center
  }
  // Interactive menu option offsets
  if (s.type === 'interactive') {
    const idx = (s.options || []).findIndex(o => o.id === key)
    if (idx === -1) return { x, y: s.position.y + 132 }
    return { x, y: s.position.y + 132 + (idx * 32) } // Base 120px + 12px center
  }
  // Default output (centered with the input port for straight lines)
  return { x, y: s.position.y + 60 }
}
const inPt = s => ({ x: s.position.x, y: s.position.y + 60 })
function ePath(src, tgt, key) {
  const f = outPt(src, key), t = inPt(tgt), d = Math.max(80, Math.abs(t.x - f.x) * 0.5)
  return `M ${f.x} ${f.y} C ${f.x + d} ${f.y}, ${t.x - d} ${t.y}, ${t.x} ${t.y}`
}
function reorder(a) {
  const steps = Array.isArray(a?.steps) ? a.steps : []; if (steps.length <= 1) return steps
  const m = new Map(steps.map(s => [s.id, s])); const vis = new Set(); const ord = []
  const trig = steps.find(s => s.type === 'trigger') || steps[0]
  function v(id) { if (!id || vis.has(id) || !m.has(id)) return; vis.add(id); const s = m.get(id); ord.push(s); ((s.type === 'condition' || s.type === 'ai_reply') ? [s.connections?.main, s.connections?.fallback] : s.type === 'interactive' ? Object.values(s.connections || {}) : [s.connections?.main]).forEach(v) }
  v(trig.id); steps.forEach(s => v(s.id)); return ord
}
const bounds = steps => ({ width: Math.max(1800, ...steps.map(s => s.position.x + 450)), height: Math.max(1000, ...steps.map(s => s.position.y + 320)) })

const digitsOnly = value => (typeof value === 'string' ? value.replace(/\D/g, '') : '')
function addStepIssue(issueMap, stepId, level, message) {
  if (!stepId) return
  if (!issueMap[stepId]) issueMap[stepId] = { errors: [], warnings: [] }
  issueMap[stepId][level].push(message)
}
function walkReachableSteps(stepMap, startIds = []) {
  const visited = new Set()
  function visit(id) {
    if (!id || visited.has(id) || !stepMap.has(id)) return
    visited.add(id)
    Object.values(stepMap.get(id)?.connections || {}).forEach(visit)
  }
  startIds.forEach(visit)
  return visited
}
function validateAutomationFlow(automation) {
  const steps = Array.isArray(automation?.steps) ? automation.steps : []
  const stepMap = new Map(steps.map(step => [step.id, step]))
  const inboundCount = new Map(steps.map(step => [step.id, 0]))
  const stepIssues = {}
  const errors = []
  const warnings = []
  const triggers = steps.filter(step => step.type === 'trigger')
  const testSteps = steps.filter(step => step.type === 'test')

  function pushIssue(level, stepId, message) {
    const issue = { stepId, stepTitle: stepId ? (stepMap.get(stepId)?.title || '') : '', message }
    if (level === 'errors') errors.push(issue)
    else warnings.push(issue)
    addStepIssue(stepIssues, stepId, level, message)
  }

  steps.forEach(step => {
    Object.values(step.connections || {}).forEach(targetId => {
      if (targetId && inboundCount.has(targetId)) {
        inboundCount.set(targetId, (inboundCount.get(targetId) || 0) + 1)
      }
    })
  })

  if (triggers.length === 0) {
    errors.push({ stepId: null, stepTitle: '', message: 'Add one trigger before publishing this flow.' })
  }
  if (triggers.length > 1) {
    triggers.forEach(step => pushIssue('errors', step.id, 'This flow has multiple triggers. Keep only one trigger per flow.'))
  }
  if (testSteps.length > 1) {
    testSteps.forEach(step => pushIssue('warnings', step.id, 'Multiple test nodes can make flow debugging harder.'))
  }

  const reachableFromTrigger = walkReachableSteps(stepMap, triggers.map(step => step.id))

  steps.forEach(step => {
    if (step.type !== 'trigger' && step.type !== 'test' && inboundCount.get(step.id) === 0) {
      pushIssue('warnings', step.id, 'This node is not connected from any previous step.')
    }
    if (triggers.length > 0 && step.type !== 'trigger' && step.type !== 'test' && !reachableFromTrigger.has(step.id)) {
      pushIssue('warnings', step.id, 'This node is unreachable from the trigger path.')
    }

    if (step.type === 'trigger') {
      if (!step.event) pushIssue('errors', step.id, 'Select a trigger event.')
      if (!step.connections?.main) pushIssue('errors', step.id, 'Connect the trigger to the next step.')
      if (step.event === 'custom.webhook' && !step.selectedTable) {
        pushIssue('warnings', step.id, 'Choose a table source for this custom webhook trigger.')
      }
      if (step.event === 'custom.webhook' && (step.customTriggerMode === 'column_changed' || step.customTriggerMode === 'column_changed_to_value') && !String(step.customWatchedColumn || '').trim()) {
        pushIssue('errors', step.id, 'Choose a watched column for this custom webhook trigger.')
      }
      if (step.event === 'custom.webhook' && step.customTriggerMode === 'column_changed_to_value' && !String(step.customExpectedValue || '').trim()) {
        pushIssue('errors', step.id, 'Set the target value for the watched column.')
      }
    }

    if (step.type === 'test' && !step.connections?.main) {
      pushIssue('warnings', step.id, 'Connect this test node to a step if you want it to execute anything.')
    }

    if (step.type === 'delay') {
      const amount = parseInt(step.delayValue || '', 10)
      if (!Number.isFinite(amount) || amount < 1) {
        pushIssue('errors', step.id, 'Enter a delay amount greater than 0.')
      }
    }

    if (step.type === 'condition') {
      if (!String(step.rule || '').trim()) {
        pushIssue('errors', step.id, 'Write a condition rule.')
      }
      if (!step.connections?.main && !step.connections?.fallback) {
        pushIssue('errors', step.id, 'Connect at least one branch from this condition.')
      } else if (!step.connections?.main || !step.connections?.fallback) {
        pushIssue('warnings', step.id, 'Add both Yes and No branches for a complete condition flow.')
      }
    }

    if (step.type === 'interactive') {
      if (!String(step.message || '').trim()) {
        pushIssue('errors', step.id, 'Add a message body for the menu.')
      }
      if (!step.options || step.options.length === 0) {
        pushIssue('errors', step.id, 'Add at least one option to the menu.')
      }
      const allEmpty = (step.options || []).every((o) => !step.connections?.[o.id])
      if (allEmpty) {
        pushIssue('errors', step.id, 'Connect at least one option to a follow-up step.')
      }
    }

    if (step.type === 'message') {
      const isIg = step.channel === 'instagram'
      if (!step.template && !String(step.message || '').trim()) {
        pushIssue('errors', step.id, isIg ? 'Add a message body.' : 'Add a message body or choose a WhatsApp template.')
      }
      if (step.recipientMode === 'fixed_number' && !digitsOnly(step.recipientNumber)) {
        pushIssue('errors', step.id, isIg ? 'Enter a valid Instagram username or channel.' : 'Enter a valid fixed WhatsApp number.')
      }
    }
  })

  return {
    errors,
    warnings,
    stepIssues,
    firstErrorStepId: errors.find(issue => issue.stepId)?.stepId || null
  }
}

export function AutomationStudio() {
  const outerRef = useRef(null), canvasRef = useRef(null)
  const autoSaveReadyRef = useRef(false)
  const skipNextAutoSaveRef = useRef(false)
  const latestAutomationsRef = useRef(defaultAutomations.map(normalize))
  const [automations, setAutomations] = useState(defaultAutomations.map(normalize))
  const [activeId, setActiveId] = useState(defaultAutomations[0].id)
  const [selId, setSelId] = useState(defaultAutomations[0].steps[0]?.id || null)
  const [draftName, setDraftName] = useState('')
  const [dlgOpen, setDlgOpen] = useState(false)
  const [mode, setMode] = useState('blank')
  const [cloneSourceId, setCloneSourceId] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [templates, setTemplates] = useState([])
  const [tplErr, setTplErr] = useState('')
  const [libTab, setLibTab] = useState('Triggers')
  const [galleryTab, setGalleryTab] = useState('templates')
  const [selectedLibraryBlockType, setSelectedLibraryBlockType] = useState(BLOCKS[0].type)
  const [propTab, setPropTab] = useState('settings')
  const [drag, setDrag] = useState(null)
  const [conn, setConn] = useState(null)
  const [tr, setTr] = useState({ x: 0, y: 0, scale: 1 })
  const [panning, setPanning] = useState(false)
  const [panOrg, setPanOrg] = useState(null)
  const [newId, setNewId] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testingNodeId, setTestingNodeId] = useState(null)
  const [lastTest, setLastTest] = useState(null)
  const [waConfig, setWaConfig] = useState({ woocommerce: { triggers: [] }, custom_tables: { tables: [] } })
  const [webhookLogs, setWebhookLogs] = useState([])
  const [triggerCategory, setTriggerCategory] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [lastSavedAt, setLastSavedAt] = useState(null)

  // Google Sheets studio state hooks
  const [spreadsheets, setSpreadsheets] = useState([])
  const [sheets, setSheets] = useState([])
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false)
  const [loadingSheets, setLoadingSheets] = useState(false)

  const active = useMemo(() => automations.find(a => a.id === activeId) || automations[0], [activeId, automations])
  const sel = active?.steps.find(s => s.id === selId) || active?.steps[0]

  const persist = useCallback(async (list = latestAutomationsRef.current, msg = '', options = {}) => {
    try {
      const payload = sortAutomations(list).map(a => ({ ...a, steps: reorder(a) }))
      if (!options.silent) {
        setSaveState('saving')
      }
      console.log('Saving automations:', payload.map(a => ({ id: a.id, stepsCount: a.steps?.length, hasOptions: a.steps?.some(s => s.type === 'interactive' && s.options) })))
      const r = await fetch('/api/automations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automations: payload }),
        keepalive: options.keepalive === true
      })
      if (!r.ok) throw new Error('Save failed')
      if (!options.silent) {
        setSaveState('saved')
        setLastSavedAt(Date.now())
      }
      if (msg) toast.success(msg)
    } catch {
      if (!options.silent) {
        setSaveState('error')
        toast.error('Failed to save')
      }
    }
  }, [])

  useEffect(() => {
    if (sel?.type === 'google_sheets_action') {
      setLoadingSpreadsheets(true)
      fetch('/api/integrations/google/spreadsheets')
        .then(res => res.json())
        .then(data => {
          if (data.spreadsheets) {
            setSpreadsheets(data.spreadsheets)
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSpreadsheets(false))
    }
  }, [sel?.type, sel?.id])

  useEffect(() => {
    if (sel?.type === 'google_sheets_action' && sel?.spreadsheetId) {
      setLoadingSheets(true)
      fetch(`/api/integrations/google/sheets?spreadsheetId=${sel.spreadsheetId}`)
        .then(res => res.json())
        .then(data => {
          if (data.sheets) {
            setSheets(data.sheets)
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSheets(false))
    }
  }, [sel?.type, sel?.id, sel?.spreadsheetId])

  const [chats, setChats] = useState([])
  const [selectedChatPhone, setSelectedChatPhone] = useState('')
  
  // New UI states for redesign
  const [viewMode, setViewMode] = useState('editor') // 'gallery' or 'editor'
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/api/chats?limit=50').then(r => r.json()).then(d => {
      setChats(Array.isArray(d) ? d : [])
    }).catch(console.error)
  }, [])

  useEffect(() => {
    latestAutomationsRef.current = automations
  }, [automations])

  // Fetch WordPress config for dynamic triggers and tables
  useEffect(() => {
    fetch('/api/wa-config').then(r => r.json()).then(d => {
      if (d && (d.woocommerce || d.custom_tables)) {
        setWaConfig(d)
      }
    }).catch(console.error)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadWebhookLogs = () => {
      fetch('/api/webhook-logs?limit=100')
        .then(r => r.json())
        .then(d => {
          if (!cancelled) {
            setWebhookLogs(Array.isArray(d?.logs) ? d.logs : [])
          }
        })
        .catch(error => {
          if (!cancelled) {
            console.error('Failed to load webhook logs for mapping:', error)
            setWebhookLogs([])
          }
        })
    }

    loadWebhookLogs()
    const interval = setInterval(loadWebhookLogs, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const [activityLogs, setActivityLogs] = useState([])
  const [fetchingLogs, setFetchingLogs] = useState(false)


  useEffect(() => {
    fetch('/api/automations').then(r => r.json()).then(d => {
      console.log('API automations response:', d)
      if (Array.isArray(d) && d.length > 0) { const n = sortAutomations(d.map(item => normalize(alignDefaultAutomationLayout(item)))); setAutomations(n); setActiveId(n[0].id); setSelId(n[0].steps?.[0]?.id || null) }
    }).catch(console.error).finally(() => setHydrated(true))
  }, [])
  useEffect(() => {
    fetch('/api/whatsapp-templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(e => { setTemplates([]); setTplErr(e.message) })
  }, [])
  useEffect(() => {
    if (!templates.length) return
    setAutomations(current => sortAutomations(current.map(automation => applyDefaultTemplateToAutomation(automation, templates))))
  }, [templates])
  useEffect(() => {
    if (!hydrated) return
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true
      setSaveState('saved')
      setLastSavedAt(Date.now())
      return
    }
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }
    setSaveState('dirty')
    const t = setTimeout(() => persist(), 600)
    return () => clearTimeout(t)
  }, [automations, hydrated])

  // Auto-set trigger category based on current event

  useEffect(() => {
    function flushPendingAutomations() {
      if (!hydrated || !autoSaveReadyRef.current) return
      if (skipNextAutoSaveRef.current) return
      if (saveState === 'saved') return
      persist(latestAutomationsRef.current, '', { keepalive: true, silent: true })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushPendingAutomations()
      }
    }

    window.addEventListener('pagehide', flushPendingAutomations)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushPendingAutomations)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hydrated, persist, saveState])

  const handleExport = useCallback(() => {
    if (!active) return
    const data = JSON.stringify(active, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${active.name.toLowerCase().replace(/\s+/g, '-')}-export.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Flow exported successfully')
  }, [active])

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result)
        if (!imported.steps || !Array.isArray(imported.steps)) throw new Error('Invalid flow format')
        
        const newFlow = {
          ...normalize(imported),
          id: uid('automation'),
          name: `${imported.name} (Imported)`,
          status: false,
          metrics: { sent: 0, openRate: 0, conversions: 0 }
        }
        
        setAutomations(prev => sortAutomations([...prev, newFlow]))
        setActiveId(newFlow.id)
        setSelId(newFlow.steps[0]?.id || null)
        setViewMode('editor')
        toast.success('Flow imported successfully')
      } catch (err) {
        toast.error('Failed to import: ' + err.message)
      }
      e.target.value = '' 
    }
    reader.readAsText(file)
  }, [normalize, sortAutomations])
  const activeDef = !!active && isDefault(active.id) && active.source !== 'Custom'
  const activeDefaultTargetId = getDefaultTargetIdForAutomation(active)
  const selLocked = false
  const msgLocked = false
  const tplNames = templates.map(t => t.name)
  const tplExists = sel?.template ? tplNames.includes(sel.template) : false
  const selTpl = templates.find(t => t.name === sel?.template)
  const edges = buildEdges(active?.steps || [])
  const bnd = bounds(active?.steps || [])
  const activeCount = automations.filter(a => a.status).length
  const activeValidation = useMemo(() => validateAutomationFlow(active), [active])
  const selectedStepIssues = sel ? activeValidation.stepIssues[sel.id] : null
  const activeTriggerEvent = active?.steps.find(step => step.type === 'trigger')?.event || ''
  const latestMatchingWebhookLog = useMemo(() => {
    if (!activeTriggerEvent) return null
    if (!(activeTriggerEvent.startsWith('woocommerce.') || activeTriggerEvent.startsWith('custom.'))) return null
    return webhookLogs.find(log => matchesWebhookLogForTrigger(log, activeTriggerEvent))
      || (activeTriggerEvent.startsWith('woocommerce.') || activeTriggerEvent.startsWith('custom.')
        ? webhookLogs.find(log => log.type === 'custom')
        : null)
  }, [activeTriggerEvent, webhookLogs])
  const activeWebhookVariableOptions = useMemo(() => (
    flattenWebhookPayload(latestMatchingWebhookLog?.payload || {})
  ), [latestMatchingWebhookLog])
  const activeWebhookFieldOptions = useMemo(() => (
    activeWebhookVariableOptions
      .map(option => ({ value: option.path || '', label: option.label }))
      .filter(option => option.value)
  ), [activeWebhookVariableOptions])
  const activeVariableOptions = useMemo(() => (
    mergeVariableOptions(getAutomationVariableOptions(activeTriggerEvent), activeWebhookVariableOptions)
  ), [activeTriggerEvent, activeWebhookVariableOptions])
  const selectedTemplateSlots = selTpl
    ? getAutomationTemplateParameterSlots(selTpl)
    : getAutomationTemplateParameterSlots({ components: sel?.templateComponents || [] })
  const isInstagramFlow = activeTriggerEvent?.startsWith('instagram.') || active?.steps?.some(s => s.channel === 'instagram')
  const defaultRecipientLabel = (activeTriggerEvent === 'whatsapp.message_received' || activeTriggerEvent?.startsWith('instagram.')) ? 'Message sender' : 'Order customer'
  const defaultRecipientDescription = activeTriggerEvent === 'whatsapp.message_received'
    ? 'Send the reply back to the customer who sent the WhatsApp message.'
    : activeTriggerEvent?.startsWith('instagram.')
    ? 'Send the reply back to the user who sent the Instagram message or comment.'
    : 'Send the message to the customer tied to the order event.'
  const activeTestNode = useMemo(() => {
    if (!active) return null
    return active.steps.find(step => step.id === selId && step.type === 'test') || active.steps.find(step => step.type === 'test') || null
  }, [active, selId])
  const cloneableAutomations = useMemo(() => {
    const seen = new Set()
    const combined = [
      ...automations,
      ...defaultAutomations.filter(flow => !automations.some(existing => existing.id === flow.id))
    ]

    return combined
      .filter(flow => {
        if (!flow?.id || seen.has(flow.id)) return false
        seen.add(flow.id)
        return true
      })
      .map(flow => ({
        id: flow.id,
        name: flow.name,
        source: flow.source || 'Custom',
        status: flow.status,
        isDefault: isDefault(flow.id)
      }))
  }, [automations])
  const createdCloneableAutomations = useMemo(() => (
    cloneableAutomations.filter(flow => !flow.isDefault)
  ), [cloneableAutomations])
  const cloneSourceOptions = useMemo(() => (
    [
      ...createdCloneableAutomations,
      ...cloneableAutomations.filter(flow => flow.isDefault)
    ]
  ), [cloneableAutomations, createdCloneableAutomations])
  const defaultCloneableAutomations = useMemo(() => (
    cloneableAutomations.filter(flow => flow.isDefault)
  ), [cloneableAutomations])

  // Fetch automation logs when tab changes or active automation changes
  useEffect(() => {
    if (propTab === 'logs' && active?.id) {
      setFetchingLogs(true)
      fetch(`/api/automations/logs?automationId=${active.id}`)
        .then(r => r.json())
        .then(d => setActivityLogs(Array.isArray(d) ? d : []))
        .catch(console.error)
        .finally(() => setFetchingLogs(false))
    }
  }, [propTab, active?.id])

  // Auto-set trigger category based on current event
  useEffect(() => {
    if (sel?.type === 'trigger' && sel?.event) {
      if (sel.event.startsWith('shopify.')) setTriggerCategory('shopify')
      else if (sel.event.startsWith('woocommerce.')) setTriggerCategory('woocommerce')
      else if (sel.event.startsWith('whatsapp.')) setTriggerCategory('whatsapp')
      else if (sel.event.startsWith('instagram.')) setTriggerCategory('instagram')
      else if (sel.event.startsWith('zoho.')) setTriggerCategory('zoho')
      else if (sel.event.startsWith('custom.')) setTriggerCategory('custom')
    }
  }, [sel?.event, sel?.type])
  useEffect(() => {
    if (!cloneSourceOptions.length) {
      setCloneSourceId('')
      return
    }
    if (!cloneSourceId || !cloneSourceOptions.some(flow => flow.id === cloneSourceId)) {
      const preferredActiveId = cloneSourceOptions.some(flow => flow.id === active?.id) ? active?.id : ''
      setCloneSourceId(preferredActiveId || cloneSourceOptions[0]?.id || '')
    }
  }, [active?.id, cloneSourceId, cloneSourceOptions])

  // Merge static triggers with dynamic WooCommerce and Shopify triggers from config
  const dynamicTriggers = useMemo(() => {
    const woocommerceTriggers = (waConfig?.woocommerce?.triggers || []).map(t => ({
      value: t.value || t.event || `woocommerce.${t.name}`,
      label: t.label || t.name?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      icon: Zap,
      description: t.description || `WooCommerce: ${t.name}`
    }))

    // Get Shopify triggers from config (only if connected)
    const shopifyTriggers = (waConfig?.shopify?.connected ? (waConfig.shopify.triggers || []) : []).map(t => ({
      value: t.value,
      label: t.label,
      icon: PackageCheck,
      description: t.description || `Shopify: ${t.label}`
    }))

    // Deduplicate by value
    const existing = new Set(TRIGGERS.map(t => t.value))
    const newWooTriggers = woocommerceTriggers.filter(t => !existing.has(t.value))
    const newShopifyTriggers = shopifyTriggers.filter(t => !existing.has(t.value))

    return [...TRIGGERS, ...newWooTriggers, ...newShopifyTriggers]
  }, [waConfig])

  const libBlocks = useMemo(() => {
    return BLOCKS.filter(b => b.tab === libTab)
  }, [libTab])
  const selectedLibraryBlock = libBlocks.find(block => block.type === selectedLibraryBlockType) || libBlocks[0] || BLOCKS[0]

  useEffect(() => { if (active && !active.steps.some(s => s.id === selId)) setSelId(active.steps[0]?.id || null) }, [active, selId])
  useEffect(() => { if (sel?.type === 'message') setPropTab('settings') }, [sel?.id, sel?.type])
  useEffect(() => {
    if (!libBlocks.some(block => block.type === selectedLibraryBlockType)) {
      setSelectedLibraryBlockType(libBlocks[0]?.type || BLOCKS[0].type)
    }
  }, [libBlocks, selectedLibraryBlockType])

  const updAuto = (id, fn) => setAutomations(cur => {
    const next = sortAutomations(cur.map(a => a.id === id ? normalize(fn(a)) : a))
    const updated = next.find(a => a.id === id)
    if (updated) {
      console.log('[Studio] Updated automation:', id, 'steps:', updated.steps.map(s => ({ id: s.id, type: s.type, connections: s.connections })))
    }
    return next
  })
  function disconnectEdge(sourceId, key) {
    if (!active) return
    console.log('[Studio] Disconnecting:', sourceId, 'key:', key)
    updAuto(active.id, a => ({
      ...a,
      steps: a.steps.map(s => s.id === sourceId ? { ...s, connections: { ...s.connections, [key]: 'DISCONNECTED' } } : s)
    }))
    toast.success('Connection removed')
  }
  function updStep(patch) {
    if (!active || !sel || selLocked) return
    updAuto(active.id, a => ({
      ...a, steps: a.steps.map(s => {
        if (s.id !== sel.id) return s
        return { ...s, ...patch }
      })
    }))
  }
  function addNode(blockType, pt) {
    if (!active) return
    const bl = BLOCKS.find(b => b.type === blockType); if (!bl) return
    const connectHint = sel?.type === 'condition'
      ? (!sel?.connections?.main ? 'main' : (!sel?.connections?.fallback ? 'fallback' : null))
      : (!sel?.connections?.main ? 'main' : null)
    const fallbackPosition = sel?.position
      ? { x: sel.position.x + 340, y: sel.position.y + (connectHint === 'fallback' ? 140 : 0) }
      : { x: Math.round(200 + Math.random() * 300), y: Math.round(200 + Math.random() * 200) }
    const baseStep = { 
      id: uid('step'), 
      type: bl.type === 'instagram_message' ? 'message' : bl.type, 
      ...Object.fromEntries(
        Object.entries(bl.defaults || {}).map(([k, v]) => [
          k, 
          Array.isArray(v) ? v.map(item => typeof item === 'object' ? { ...item } : item) : v
        ])
      ),
      position: pt || fallbackPosition 
    }
    const ns = applyDefaultTemplateToMessageStep(baseStep, templates, activeTriggerEvent)
    const nxt = normalize({ ...active, steps: [...active.steps, ns] }).steps.at(-1)
    updAuto(active.id, a => {
      const nextSteps = [...a.steps, nxt].map(step => {
        if (!pt && blockType !== 'trigger' && step.id === sel?.id) {
          const nextKey = step.type === 'condition'
            ? (!step.connections?.main ? 'main' : (!step.connections?.fallback ? 'fallback' : null))
            : (!step.connections?.main ? 'main' : null)
          return nextKey ? { ...step, connections: { ...step.connections, [nextKey]: nxt.id } } : step
        }
        return step
      })
      return { ...a, steps: nextSteps }
    })
    setSelId(nxt.id); setNewId(nxt.id); setTimeout(() => setNewId(null), 500)
  }
  function delNode(id) {
    if (!active) return;
    if (active.steps.length <= 1) {
      toast.error('Cannot delete the last node in a flow');
      return;
    }
    const step = active.steps.find(s => s.id === id);
    if (step?.type === 'trigger') {
      toast.error('The trigger node cannot be deleted');
      return;
    }
    
    updAuto(active.id, a => ({ 
      ...a, 
      steps: a.steps.filter(s => s.id !== id).map(s => ({ 
        ...s, 
        connections: Object.fromEntries(Object.entries(s.connections || {}).map(([k, v]) => [k, v === id ? '' : v])) 
      })) 
    }));
    toast.success('Node removed');
  }
  function promoteActiveFlowToDefault() {
    if (!active || activeDef) return
    if (!activeDefaultTargetId) {
      toast.error('This flow does not have a supported default trigger')
      return
    }

    const existingDefault = automations.find(item => item.id === activeDefaultTargetId)
    const promotedFlow = normalize({
      ...(existingDefault || {}),
      ...active,
      id: activeDefaultTargetId
    })

    const nextAutomations = automations
      .filter(item => item.id !== active.id && item.id !== activeDefaultTargetId)
      .concat(promotedFlow)

    skipNextAutoSaveRef.current = true
    setAutomations(sortAutomations(nextAutomations))
    setActiveId(promotedFlow.id)
    setSelId(promotedFlow.steps[0]?.id || null)
    persist(nextAutomations, 'Flow set as default')
  }
  function resetActiveFlowToDefault() {
    if (!active) return

    const targetDefaultId = activeDef ? active.id : activeDefaultTargetId
    if (!targetDefaultId) {
      const resetFlow = {
        ...blankFlow(active.name),
        id: active.id,
        status: active.status,
        source: active.source || 'Custom'
      }
      const nextAutomations = automations.map(item => item.id === active.id ? resetFlow : item)
      skipNextAutoSaveRef.current = true
      setAutomations(sortAutomations(nextAutomations))
      setSelId(resetFlow.steps[0]?.id || null)
      persist(nextAutomations, 'Draft reset')
      return
    }

    const defaultSeed = defaultAutomations.find(item => item.id === targetDefaultId)
    if (!defaultSeed) {
      toast.error('Default flow definition not found')
      return
    }

    const resetFlow = normalize({
      ...defaultSeed,
      id: active.id,
      name: activeDef ? defaultSeed.name : active.name,
      status: active.status,
      source: activeDef ? defaultSeed.source : (active.source || defaultSeed.source || 'Custom'),
      summary: defaultSeed.summary
    })

    const nextAutomations = automations.map(item => item.id === active.id ? resetFlow : item)
    skipNextAutoSaveRef.current = true
    setAutomations(sortAutomations(nextAutomations))
    setSelId(resetFlow.steps[0]?.id || null)
    persist(nextAutomations, activeDef ? 'Flow reset to default' : 'Default structure applied')
  }
  function handleCreate() {
    const name = draftName.trim() || (mode === 'template' ? 'Flow Clone' : 'New Automation')
    const templateSource = cloneSourceOptions.find(flow => flow.id === cloneSourceId)
    if (mode === 'template' && !templateSource) {
      toast.error('Choose a flow to clone first')
      return
    }
    const sourceAutomation = mode === 'template'
      ? (automations.find(flow => flow.id === cloneSourceId) || defaultAutomations.find(flow => flow.id === cloneSourceId))
      : null
    const nxt = mode === 'template' && sourceAutomation ? cloneFlow(sourceAutomation, name) : blankFlow(name)
    setAutomations(cur => sortAutomations([nxt, ...cur])); setActiveId(nxt.id); setSelId(nxt.steps[0]?.id || null)
    setDraftName(''); setMode('blank'); setCloneSourceId(active?.id || ''); setDlgOpen(false); toast.success(`"${name}" created`)
  }
  function setStatus(id, s, msg = '') {
    const n = sortAutomations(automations.map(a => a.id === id ? { ...a, status: s } : a))
    skipNextAutoSaveRef.current = true
    setAutomations(n)
    persist(n, msg)
  }
  function handleToggleFlowStatus(id) {
    const flow = automations.find(a => a.id === id)
    if (!flow) return
    
    if (flow.status) {
      setStatus(id, false, 'Stopped')
      return
    }
    
    // Validate before publishing
    const validation = validateAutomationFlow(flow)
    if (validation.errors.length > 0) {
      setActiveId(id)
      if (validation.firstErrorStepId) setSelId(validation.firstErrorStepId)
      setPropTab('logs')
      toast.error(`Fix ${validation.errors.length} issue${validation.errors.length === 1 ? '' : 's'} before publishing`)
      return
    }
    setStatus(id, true, validation.warnings.length > 0 ? 'Published with warnings' : 'Live!')
  }

  function handleTogglePublish() {
    if (!active) return
    handleToggleFlowStatus(active.id)
  }
  async function runFlowTest(nodeId = activeTestNode?.id) {
    if (!active?.id) return
    if (!nodeId) {
      toast.error('Add a Test Node to this flow first')
      return
    }

    const step = active.steps.find(s => s.id === nodeId)

    try {
      setTesting(true)
      setTestingNodeId(nodeId)

      const payload = { automationId: active.id, nodeId }
      if (step?.testSource === 'history') {
        if (!selectedChatPhone) {
          toast.error('Please select a chat from history')
          setTesting(false)
          setTestingNodeId(null)
          return
        }
        payload.phone = selectedChatPhone
      }

      const response = await fetch('/api/automations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Test failed')
      setLastTest({ ...data, automationId: active.id, nodeId })
      setPropTab('logs')
      const sentCount = Array.isArray(data.results) ? data.results.filter(item => item.status === 'sent').length : 0
      const firstSent = Array.isArray(data.results) ? data.results.find(item => item.status === 'sent') : null
      toast.success(
        firstSent?.recipient
          ? `Test sent to ${firstSent.recipient}`
          : (sentCount > 0 ? `Test sent ${sentCount} message${sentCount === 1 ? '' : 's'}` : 'Test run finished')
      )
    } catch (error) {
      console.error('Automation test failed:', error)
      toast.error(error.message || 'Failed to run test')
    } finally {
      setTesting(false)
      setTestingNodeId(null)
    }
  }
  function clientToCv(cx, cy) {
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return { x: 100, y: 100 }
    return { x: Math.max(20, (cx - r.left) / tr.scale), y: Math.max(20, (cy - r.top) / tr.scale) }
  }
  function startDrag(e, id) {
    if (!active) return
    const s = active.steps.find(s => s.id === id); if (!s) return
    e.preventDefault(); const pt = clientToCv(e.clientX, e.clientY)
    setDrag({ id, ox: pt.x - s.position.x, oy: pt.y - s.position.y }); setSelId(id)
  }
  function startConn(e, srcId, key = 'main') {
    if (!active) return
    e.stopPropagation(); e.preventDefault()
    const pt = clientToCv(e.clientX, e.clientY); setConn({ srcId, key, cx: pt.x, cy: pt.y })
  }
  function finishConn(tgtId) {
    if (!active || !conn) return
    if (conn.srcId === tgtId) { setConn(null); return }
    updAuto(active.id, a => ({ ...a, steps: reorder({ ...a, steps: a.steps.map(s => s.id === conn.srcId ? { ...s, connections: { ...s.connections, [conn.key]: tgtId } } : s) }) }))
    setConn(null)
  }
  function deleteFlow(id) {
    if (isDefault(id) || automations.length <= 1) return
    const next = automations.filter(a => a.id !== id)
    skipNextAutoSaveRef.current = true
    setAutomations(sortAutomations(next))
    if (activeId === id) { setActiveId(next[0].id); setSelId(next[0].steps[0]?.id || null) }
    persist(next, 'Flow deleted')
  }
  function startPan(e) {
    // Pan on left-click on canvas background, or middle mouse anywhere
    if (e.button === 1) { e.preventDefault(); setPanning(true); setPanOrg({ x: e.clientX - tr.x, y: e.clientY - tr.y }); return }
    if (e.button !== 0) return
    // Don't pan if clicking on a node, button, or connection port
    if (e.target.closest('[data-node]') || e.target.closest('button') || e.target.closest('[role="button"]')) return
    e.preventDefault()
    setPanning(true); setPanOrg({ x: e.clientX - tr.x, y: e.clientY - tr.y })
  }
  function handleWheel(e) {
    e.preventDefault()
    const r = outerRef.current?.getBoundingClientRect(); if (!r) return
    const d = e.deltaY > 0 ? 0.9 : 1.1, ns = Math.max(0.25, Math.min(2.5, tr.scale * d))
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    setTr(t => ({ scale: ns, x: cx - (cx - t.x) * (ns / t.scale), y: cy - (cy - t.y) * (ns / t.scale) }))
  }
  useEffect(() => {
    function mv(e) {
      if (drag && active) {
        const pt = clientToCv(e.clientX, e.clientY)
        const SNAP = 20
        const nx = Math.round((pt.x - drag.ox) / SNAP) * SNAP
        const ny = Math.round((pt.y - drag.oy) / SNAP) * SNAP
        updAuto(active.id, a => ({ ...a, steps: a.steps.map(s => s.id === drag.id ? { ...s, position: { x: Math.max(20, nx), y: Math.max(20, ny) } } : s) }))
      }
      if (conn) { const pt = clientToCv(e.clientX, e.clientY); setConn(c => c ? { ...c, cx: pt.x, cy: pt.y } : null) }
      if (panning && panOrg) setTr(t => ({ ...t, x: e.clientX - panOrg.x, y: e.clientY - panOrg.y }))
    }
    function up() { if (drag) setDrag(null); if (conn) setConn(null); if (panning) { setPanning(false); setPanOrg(null) } }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [active, drag, conn, panning, panOrg, tr])
  useEffect(() => {
    const el = outerRef.current; if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [tr])

  const inputCls = 'bg-white/[0.04] border-white/10 text-white placeholder:text-white/20 rounded-xl text-xs h-8 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20'
  const textCls = 'bg-white/[0.04] border-white/10 text-white rounded-xl text-xs focus:border-violet-500/50 resize-none'
  const activeLastTest = lastTest?.automationId === active?.id ? lastTest : null
  const saveLabel = saveState === 'saving'
    ? 'Saving...'
    : saveState === 'dirty'
      ? 'Saving soon'
      : saveState === 'error'
        ? 'Retry save'
        : 'Saved'
  const saveDescription = saveState === 'saved' && lastSavedAt
    ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : (saveState === 'error' ? 'Autosave failed. Retry from the top bar.' : 'Changes save automatically.')

  const filteredAutomations = useMemo(() => {
    if (!searchQuery) return automations
    const q = searchQuery.toLowerCase()
    return automations.filter(a => a.name.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q) || a.source?.toLowerCase().includes(q))
  }, [automations, searchQuery])

  const automationsBySource = useMemo(() => {
    const groups = {}
    filteredAutomations.forEach(a => {
      const src = a.source || 'Custom'
      if (!groups[src]) groups[src] = []
      groups[src].push(a)
    })
    return groups
  }, [filteredAutomations])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b0d14] text-white overflow-hidden" role="application" aria-label="Flow Studio — Automation Canvas" style={{ fontFamily: 'Inter,system-ui,sans-serif' }}>
      <style>{`
        @keyframes nodeIn{from{opacity:0;transform:scale(0.82) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes edgeIn{from{stroke-dashoffset:500}to{stroke-dashoffset:0}}
        @keyframes spinPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.9)}}
        .node-in{animation:nodeIn .35s cubic-bezier(.34,1.56,.64,1) forwards}
        .edge-path{stroke-dasharray:500;animation:edgeIn .5s ease forwards}
        .dot-pulse{animation:spinPulse 1.4s ease infinite}
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
      <Toaster theme="dark" richColors position="top-right" />

      {/* NAV */}
      {/* NAV */}
      <header role="banner" className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06] bg-[#0b0d14]/95 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`h-9 w-9 rounded-xl transition-all ${sidebarOpen ? 'text-violet-400 bg-violet-500/10' : 'text-white/30 hover:bg-white/5'}`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </Button>

          <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-white/30 hover:text-white hover:bg-white/5 mr-1">
            <Link href="/dashboard" title="Back to Dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20" aria-hidden="true"><Workflow className="h-4 w-4 text-white" /></div>
            <span className="font-bold text-base tracking-tight hidden sm:inline-block">Flow Studio</span>
          </div>
          
          <div className="h-6 w-px bg-white/10 mx-2" />
          
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${viewMode === 'gallery' ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white/70'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Gallery
            </button>
            <button 
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${viewMode === 'editor' ? 'bg-white/10 text-white shadow-sm' : 'text-white/30 hover:text-white/70'}`}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              Canvas
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'editor' && active && (
            <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10 hidden lg:flex">
               <div className={`h-2 w-2 rounded-full ${active?.status ? 'bg-emerald-500 dot-pulse' : 'bg-white/20'}`} />
               <span className="text-xs font-bold truncate max-w-[150px]">{active?.name}</span>
               <span className="text-[10px] text-white/30 uppercase tracking-widest">{active?.status ? 'Live' : 'Draft'}</span>
            </div>
          )}


            <div className="hidden sm:flex items-center gap-1">
              <input
                type="file"
                id="flow-import-input"
                className="hidden"
                accept=".json"
                onChange={handleImport}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => document.getElementById('flow-import-input').click()}
                title="Import Flow"
                className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/8 rounded-xl"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleExport}
                disabled={!active}
                title="Export Current Flow"
                className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/8 rounded-xl disabled:opacity-20"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />
            
            <Button
              size="sm"
              aria-label={saveState === 'error' ? 'Retry saving changes' : 'Autosave status'}
              onClick={saveState === 'error' ? () => persist(automations, 'Draft saved') : undefined}
              disabled={saveState !== 'error'}
              className={`h-8 px-3 rounded-xl text-xs font-semibold border transition-all ${saveState === 'error'
                ? 'bg-rose-500/12 hover:bg-rose-500/18 text-rose-200 border-rose-500/25'
                : 'bg-white/5 text-white/60 border-white/8 cursor-default'}`}
            >
              {saveState === 'saving' && <span className="mr-2 h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />}
              {saveLabel}
            </Button>

            {viewMode === 'editor' && (
              <>
                <Button size="sm" aria-label="Run flow test" onClick={() => runFlowTest()} disabled={!activeTestNode || testing}
                  className="h-8 px-4 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white/80 text-xs font-semibold border border-white/8 disabled:opacity-40">
                  <PlayCircle className="mr-2 h-3.5 w-3.5" />{testing ? 'Testing...' : 'Run Test'}
                </Button>
                <Button size="sm" aria-label={active?.status ? 'Stop automation' : 'Publish automation'} disabled={!active}
                  onClick={handleTogglePublish}
                  className={`h-8 px-4 rounded-xl text-xs font-bold transition-all shadow-lg ${active?.status ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/20' : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-900/20'}`}>
                  {active?.status ? <><Square className="mr-2 h-3.5 w-3.5" />Stop</> : <><Rocket className="mr-2 h-3.5 w-3.5" />Go Live</>}
                </Button>

                <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  className={`h-9 w-9 rounded-xl transition-all ${rightSidebarOpen ? 'text-violet-400 bg-violet-500/10' : 'text-white/30 hover:bg-white/5'}`}
                >
                  {rightSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                </Button>
              </>
            )}

            {viewMode === 'gallery' && (
              <Button 
                onClick={() => setDlgOpen(true)}
                className="h-8 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-lg shadow-violet-900/20"
              >
                <Plus className="mr-2 h-4 w-4" /> New Automation
              </Button>
            )}
          </div>
        </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 min-h-0 relative">

        {/* GALLERY VIEW */}
        {viewMode === 'gallery' && (
          <div className="flex-1 bg-[#080a12] overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto p-8 space-y-10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight">Automations</h1>
                  <p className="text-white/40 mt-2 text-sm">Manage your customer journeys and automated workflows.</p>
                </div>
                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input 
                      type="text"
                      placeholder="Search your flows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50 outline-none w-64 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* TABS SELECTOR */}
              <div className="flex border-b border-white/10 mt-8 mb-6">
                <button
                  onClick={() => setGalleryTab('templates')}
                  className={`px-6 py-3 text-sm font-bold tracking-wide transition-all border-b-2 ${galleryTab === 'templates' ? 'border-violet-500 text-violet-400' : 'border-transparent text-white/50 hover:text-white hover:border-white/20'}`}
                >
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Pre-built Templates</div>
                </button>
                <button
                  onClick={() => setGalleryTab('custom')}
                  className={`px-6 py-3 text-sm font-bold tracking-wide transition-all border-b-2 ${galleryTab === 'custom' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-white/50 hover:text-white hover:border-white/20'}`}
                >
                  <div className="flex items-center gap-2"><Workflow className="w-4 h-4" /> My Custom Flows</div>
                </button>
              </div>

              {/* TEMPLATES VIEW */}
              {galleryTab === 'templates' && (
                <div className="space-y-12">
                  {Object.entries(
                    defaultAutomations.reduce((acc, template) => {
                      const src = template.source || 'General';
                      if (!acc[src]) acc[src] = [];
                      acc[src].push(template);
                      return acc;
                    }, {})
                  ).map(([category, categoryTemplates]) => (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center gap-3 border-b border-white/[0.04] pb-2">
                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 ${
                          category === 'Shopify' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                          category === 'Google Sheets' ? 'text-green-400 border-green-500/20 bg-green-500/10' :
                          category === 'Zoho' ? 'text-orange-400 border-orange-500/20 bg-orange-500/10' :
                          category === 'WhatsApp' ? 'text-teal-400 border-teal-500/20 bg-teal-500/10' :
                          'text-violet-400 border-violet-500/20 bg-violet-500/10'
                        }`}>
                          {category} Integrations
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categoryTemplates.map(template => (
                          <div 
                            key={template.id}
                            className={`group p-6 rounded-3xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer relative overflow-hidden`}
                            onClick={() => {
                              setCloneSourceId(template.id)
                              setMode('template')
                              setDraftName(`My ${template.name}`)
                              setDlgOpen(true)
                            }}
                          >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              {category === 'Shopify' ? <PackageCheck className="w-24 h-24" /> :
                               category === 'Google Sheets' ? <Database className="w-24 h-24" /> :
                               category === 'Zoho' ? <Users className="w-24 h-24" /> :
                               <Workflow className="w-24 h-24" />}
                            </div>
                            <div className="relative z-10">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 shadow-lg ${
                                category === 'Shopify' ? 'bg-emerald-600 shadow-emerald-500/20' :
                                category === 'Google Sheets' ? 'bg-green-600 shadow-green-500/20' :
                                category === 'Zoho' ? 'bg-orange-600 shadow-orange-500/20' :
                                category === 'WhatsApp' ? 'bg-teal-600 shadow-teal-500/20' :
                                'bg-violet-600 shadow-violet-500/20'
                              }`}>
                                <Zap className="w-5 h-5 text-white" />
                              </div>
                              <h3 className="font-black text-white text-lg">{template.name}</h3>
                              <p className="text-white/50 text-xs mt-2 leading-relaxed">{template.summary}</p>
                              <div className="mt-6 flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest group-hover:text-white group-hover:gap-3 transition-all">
                                Use Template <ArrowRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CUSTOM FLOWS VIEW */}
              {galleryTab === 'custom' && (
                <div className="space-y-6 pt-2">
                  {(() => {
                    const customFlows = filteredAutomations.filter(f => !isDefault(f.id));
                    
                    if (customFlows.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-3xl mt-4">
                          <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                            <Workflow className="w-8 h-8 text-white/20" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">No custom flows yet</h3>
                          <p className="text-white/40 font-medium max-w-sm text-center mb-6">Build a custom automation from scratch or start with one of our pre-built templates.</p>
                          <div className="flex gap-4">
                            <Button onClick={() => setDlgOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
                              <Plus className="mr-2 w-4 h-4" /> Create New Flow
                            </Button>
                            <Button variant="outline" onClick={() => setGalleryTab('templates')} className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 border border-white/10">
                              <Sparkles className="mr-2 w-4 h-4" /> Browse Templates
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {customFlows.map(flow => (
                          <div 
                            key={flow.id}
                            onClick={() => {
                              setActiveId(flow.id)
                              setSelId(flow.steps[0]?.id || null)
                              setViewMode('editor')
                            }}
                            className="group p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer flex flex-col h-full relative overflow-hidden"
                          >
                            <div className="flex items-start justify-between mb-4 relative z-10">
                              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${flow.status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                                {flow.source === 'Shopify' ? <PackageCheck className="w-5 h-5" /> : (flow.source === 'Zoho' ? <Users className="w-5 h-5" /> : (flow.source === 'Google Sheets' ? <Database className="w-5 h-5" /> : <Activity className="w-5 h-5" />))}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${flow.status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                                  {flow.status ? 'Live' : 'Draft'}
                                </span>
                              </div>
                            </div>
                            <h3 className="font-bold text-white group-hover:text-emerald-300 transition-colors relative z-10">{flow.name}</h3>
                            <p className="text-white/40 text-[11px] mt-1.5 line-clamp-2 leading-relaxed flex-1 relative z-10">{flow.summary || 'Custom automated journey'}</p>
                            
                            {flow.zohoFieldSummary && (
                              <div className="mt-3 rounded-2xl border border-orange-400/10 bg-orange-500/[0.04] p-3 relative z-10">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-orange-300/70">Fields sent to Zoho</div>
                                <p className="mt-1 text-[10px] leading-relaxed text-white/35 line-clamp-4">{flow.zohoFieldSummary}</p>
                              </div>
                            )}

                            <div className="mt-6 pt-5 border-t border-white/[0.04] flex items-center justify-between relative z-10">
                              <div className="flex gap-4">
                                 <div className="text-center">
                                   <div className="text-xs font-bold text-white/70">{flow.metrics?.sent || 0}</div>
                                   <div className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Sent</div>
                                 </div>
                                 <div className="text-center">
                                   <div className="text-xs font-bold text-white/70">{flow.metrics?.openRate || 0}%</div>
                                   <div className="text-[9px] text-white/25 uppercase tracking-widest font-bold">Opens</div>
                                 </div>
                              </div>
                              <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                                 <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3-COL (EDITOR VIEW) — Integrated into main flex context */}
        {viewMode === 'editor' && (
          <>
        {/* LEFT */}
        <aside aria-label="Node library" className="w-[264px] shrink-0 border-r border-white/[0.06] bg-[#0d0f17] flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-bold text-white truncate leading-tight">{active?.name || 'No flow'}</h2>
            <p className="mt-0.5 text-[11px] text-white/35 line-clamp-2">{active?.summary}</p>
	            <div className="mt-2.5 flex gap-1.5 flex-wrap">
	              <span role="status" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${active?.status ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-white/35'}`}>
	                <span className={`h-1.5 w-1.5 rounded-full ${active?.status ? 'bg-emerald-400 dot-pulse' : 'bg-white/25'}`} aria-hidden="true" />{active?.status ? 'Running' : 'Stopped'}
	              </span>
	              {activeDef && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/12 text-violet-400">Default</span>}
	              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${activeValidation.errors.length > 0
	                ? 'bg-rose-500/12 text-rose-300'
	                : activeValidation.warnings.length > 0
	                  ? 'bg-amber-500/12 text-amber-300'
	                  : 'bg-emerald-500/12 text-emerald-300'}`}>
	                {activeValidation.errors.length > 0
	                  ? `${activeValidation.errors.length} blocking`
	                  : activeValidation.warnings.length > 0
	                    ? `${activeValidation.warnings.length} warning${activeValidation.warnings.length === 1 ? '' : 's'}`
	                    : 'Ready to publish'}
	              </span>
	            </div>
            {activeDef && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetActiveFlowToDefault}
                className="mt-3 w-full h-7 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold text-white/65 hover:bg-white/[0.06] hover:text-white"
              >
                Reset to Default
              </Button>
            )}
          </div>
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Node Library</p>
            <div role="tablist" aria-label="Library tabs" className="flex rounded-lg bg-white/[0.04] p-0.5">
              {['Triggers', 'Actions'].map(t => (
                <button key={t} role="tab" aria-selected={libTab === t} onClick={() => setLibTab(t)}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all ${libTab === t ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60'}`}>{t}</button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1 px-4 pb-3 [&>div>div]:!block">
            <div className="w-full min-w-full space-y-1.5 pt-1" role="list" aria-label="Draggable node blocks">
	              {libBlocks.map(block => {
	                const Icon = block.icon; const active2 = selectedLibraryBlockType === block.type
	                return (
	                  <div key={block.type} role="listitem" draggable
	                    aria-label={`${block.label} — drag to canvas`} aria-grabbed="false"
	                    title={block.description}
	                    onClick={() => setSelectedLibraryBlockType(block.type)}
	                    onDoubleClick={() => addNode(block.type)}
	                    onDragStart={e => { e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'block', blockType: block.type })); e.dataTransfer.effectAllowed = 'copy' }}
	                    className={`group rounded-xl border p-3 transition-all duration-150 select-none ${active2 ? 'border-violet-500/40 bg-violet-600/8' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'} cursor-grab active:cursor-grabbing active:scale-95 active:opacity-80`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`rounded-lg p-2 transition-colors ${active2 ? 'bg-violet-600/20 text-violet-300' : 'bg-white/[0.06] text-white/40 group-hover:text-white/70'}`} aria-hidden="true"><Icon className="h-3.5 w-3.5" /></div>
                      <div>
                        <div className="text-xs font-semibold text-white/80">{block.label}</div>
                        <div className="text-[10px] text-white/30 mt-0.5">{block.description}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
	          <div className="px-4 pb-4 pt-2 border-t border-white/[0.05] space-y-2">
	            <Button aria-label="Add selected node type to canvas"
	              onClick={() => addNode(selectedLibraryBlock?.type || 'message')}
	              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold h-8 transition-all active:scale-95">
	              <Plus className="mr-1.5 h-3.5 w-3.5" />Add {selectedLibraryBlock?.label || 'Node'}
	            </Button>
	            <p className="text-[10px] text-white/20 text-center">Click to select, double-click to add, or drag onto canvas</p>
	          </div>
	        </aside>

        {/* FLOW MANAGEMENT PANEL (Integrated after library) */}
        <aside className={`transition-all duration-300 border-r border-white/[0.06] bg-[#0d0f17] flex flex-col z-40 ${sidebarOpen ? 'w-[264px]' : 'w-0 overflow-hidden border-none'}`}>
          <div className="p-4 border-b border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Automations</h2>
              <Button variant="ghost" size="icon" onClick={() => setDlgOpen(true)} className="h-6 w-6 rounded-lg text-white/30 hover:text-violet-400 hover:bg-violet-500/10"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input 
                type="text"
                placeholder="Search flows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-3 [&>div>div]:!block">
            <div className="w-full min-w-full space-y-1.5 pt-1">
              {Object.entries(automationsBySource).map(([source, items]) => (
                <div key={source} className="space-y-1.5 pt-4 first:pt-1">
                  <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">{source}</h3>
                  {items.map(a => {
                    const isSelected = a.id === active?.id
                    const isDef = isDefault(a.id)
                    const Icon = a.source === 'Shopify' ? PackageCheck : (a.source === 'Zoho' ? Workflow : Zap)
                    return (
                      <div 
                        key={a.id}
                        className={`group relative rounded-xl border p-3 transition-all duration-150 cursor-pointer select-none ${isSelected ? 'border-violet-500/40 bg-violet-600/8' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'}`}
                        onClick={() => { setActiveId(a.id); setSelId(a.steps[0]?.id || null); if(viewMode === 'gallery') setViewMode('editor') }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`relative shrink-0 rounded-lg p-2 transition-colors ${isSelected ? 'bg-violet-600/20 text-violet-300' : 'bg-white/[0.06] text-white/40 group-hover:text-white/70'}`}>
                            <Icon className="h-3.5 w-3.5" />
                            <div className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#0d0f17] ${a.status ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/20'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <div className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>{a.name}</div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleFlowStatus(a.id) }}
                                  className={`p-1.5 rounded-lg transition-all ${a.status ? 'text-rose-400 bg-rose-500/5 hover:bg-rose-500/15' : 'text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15'}`}
                                  title={a.status ? 'Stop' : 'Start'}
                                >
                                  {a.status ? <Square className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                                </button>
                                {!isDef && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteFlow(a.id) }}
                                    className="p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-white/30 truncate mt-0.5">{a.summary || 'No description'}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center justify-between text-[10px] font-bold text-white/20 uppercase tracking-widest px-1 mb-3">
              <span>Stats</span>
              <span className="text-white/40">{automations.length} Flows</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                <div className="text-white/40 text-[9px] uppercase tracking-wider mb-1">Active</div>
                <div className="text-emerald-400 text-xs font-bold">{automations.filter(a => a.status).length}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                <div className="text-white/40 text-[9px] uppercase tracking-wider mb-1">Drafts</div>
                <div className="text-white/60 text-xs font-bold">{automations.filter(a => !a.status).length}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* CANVAS */}
        <main ref={outerRef} aria-label="Automation canvas — scroll to zoom, drag to pan" role="region"
          className={`relative flex-1 min-w-0 overflow-hidden ${panning ? 'cursor-grabbing' : conn ? 'cursor-crosshair' : drag ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={
            {
              backgroundColor: '#080a12',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.14) 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px'
            }
          }
          onMouseDown={startPan}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const raw = e.dataTransfer.getData('application/json'); if (!raw) return
            const p = JSON.parse(raw); if (p.kind !== 'block') return
            const r = outerRef.current?.getBoundingClientRect(); if (!r) return
            const pt = { x: Math.round((e.clientX - r.left - tr.x) / tr.scale), y: Math.round((e.clientY - r.top - tr.y) / tr.scale) }
            addNode(p.blockType, pt)
          }}>
          {activeLastTest && (
            <div className="absolute left-3 top-3 z-20 max-w-[420px] rounded-2xl border border-emerald-500/20 bg-[#0f1b16]/95 px-4 py-3 shadow-[0_16px_40px_-16px_rgba(16,185,129,0.45)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/70">Last Test Result</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {activeLastTest.results?.find(item => item.status === 'sent')?.recipient
                      ? `Sent to ${activeLastTest.results.find(item => item.status === 'sent').recipient}`
                      : 'Test finished'}
                  </div>
                  {activeLastTest.results?.[0]?.message && (
                    <div className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/55">
                      {activeLastTest.results[0].message}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setLastTest(null)}
                  className="rounded-lg p-1 text-white/35 transition hover:bg-white/5 hover:text-white/70"
                  aria-label="Dismiss last test result"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1" aria-label="Zoom controls">
            <Button size="icon" aria-label="Zoom in" onClick={() => setTr(t => ({ ...t, scale: Math.min(2.5, t.scale * 1.2) }))} className="h-7 w-7 rounded-lg bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white border border-white/[0.06]"><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button size="icon" aria-label="Zoom out" onClick={() => setTr(t => ({ ...t, scale: Math.max(0.25, t.scale * 0.8) }))} className="h-7 w-7 rounded-lg bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white border border-white/[0.06]"><ZoomOut className="h-3.5 w-3.5" /></Button>
            <Button size="icon" aria-label="Reset view" onClick={() => setTr({ x: 0, y: 0, scale: 1 })} className="h-7 w-7 rounded-lg bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white border border-white/[0.06]"><Maximize2 className="h-3.5 w-3.5" /></Button>
          </div>
          {/* Scale indicator */}
          <div className="absolute bottom-3 right-3 z-20 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.06] text-[10px] text-white/30 font-mono" aria-live="polite">{Math.round(tr.scale * 100)}%</div>
          {/* Canvas inner (transformed) */}
          <div ref={canvasRef} style={{ transform: `translate(${tr.x}px,${tr.y}px) scale(${tr.scale})`, transformOrigin: 'top left', width: bnd.width, height: bnd.height, position: 'relative' }}>
            <svg className="absolute inset-0" style={{ width: bnd.width, height: bnd.height }} aria-hidden="true">
              <defs>
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <marker id="arr-main" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#8b5cf6" opacity="0.8" />
                </marker>
                <marker id="arr-alt" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#fbbf24" opacity="0.8" />
                </marker>
              </defs>
              {edges.map(edge => {
                const src = active?.steps.find(s => s.id === edge.sourceId)
                const tgt = active?.steps.find(s => s.id === edge.targetId)
                if (!src || !tgt) return null
                const d = ePath(src, tgt, edge.key)
                const isAlt = edge.key === 'fallback'
                const col = isAlt ? '#fbbf24' : '#8b5cf6'
                
                // Calculate midpoint of the cubic bezier curve at t=0.5
                const f = outPt(src, edge.key), t = inPt(tgt)
                const cp1x = f.x + Math.max(80, Math.abs(t.x - f.x) * 0.5)
                const cp2x = t.x - Math.max(80, Math.abs(t.x - f.x) * 0.5)
                
                // P0=f, P1=(cp1x, f.y), P2=(cp2x, t.y), P3=t
                const midX = 0.125 * f.x + 0.375 * cp1x + 0.375 * cp2x + 0.125 * t.x
                const midY = 0.125 * f.y + 0.375 * f.y + 0.375 * t.y + 0.125 * t.y

                return (
                    <g key={edge.id} className="group/edge pointer-events-auto" style={{ pointerEvents: 'all' }}>
                      {/* Wider invisible hit area for easier hovering */}
                      <path 
                        d={d} 
                        fill="none" 
                        stroke="rgba(0,0,0,0.001)" 
                        strokeWidth="40" 
                        strokeLinecap="round" 
                        className="peer cursor-pointer" 
                        style={{ pointerEvents: 'all' }}
                      />
                      
                      {/* Decorative paths */}
                      <path d={d} fill="none" stroke={col} strokeOpacity="0.15" strokeWidth="12" strokeLinecap="round" />
                      <path d={d} fill="none" stroke={col} strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round" markerEnd={isAlt ? 'url(#arr-alt)' : 'url(#arr-main)'} filter="url(#glow)" className="edge-path" />
                      
                      {edge.label && (
                        <text x={midX} y={midY - 12} fill={col} textAnchor="middle" fontSize="10" fontVariant="all-small-caps" fontWeight="800" className="drop-shadow-sm">
                          {edge.label}
                        </text>
                      )}
                      
                      {/* Disconnect Button */}
                      <g 
                        transform={`translate(${Math.round(midX)}, ${Math.round(midY)})`}
                        className="opacity-0 group-hover/edge:opacity-100 transition-opacity duration-150 cursor-pointer"
                        style={{ pointerEvents: 'all' }}
                      >
                        <circle 
                          r="15" 
                          fill="#0b0d14" 
                          stroke={col} 
                          strokeWidth="2.5" 
                          className="shadow-xl" 
                          style={{ pointerEvents: 'all' }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('[Studio] Clicked X for edge:', edge.sourceId, '->', edge.targetId, 'key:', edge.key)
                            toast.info(`Removing connection from ${edge.sourceId}...`)
                            disconnectEdge(edge.sourceId, edge.key)
                          }}
                        />
                        <g stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" style={{ pointerEvents: 'none' }}>
                          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" />
                          <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" />
                        </g>
                        <title>Remove Connection</title>
                      </g>
                    </g>
                )
              })}
              {conn && (() => {
                const src = active?.steps.find(s => s.id === conn.srcId); if (!src) return null
                const f = outPt(src, conn.key), d2 = Math.max(80, Math.abs(conn.cx - f.x) * 0.5)
                return <path d={`M ${f.x} ${f.y} C ${f.x + d2} ${f.y}, ${conn.cx - d2} ${conn.cy}, ${conn.cx} ${conn.cy}`} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="8 5" opacity="0.7" />
              })()}
            </svg>

	            {active?.steps.map(step => {
	              const isInstagramNode = step.channel === 'instagram' || (step.type === 'trigger' && step.event?.startsWith('instagram.'))
	              const Icon = isInstagramNode ? Instagram : (getBlock(step.type).icon)
	              const c = isInstagramNode ? {
	                border: 'border-pink-500/50',
	                bg: 'bg-[#1c0f18]',
	                hdr: 'bg-pink-600/20',
	                icon: 'bg-pink-600/30 text-pink-300',
	                iconBg: 'bg-pink-600/20',
	                lbl: 'text-pink-300',
	                dot: 'bg-pink-500'
	              } : (COLORS[step.type] || COLORS.message)
	              const isSel = sel?.id === step.id
	              const isNew = newId === step.id
	              const stepValidation = activeValidation.stepIssues[step.id]
	              const hasError = !!stepValidation?.errors?.length
	              const hasWarning = !hasError && !!stepValidation?.warnings?.length
	              const tMeta = step.type === 'trigger' ? getTrig(step.event) : null
	              const recipientSummary = (step.type === 'message' || step.type === 'ai_reply')
	                ? (step.recipientMode === 'fixed_number' && step.recipientNumber ? `To: ${step.recipientNumber}` : `To: ${defaultRecipientLabel.toLowerCase()}`)
	                : ''
              const testResult = activeLastTest?.nodeId === step.id ? activeLastTest.results?.[0] : null
              const isThisTestRunning = testing && step.id === testingNodeId
              const body = step.type === 'test'
                ? (step.testSource === 'dummy' ? 'Dummy order data' : 'Latest saved order data')
                : (step.type === 'interactive' ? step.message : (step.type === 'ai_reply' ? 'Knowledge-based response' : (step.template ? `Template: ${step.template}` : step.message || step.rule || step.description || 'Configure node')))
              return (
                <div key={step.id} data-node="true" role="article" aria-label={`${step.type} node: ${step.title}`} aria-selected={isSel} tabIndex={0}
	                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelId(step.id); if (e.key === 'Delete') delNode(step.id) }}
	                  onClick={() => setSelId(step.id)}
	                  className={`absolute w-[256px] rounded-2xl border backdrop-blur-sm select-none transition-all duration-200 ${c.border} ${c.bg} ${isNew ? 'node-in' : ''} ${isSel ? 'shadow-[0_0_0_2px_rgba(139,92,246,0.6),0_20px_56px_-8px_rgba(109,40,217,0.35)] scale-[1.03] z-10' : 'shadow-[0_6px_24px_-6px_rgba(0,0,0,0.7)] hover:scale-[1.015] hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.85)] z-0'} ${hasError ? 'ring-1 ring-rose-500/40' : hasWarning ? 'ring-1 ring-amber-500/30' : ''}`}
	                  style={{ left: step.position.x, top: step.position.y, minHeight: step.type === 'interactive' ? 260 : 'auto', cursor: drag?.id === step.id ? 'grabbing' : 'default' }}>
                  {/* header */}
                  <div role="button" aria-label={`Drag to move ${step.title}`} className={`flex items-center justify-between px-3.5 py-3 rounded-t-2xl cursor-grab active:cursor-grabbing ${c.hdr}`}
                    onMouseDown={e => startDrag(e, step.id)}>
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-2 ${c.iconBg || 'bg-white/5'} text-white`} aria-hidden="true">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white leading-none">{step.title}</h3>
                        <p className="text-[9px] text-white/40 mt-1 font-medium">{isInstagramNode && step.type === 'message' ? 'Instagram DM' : (getBlock(step.type).label)}</p>
                      </div>
                    </div>
                    <button 
                      aria-label={`Delete ${step.title}`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { 
                        e.stopPropagation(); 
                        console.log('[Studio] Deleting node:', step.id);
                        delNode(step.id);
                      }}
                      className="h-6 w-6 flex items-center justify-center text-white/20 hover:text-rose-400 hover:bg-rose-500/20 rounded-md transition-colors z-30">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* body */}
                  <div className="relative px-3.5 py-3.5 border-t border-white/[0.06]">
                    <div className="text-sm font-bold text-white/90 leading-tight pr-6">{step.title}</div>
                    <p className="mt-1.5 text-[11px] text-white/35 line-clamp-2 leading-relaxed h-[32px] overflow-hidden">{tMeta?.description || step.description || body}</p>
                    {step.type === 'interactive' && (
                      <div className="mt-4 flex flex-col gap-2" style={{ minHeight: `${(step.options?.length || 0) * 32}px` }}>
                        {(step.options || []).map((opt, idx) => (
                           <div key={idx} className="text-[10px] flex items-center bg-fuchsia-500/10 border border-fuchsia-500/20 rounded px-3 h-[24px] truncate w-[88%] text-fuchsia-100/90 shadow-sm">
                              {opt.label || `Option ${idx + 1}`}
                           </div>
                        ))}
                      </div>
                    )}
	                    {recipientSummary && (
	                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">{recipientSummary}</p>
	                    )}
	                    {(hasError || hasWarning) && (
	                      <div className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] leading-relaxed ${hasError ? 'bg-rose-500/12 text-rose-200' : 'bg-amber-500/12 text-amber-100'}`}>
	                        {hasError ? stepValidation.errors[0] : stepValidation.warnings[0]}
	                      </div>
	                    )}
	                    {step.type === 'test' && (
	                      <>
                        <Button
                          size="sm"
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); runFlowTest(step.id) }}
                          className="mt-3 h-7 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold"
                        >
                          <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                          {isThisTestRunning ? 'Running...' : 'Run Test'}
                        </Button>
                        {testResult && (
                          <div className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] leading-relaxed ${testResult.status === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-200'
                            : 'bg-amber-500/10 text-amber-200'
                            }`}>
                            <div className="font-semibold">
                              {testResult.status === 'sent'
                                ? `Sent to ${testResult.recipient}`
                                : (testResult.error || testResult.status)}
                            </div>
                            {testResult.message && (
                              <div className="mt-1 text-white/60">{testResult.message}</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {/* input port */}
                  <button aria-label="Input connection port" 
                    onMouseDown={e => e.stopPropagation()}
                    onMouseUp={e => { e.stopPropagation(); finishConn(step.id) }}
                    className="absolute -left-2.5 top-[50px] h-5 w-5 rounded-full border-2 border-[#0b0d14] bg-white/15 hover:bg-white/40 transition-all ring-1 ring-transparent hover:ring-white/20 z-20" />
                  {/* output port(s) */}
                  {(step.type === 'condition' || step.type === 'ai_reply') ? (
                    <>
                      <button aria-label={step.type === 'ai_reply' ? "Success output" : "True branch output"} 
                        onMouseDown={e => { e.stopPropagation(); startConn(e, step.id, 'main') }} 
                        className={`absolute -right-2.5 top-[32px] h-5 w-5 rounded-full border-2 border-[#0b0d14] ${c.dot} hover:brightness-125 transition-all ring-1 ring-transparent hover:ring-violet-400/40 z-20`} />
                      <button aria-label={step.type === 'ai_reply' ? "Error/Fallback output" : "False branch output"} 
                        onMouseDown={e => { e.stopPropagation(); startConn(e, step.id, 'fallback') }} 
                        className={`absolute -right-2.5 top-[82px] h-5 w-5 rounded-full border-2 border-[#0b0d14] ${step.type === 'ai_reply' ? 'bg-indigo-400/60' : 'bg-amber-500'} hover:brightness-125 transition-all ring-1 ring-transparent hover:ring-amber-400/40 z-20`} />
                    </>
                  ) : step.type === 'interactive' ? (
                    <>
                      {(step.options || []).map((opt, idx) => {
                        const topOff = 122 + (idx * 32);
                        return <button key={opt.id} aria-label={`Option: ${opt.label}`} 
                          onMouseDown={e => { e.stopPropagation(); startConn(e, step.id, opt.id) }} 
                          className={`absolute -right-2.5 h-5 w-5 rounded-full border-2 border-[#0b0d14] ${c.dot} hover:brightness-125 transition-all ring-1 ring-transparent hover:ring-fuchsia-400/40 z-20`} style={{ top: topOff }} />
                      })}
                    </>
                  ) : (
                    <button aria-label="Output connection port" 
                      onMouseDown={e => { e.stopPropagation(); startConn(e, step.id, 'main') }} 
                      className={`absolute -right-2.5 top-[50px] h-5 w-5 rounded-full border-2 border-[#0b0d14] ${c.dot} hover:brightness-125 transition-all ring-1 ring-transparent hover:ring-violet-400/40 z-20`} />
                  )}
                </div>
              )
            })}
          </div>
          {(!active?.steps || active.steps.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-label="Empty canvas">
	              <div className="text-center"><Workflow className="h-10 w-10 text-white/8 mx-auto mb-2" aria-hidden="true" /><p className="text-white/15 text-xs">Drag blocks from the left panel onto the canvas</p><p className="text-white/8 text-[10px] mt-1">Scroll to zoom · Drag the background or use middle mouse to pan</p></div>
            </div>
          )}
        </main>

        {/* RIGHT PANEL */}
        <aside aria-label="Node properties" className={`transition-all duration-300 border-l border-white/[0.06] bg-[#0d0f17] flex flex-col ${rightSidebarOpen ? 'w-[296px]' : 'w-0 overflow-hidden border-none'}`}>
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between">
            <div><h2 className="text-sm font-bold text-white">Properties</h2><p className="text-[11px] text-white/30 mt-0.5">{sel ? `${sel.type} node` : 'Select a node'}</p></div>
            <span role="status" className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${active?.status ? 'bg-emerald-500/12 text-emerald-400' : 'bg-white/[0.05] text-white/30'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${active?.status ? 'bg-emerald-400 dot-pulse' : 'bg-white/20'}`} aria-hidden="true" />{active?.status ? 'Live' : 'Idle'}
            </span>
          </div>
          <div role="tablist" aria-label="Properties sections" className="flex border-b border-white/[0.05]">
            {[['settings', 'Settings'], ['mapping', 'Mapping'], ['logs', 'Logs']].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={propTab === key} onClick={() => setPropTab(key)}
                className={`flex-1 py-2 text-[11px] font-bold tracking-wide transition-all ${propTab === key ? 'text-violet-400 border-b-2 border-violet-500' : 'text-white/25 hover:text-white/50 border-b-2 border-transparent'}`}>{label}</button>
            ))}
          </div>
          <ScrollArea className="flex-1">
	            <div role="tabpanel" className="px-4 py-4 space-y-3">
	              {propTab === 'settings' && sel && (
	                <>
	                  {selectedStepIssues && (
	                    <div className={`rounded-xl border px-3 py-2.5 text-[11px] ${selectedStepIssues.errors.length > 0
	                      ? 'border-rose-500/25 bg-rose-500/8 text-rose-100'
	                      : 'border-amber-500/25 bg-amber-500/8 text-amber-100'}`}>
	                      {(selectedStepIssues.errors.length > 0 ? selectedStepIssues.errors : selectedStepIssues.warnings).map((issue, index) => (
	                        <div key={index}>{issue}</div>
	                      ))}
	                    </div>
	                  )}
	                  {sel.type !== 'message' && (
	                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/35">
	                      Select {isInstagramFlow ? 'an' : 'a'} <span className="font-semibold text-white/60">{isInstagramFlow ? 'Instagram' : 'WhatsApp'}</span> node to choose whether it sends to the {defaultRecipientLabel.toLowerCase()} or a fixed number.
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="node-title" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Node Title</Label>
                    <Input id="node-title" value={sel.title || ''} onChange={e => updStep({ title: e.target.value })} disabled={selLocked} aria-disabled={selLocked} className={inputCls} />
                  </div>
                  {sel.type === 'trigger' && (
                    <div className="space-y-3">
                      {/* Category Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Trigger Source</Label>
                        <Select value={triggerCategory} onValueChange={v => {
                          if (selLocked || !active) return
                          setTriggerCategory(v)
                          // Set default event for category
                          let defaultEvent = 'shopify.order_created'
                          if (v === 'woocommerce' && waConfig?.woocommerce?.triggers?.length > 0) {
                            defaultEvent = waConfig.woocommerce.triggers[0].value
                          } else if (v === 'shopify') {
                            defaultEvent = 'shopify.order_created'
                          } else if (v === 'whatsapp') {
                            defaultEvent = 'whatsapp.message_received'
                          } else if (v === 'instagram') {
                            defaultEvent = 'instagram.comment_created'
                          } else if (v === 'custom') {
                            defaultEvent = 'custom.webhook'
                          }
                          const o = dynamicTriggers.find(t => t.value === defaultEvent)
                          updAuto(active.id, a => normalize(remapTemplateStepsForTrigger({
                            ...a,
                            steps: a.steps.map(s => s.id === sel.id ? { ...s, event: defaultEvent, title: o?.label || sel.title, description: o?.description || sel.description } : s)
                          }, templates, defaultEvent)))
                        }} disabled={selLocked}>
                          <SelectTrigger className={inputCls}><SelectValue placeholder="Select trigger source..." /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                            <SelectItem value="shopify" className="text-white/70 text-xs">🛍️ Shopify</SelectItem>
                            <SelectItem value="woocommerce" className="text-white/70 text-xs">🛒 WooCommerce</SelectItem>
                            <SelectItem value="whatsapp" className="text-white/70 text-xs">💬 WhatsApp</SelectItem>
                            <SelectItem value="instagram" className="text-white/70 text-xs">📸 Instagram</SelectItem>
                            <SelectItem value="zoho" className="text-white/70 text-xs">✨ Zoho CRM</SelectItem>
                            <SelectItem value="custom" className="text-white/70 text-xs">🔗 Custom Webhook</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Specific Trigger Selector */}
                      {triggerCategory && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Trigger Event</Label>
                          <Select value={sel.event || ''} onValueChange={v => {
                            if (selLocked || !active) return
                            const o = dynamicTriggers.find(t => t.value === v)
                            updAuto(active.id, a => normalize(remapTemplateStepsForTrigger({
                              ...a,
                              steps: a.steps.map(s => s.id === sel.id ? { ...s, event: v, title: o?.label || sel.title, description: o?.description || sel.description } : s)
                            }, templates, v)))
                          }} disabled={selLocked}>
                            <SelectTrigger className={inputCls}><SelectValue placeholder="Select event..." /></SelectTrigger>
                            <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                              {triggerCategory === 'shopify' && dynamicTriggers.filter(t => t.value.startsWith('shopify.')).map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs">{o.label}</SelectItem>
                              ))}
                              {triggerCategory === 'woocommerce' && dynamicTriggers.filter(t => t.value.startsWith('woocommerce.')).map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs">{o.label}</SelectItem>
                              ))}
                              {triggerCategory === 'whatsapp' && dynamicTriggers.filter(t => t.value.startsWith('whatsapp.')).map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs">{o.label}</SelectItem>
                              ))}
                              {triggerCategory === 'instagram' && dynamicTriggers.filter(t => t.value.startsWith('instagram.')).map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs">{o.label}</SelectItem>
                              ))}
                              {triggerCategory === 'zoho' && dynamicTriggers.filter(t => t.value.startsWith('zoho.')).map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs">{o.label}</SelectItem>
                              ))}
                              {triggerCategory === 'custom' && dynamicTriggers.filter(t => t.value.startsWith('custom.')).map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs">{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {sel.event === 'whatsapp.message_received' && (
                        <div className="space-y-1.5 mt-4">
                          <Label htmlFor="trigger-keyword" className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Trigger Word (Keyword)</Label>
                          <Input
                            id="trigger-keyword"
                            value={sel.keyword || ''}
                            onChange={e => updStep({ keyword: e.target.value })}
                            className={inputCls}
                            placeholder="e.g. START, MENU, HELP"
                          />
                          <p className="text-[10px] text-white/35 italic">Leave blank to trigger on ANY incoming message.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Latest Webhook Payload Inspector */}
                  {sel.type === 'trigger' && latestMatchingWebhookLog && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <details className="group">
                        <summary className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/25 cursor-pointer hover:text-white/40 list-none">
                          <History className="w-3 h-3" />
                          <span>Latest {latestMatchingWebhookLog.type} Data</span>
                          <span className="ml-auto text-[9px] font-normal lowercase bg-white/5 px-1.5 py-0.5 rounded">
                            {new Date(latestMatchingWebhookLog.receivedAt).toLocaleTimeString()}
                          </span>
                        </summary>
                        <div className="mt-2.5 space-y-2">
                          <div className="rounded-xl border border-white/[0.05] bg-black/20 p-2.5">
                            <pre className="text-[10px] text-white/50 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[300px]">
                              {JSON.stringify(latestMatchingWebhookLog.payload, null, 2)}
                            </pre>
                          </div>
                          <p className="text-[10px] text-white/30 italic">
                            This is the raw data received from {latestMatchingWebhookLog.type}. Use these keys (e.g. <code>{`{{${Object.keys(latestMatchingWebhookLog.payload || {})[0] || 'field_name'}}}`}</code>) in your automation.
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* WooCommerce Data Source */}
                  {sel.type === 'trigger' && sel.event?.startsWith('woocommerce.') && (
                    <div className="space-y-3 mt-4 p-3 rounded-xl border border-violet-500/20 bg-violet-600/5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-violet-300">WooCommerce Order Data</div>

                      {/* WooCommerce Info */}
                      <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2">
                        <p className="text-[10px] text-violet-200">
                          Order data will be received from WooCommerce when trigger fires
                        </p>
                      </div>

                      {/* Available WooCommerce Triggers */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-white/50">Active WooCommerce Triggers</Label>
                        <div className="flex flex-wrap gap-1">
                          {(waConfig?.woocommerce?.triggers || []).map(trigger => (
                            <span key={trigger.value} className="px-2 py-1 text-[9px] bg-violet-600/30 text-violet-200 rounded">
                              {trigger.label}
                            </span>
                          ))}
                          {(!waConfig?.woocommerce?.triggers?.length) && (
                            <span className="text-[9px] text-white/40">No triggers configured in WordPress</span>
                          )}
                        </div>
                      </div>

                      {/* Webhook URL */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-white/50">Webhook URL</Label>
                        <Input
                          value={`${process.env.NEXT_PUBLIC_BASE_URL || 'https://lcsw.dpdns.org'}/api/webhook/custom`}
                          readOnly
                          className={`${inputCls} bg-white/5 text-emerald-300 text-[10px]`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Webhook Source - Multiple Tables Support */}
                  {sel.type === 'trigger' && sel.event?.startsWith('custom.webhook') && (
                    <div className="space-y-3 mt-4 p-3 rounded-xl border border-violet-500/20 bg-violet-600/5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Data Source</div>

                      {/* WordPress Tables Info */}
                      <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2">
                        <p className="text-[10px] text-violet-200">
                          Tables configured in WordPress plugin → Custom Tables tab
                        </p>
                      </div>

                      {/* Table Selection - Dynamic from WordPress */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-white/50">Select Table (from plugin)</Label>
                        <Select
                          value={sel.selectedTable || ''}
                          onValueChange={v => updStep({ selectedTable: v })}
                        >
                          <SelectTrigger className={inputCls}><SelectValue placeholder="Select a table..." /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                            {/* Show only configured tables from WordPress plugin */}
                            {(waConfig?.custom_tables?.tables || []).map(table => (
                              <SelectItem key={table.name} value={table.name} className="text-white/70 text-xs">{table.label || table.name}</SelectItem>
                            ))}
                            {(!waConfig?.custom_tables?.tables?.length) && (
                              <div className="p-2 text-xs text-white/50 text-center">
                                No tables configured. Add tables in WordPress plugin.
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[9px] text-white/30">Choose which table triggers this automation</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-white/50">Trigger Rule</Label>
                        <Select
                          value={sel.customTriggerMode || 'any'}
                          onValueChange={value => updStep({ customTriggerMode: value })}
                        >
                          <SelectTrigger className={inputCls}><SelectValue placeholder="Select trigger rule..." /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                            <SelectItem value="any" className="text-white/70 text-xs">Any webhook event</SelectItem>
                            <SelectItem value="row_created" className="text-white/70 text-xs">When a row is created</SelectItem>
                            <SelectItem value="row_updated" className="text-white/70 text-xs">When a row is updated</SelectItem>
                            <SelectItem value="column_changed" className="text-white/70 text-xs">When a column changes</SelectItem>
                            <SelectItem value="column_changed_to_value" className="text-white/70 text-xs">When a column changes to a value</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(sel.customTriggerMode === 'column_changed' || sel.customTriggerMode === 'column_changed_to_value') && (
                        <>
                          <div className="space-y-1.5">
                            <Label htmlFor="custom-watched-column" className="text-[10px] text-white/50">Watched Column</Label>
                            <Input
                              id="custom-watched-column"
                              value={sel.customWatchedColumn || ''}
                              onChange={e => updStep({ customWatchedColumn: e.target.value })}
                              className={inputCls}
                              placeholder="status"
                            />
                            {activeWebhookFieldOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {activeWebhookFieldOptions.slice(0, 8).map(option => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updStep({ customWatchedColumn: option.value })}
                                    className="px-2 py-1 rounded-md bg-white/[0.05] text-[10px] text-white/55 hover:bg-white/[0.08] hover:text-white"
                                  >
                                    {option.value}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="custom-previous-value" className="text-[10px] text-white/50">Previous Value (optional)</Label>
                              <Input
                                id="custom-previous-value"
                                value={sel.customPreviousValue || ''}
                                onChange={e => updStep({ customPreviousValue: e.target.value })}
                                className={inputCls}
                                placeholder="pending"
                              />
                            </div>
                            {sel.customTriggerMode === 'column_changed_to_value' && (
                              <div className="space-y-1.5">
                                <Label htmlFor="custom-expected-value" className="text-[10px] text-white/50">New Value</Label>
                                <Input
                                  id="custom-expected-value"
                                  value={sel.customExpectedValue || ''}
                                  onChange={e => updStep({ customExpectedValue: e.target.value })}
                                  className={inputCls}
                                  placeholder="processing"
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-white/50">Column Mapping</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updStep({
                              customFieldMappings: [
                                ...(sel.customFieldMappings || []),
                                { sourceField: '', targetField: 'customer_name' }
                              ]
                            })}
                            className="h-7 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add Mapping
                          </Button>
                        </div>
                        <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2">
                          <p className="text-[10px] text-violet-200">
                            Map incoming webhook columns into automation fields like customer phone, email, order number, and total.
                          </p>
                        </div>
                        {(sel.customFieldMappings || []).length === 0 && (
                          <p className="text-[10px] text-white/35">No custom column mappings yet. Add one if your webhook column names differ from the automation fields.</p>
                        )}
                        {(sel.customFieldMappings || []).map((mapping, index) => (
                          <div key={`${mapping.targetField}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-white/40">Webhook Column</Label>
                              <Input
                                value={mapping.sourceField || ''}
                                onChange={e => updStep({
                                  customFieldMappings: (sel.customFieldMappings || []).map((entry, entryIndex) => (
                                    entryIndex === index ? { ...entry, sourceField: e.target.value } : entry
                                  ))
                                })}
                                className={inputCls}
                                placeholder="billing_email"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-white/40">Maps To</Label>
                              <Select
                                value={mapping.targetField || ''}
                                onValueChange={value => updStep({
                                  customFieldMappings: (sel.customFieldMappings || []).map((entry, entryIndex) => (
                                    entryIndex === index ? { ...entry, targetField: value } : entry
                                  ))
                                })}
                              >
                                <SelectTrigger className={inputCls}><SelectValue placeholder="Select field..." /></SelectTrigger>
                                <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                                  {CUSTOM_WEBHOOK_TARGET_FIELDS.map(option => (
                                    <SelectItem key={option.value} value={option.value} className="text-white/70 text-xs">{option.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => updStep({
                                customFieldMappings: (sel.customFieldMappings || []).filter((_entry, entryIndex) => entryIndex !== index)
                              })}
                              className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] text-white/45 hover:bg-rose-500/10 hover:text-rose-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {activeWebhookFieldOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {activeWebhookFieldOptions.slice(0, 12).map(option => (
                              <button
                                key={`field-${option.value}`}
                                type="button"
                                onClick={() => {
                                  const hasBlank = (sel.customFieldMappings || []).some(entry => !entry.sourceField)
                                  if (hasBlank) {
                                    updStep({
                                      customFieldMappings: (sel.customFieldMappings || []).map(entry => (
                                        !entry.sourceField ? { ...entry, sourceField: option.value } : entry
                                      ))
                                    })
                                  } else {
                                    updStep({
                                      customFieldMappings: [
                                        ...(sel.customFieldMappings || []),
                                        { sourceField: option.value, targetField: 'customer_name' }
                                      ]
                                    })
                                  }
                                }}
                                className="px-2 py-1 rounded-md bg-white/[0.05] text-[10px] text-white/55 hover:bg-white/[0.08] hover:text-white"
                              >
                                {option.value}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Webhook URL */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-white/50">Webhook URL</Label>
                        <Input
                          value={`${process.env.NEXT_PUBLIC_BASE_URL || 'https://lcsw.dpdns.org'}/api/webhook/custom`}
                          readOnly
                          className={`${inputCls} bg-white/5 text-emerald-300 text-[10px]`}
                        />
                      </div>
                    </div>
                  )}
                  {sel.type === 'test' && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="test-source" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Test Source</Label>
                        <Select value={sel.testSource || 'latest_order'} onValueChange={value => updStep({ testSource: value })}>
                          <SelectTrigger id="test-source" className={inputCls}><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                            <SelectItem value="latest_order" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Latest order</SelectItem>
                            <SelectItem value="history" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">History Chat</SelectItem>
                            <SelectItem value="dummy" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Dummy data</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {sel.testSource === 'history' && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Select History Chat</Label>
                          <Select value={selectedChatPhone} onValueChange={setSelectedChatPhone}>
                            <SelectTrigger className={inputCls}><SelectValue placeholder="Pick a chat..." /></SelectTrigger>
                            <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                              {chats.map(chat => (
                                <SelectItem key={chat.phone} value={chat.phone} className="text-white/70 text-xs">
                                  {chat.customerName || chat.phone} ({chat.phone})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="test-event" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Simulated Event</Label>
                        <Select value={sel.event || 'shopify.order_created'} onValueChange={v => { const o = dynamicTriggers.find(t => t.value === v); updStep({ event: v, title: o?.label ? `Test ${o.label}` : sel.title, description: o?.description || sel.description }) }}>
                          <SelectTrigger id="test-event" className={inputCls}><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">{dynamicTriggers.filter(trigger => trigger.value !== 'custom.webhook').map(o => <SelectItem key={o.value} value={o.value} className="text-white/70 text-xs focus:bg-white/8 focus:text-white">{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/35">
                        Run Test follows the connection coming out of this node and sends using the connected {isInstagramFlow ? 'Instagram' : 'WhatsApp'} node settings.
                      </div>
                      <Button
                        onClick={() => runFlowTest(sel.id)}
                        disabled={testing}
                        className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold h-8 transition-all active:scale-95"
                      >
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        {testing ? 'Running test...' : 'Run This Test Node'}
                      </Button>
                    </>
                  )}
                  {sel.type === 'delay' && (
                    <div className="grid grid-cols-[1fr_108px] gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="delay-val" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Amount</Label>
                        <Input id="delay-val" type="number" min="1" value={sel.delayValue || ''} onChange={e => updStep({ delayValue: e.target.value })} disabled={selLocked} className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="delay-unit" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Unit</Label>
                        <Select value={sel.delayUnit || 'hours'} onValueChange={v => updStep({ delayUnit: v })} disabled={selLocked}>
                          <SelectTrigger id="delay-unit" className={inputCls}><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">{['seconds', 'minutes', 'hours', 'days'].map(u => <SelectItem key={u} value={u} className="text-white/70 text-xs focus:bg-white/8 focus:text-white capitalize">{u[0].toUpperCase() + u.slice(1)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {sel.type === 'condition' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-rule" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Condition Rule</Label>
                      <Textarea id="cond-rule" rows={4} value={sel.rule || ''} onChange={e => updStep({ rule: e.target.value })} disabled={selLocked} className={textCls} />
                    </div>
                  )}
                  {sel.type === 'interactive' && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="inter-msg" className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Menu Message</Label>
                        <Textarea id="inter-msg" rows={3} value={sel.message || ''} onChange={e => updStep({ message: e.target.value })} disabled={selLocked} className={textCls} placeholder="e.g. Please choose an option below" />
                      </div>
                      <div className="space-y-2 mt-4 pt-4 border-t border-white/[0.05]">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 flex justify-between">
                           Options (Max 4)
                           <span className="text-white/40">{sel.options?.length || 0} / 4</span>
                        </Label>
                        {(sel.options || []).map((opt, idx) => (
                          <div key={idx} className="flex gap-2 items-center bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.05]">
                            <Input value={opt.label || ''} onChange={e => {
                               updStep({ 
                                  options: (sel.options || []).map((o, i) => i === idx ? { ...o, label: e.target.value } : o) 
                                });
                            }} className={`${inputCls} flex-1`} placeholder={`Option ${idx + 1}`} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-rose-400 bg-rose-500/5 hover:bg-rose-500/20" onClick={() => {
                               const newOpts = (sel.options || []).filter((_, i) => i !== idx);
                               updStep({ options: newOpts });
                            }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ))}
                        {(sel.options || []).length < 4 && (
                           <Button variant="ghost" className="w-full text-fuchsia-300 hover:text-fuchsia-200 hover:bg-fuchsia-500/10 text-[11px] h-8 border border-dashed border-fuchsia-500/30" onClick={() => {
                              const newOpts = [...(sel.options || []), { id: `opt${Date.now()}`, label: `Option ${(sel.options || []).length + 1}` }];
                              updStep({ options: newOpts });
                           }}><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                        )}
                        <p className="text-[10px] text-white/35">Each option creates an outgoing connection branch on the node.</p>
                      </div>
                    </>
                  )}
                  {sel.type === 'ai_reply' && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Assistant Configuration</Label>
                        <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                          <div className="flex items-center gap-3 mb-2">
                            <Sparkles className="w-5 h-5 text-indigo-400" />
                            <span className="font-bold text-slate-900 dark:text-white">AI Mode Active</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            This step will use your <span className="text-indigo-400 font-bold">Knowledge Base</span> to generate a natural response to the customer's message.
                          </p>
                        </div>
                      </div>


                      <div className="space-y-4 pt-4 border-t border-white/[0.05]">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/20">Recipient</Label>
                          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                            <button 
                              onClick={() => updStep({ recipientMode: 'customer' })}
                              className={`px-3 py-1 text-[10px] rounded-md transition-all ${(!sel.recipientMode || sel.recipientMode === 'customer') ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                              Customer
                            </button>
                            <button 
                              onClick={() => updStep({ recipientMode: 'fixed_number' })}
                              className={`px-3 py-1 text-[10px] rounded-md transition-all ${sel.recipientMode === 'fixed_number' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                              Custom
                            </button>
                          </div>
                        </div>
                        {sel.recipientMode === 'fixed_number' && (
                          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                            <Input
                              placeholder="e.g. 15551234567"
                              value={sel.recipientNumber || ''}
                              onChange={(e) => updStep({ recipientNumber: digitsOnly(e.target.value) })}
                              className="h-10 bg-white/5 border-white/10 rounded-xl text-xs placeholder:text-white/20 focus:ring-1 focus:ring-indigo-500/50"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sel.type === 'zoho_action' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Action</Label>
                        <Select value={sel.action || 'add_note'} onValueChange={v => {
                          const patch = { action: v }
                          if (v === 'upsert_lead' && !sel.createFields) {
                            patch.createFields = {
                              Company: '{{company}}',
                              Last_Name: '{{customer_name}}'
                            }
                          }
                          updStep(patch)
                        }}>
                          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                            <SelectItem value="upsert_lead" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Create or Update Lead</SelectItem>
                            <SelectItem value="update_status" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Update Lead Status</SelectItem>
                            <SelectItem value="add_note" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Add Note</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {sel.action === 'update_status' && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Lead Status</Label>
                          <Select value={sel.status || 'Contacted'} onValueChange={v => updStep({ status: v })}>
                            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                              <SelectItem value="Contacted" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Contacted</SelectItem>
                              <SelectItem value="Qualified" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Qualified</SelectItem>
                              <SelectItem value="Lost Lead" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Lost Lead</SelectItem>
                              <SelectItem value="Junk Lead" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Junk Lead</SelectItem>
                              <SelectItem value="Pre-Qualified" className="text-white/70 text-xs focus:bg-white/8 focus:text-white">Pre-Qualified</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {sel.action === 'upsert_lead' && (
                        <div className="rounded-xl border border-orange-500/10 bg-orange-500/5 p-3 space-y-1.5 mt-2">
                          <div className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                            <Database className="w-3.5 h-3.5" /> Field Mapping Active
                          </div>
                          <p className="text-[10.5px] text-white/50 leading-relaxed">
                            To configure Zoho CRM standard & custom field mappings, switch to the <strong className="text-violet-400">Mapping</strong> tab at the top of this panel.
                          </p>
                        </div>
                      )}

                      {sel.action === 'add_note' && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Note Content</Label>
                          <Textarea 
                            rows={4} 
                            value={sel.content || ''} 
                            onChange={e => updStep({ content: e.target.value })} 
                            className={textCls} 
                            placeholder="e.g. Customer clicked Interested on WhatsApp"
                          />
                          <p className="text-[9px] text-white/30">Use {"{{variable}}"} to include dynamic data.</p>
                        </div>
                      )}
                    </>
                  )}

                  {sel.type === 'google_sheets_action' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Target Spreadsheet</Label>
                        {loadingSpreadsheets ? (
                          <div className="flex items-center gap-2 text-xs text-white/50 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#005cc0]" />
                            <span>Loading Spreadsheets...</span>
                          </div>
                        ) : (
                          <select
                            value={sel.spreadsheetId || ''}
                            onChange={(e) => {
                              const sId = e.target.value
                              updStep({ spreadsheetId: sId, sheetName: '' })
                            }}
                            className={`${inputCls} w-full bg-[#13151f] border-white/10`}
                          >
                            <option value="" className="bg-[#13151f] text-white">-- Select Spreadsheet --</option>
                            {spreadsheets.map((s) => (
                              <option key={s.id} value={s.id} className="bg-[#13151f] text-white">{s.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {sel.spreadsheetId && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/25">Worksheet Tab</Label>
                          {loadingSheets ? (
                            <div className="flex items-center gap-2 text-xs text-white/50 py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-[#005cc0]" />
                              <span>Loading Sheets...</span>
                            </div>
                          ) : (
                            <select
                              value={sel.sheetName || 'Sheet1'}
                              onChange={(e) => updStep({ sheetName: e.target.value })}
                              className={`${inputCls} w-full bg-[#13151f] border-white/10`}
                            >
                              <option value="" className="bg-[#13151f] text-white">-- Select Worksheet Tab --</option>
                              {sheets.map((sh) => (
                                <option key={sh} value={sh} className="bg-[#13151f] text-white">{sh}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-[11px] leading-relaxed text-white/60 space-y-2">
                        <div className="font-bold text-green-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                          <Database className="w-3.5 h-3.5" />
                          <span>Auto-Mapping Active</span>
                        </div>
                        <p>
                          Our system will automatically construct standard header columns (<strong>Timestamp</strong>, <strong>Event Type</strong>, <strong>Customer Name</strong>, <strong>Phone</strong>, <strong>Email</strong>, and <strong>Order Total</strong>) and insert rows dynamically in real-time. No manual mapping required!
                        </p>
                      </div>
                    </>
                  )}

                  {sel.type === 'message' && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/20">Recipient</Label>
                          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                            <button 
                              onClick={() => updStep({ recipientMode: 'customer' })}
                              className={`px-3 py-1 text-[10px] rounded-md transition-all ${(!sel.recipientMode || sel.recipientMode === 'customer') ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                              Customer
                            </button>
                            <button 
                              onClick={() => updStep({ recipientMode: 'fixed_number' })}
                              className={`px-3 py-1 text-[10px] rounded-md transition-all ${sel.recipientMode === 'fixed_number' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                              Custom
                            </button>
                          </div>
                        </div>
                        {sel.recipientMode === 'fixed_number' && (
                          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                            <Input
                              placeholder="e.g. 15551234567"
                              value={sel.recipientNumber || ''}
                              onChange={(e) => updStep({ recipientNumber: digitsOnly(e.target.value) })}
                              className="h-10 bg-white/5 border-white/10 rounded-xl text-xs placeholder:text-white/20 focus:ring-1 focus:ring-indigo-500/50"
                            />
                          </div>
                        )}
                      </div>
                      {sel.channel !== 'instagram' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="tpl-sel" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Template</Label>
                          <Select value={sel.template || '__none__'} onValueChange={v => {
                            if (v === '__none__') {
                              if (msgLocked) return
                              updStep({ template: '', templateLanguage: '', templateComponents: [], variableMappings: [] })
                              return
                            }
                            const t = templates.find(t => t.name === v)
                            updStep({
                              template: v,
                              templateLanguage: t?.language || '',
                              templateComponents: t?.components || [],
                              variableMappings: buildAutomationTemplateMappings(t, sel.variableMappings || [], activeTriggerEvent)
                            })
                          }}>
                            <SelectTrigger id="tpl-sel" className={inputCls}><SelectValue placeholder="Choose template" /></SelectTrigger>
                            <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                              <SelectItem value="__none__" className="text-white/40 text-xs focus:bg-white/8 focus:text-white">No template</SelectItem>
                              {templates.map(t => <SelectItem key={t.id || t.name} value={t.name} className="text-white/70 text-xs focus:bg-white/8 focus:text-white">{t.name}{t.language ? ` (${t.language})` : ''}</SelectItem>)}
                              {sel.template && !tplExists && <SelectItem value={sel.template} className="text-amber-400/60 text-xs">{sel.template} (not found)</SelectItem>}
                            </SelectContent>
                          </Select>
                          {tplErr && <p role="alert" className="text-[10px] text-amber-500">{tplErr}</p>}
                        </div>
                      )}
                      {!sel.template && !msgLocked && (
                        <>
                          {activeTriggerEvent === 'instagram.comment_created' ? (
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <Label htmlFor="msg-comment-reply" className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">💬 Public Comment Reply</Label>
                                <Textarea
                                  id="msg-comment-reply"
                                  rows={3}
                                  placeholder="e.g. Sent you a DM, @{{username}}! Check your inbox 📥✨"
                                  value={sel.config?.commentReply || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    updStep({
                                      config: { ...(sel.config || {}), commentReply: val }
                                    });
                                  }}
                                  className={textCls}
                                />
                                <div className="text-[9px] text-white/30">
                                  Public response posted directly under the customer's comment.
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                                <Label htmlFor="msg-body" className="text-[10px] font-bold uppercase tracking-widest text-pink-400">📥 Private DM Message</Label>
                                <Textarea
                                  id="msg-body"
                                  rows={4}
                                  placeholder="e.g. Here is your welcome coupon: WELCOME10! 🎟️✨"
                                  value={sel.message || ''}
                                  onChange={e => updStep({ message: e.target.value })}
                                  className={textCls}
                                />
                                <div className="text-[9px] text-white/30">
                                  Private direct message sent to the customer's DM inbox.
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <Label htmlFor="msg-body" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Message Body</Label>
                              <Textarea id="msg-body" rows={5} value={sel.message || ''} onChange={e => updStep({ message: e.target.value })} className={textCls} />
                            </div>
                          )}

                          <div className="space-y-3 pt-3 border-t border-white/[0.05]">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                              <span>📁</span> Rich Media & Attachments
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="msg-image" className="text-[9px] text-white/30 font-medium uppercase tracking-wider">Header Image URL</Label>
                              <Input
                                id="msg-image"
                                placeholder="e.g. https://images.unsplash.com/photo-..."
                                value={sel.imageUrl || sel.config?.imageUrl || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  updStep({
                                    imageUrl: val,
                                    config: { ...(sel.config || {}), imageUrl: val }
                                  });
                                }}
                                className={inputCls}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="msg-pdf" className="text-[9px] text-white/30 font-medium uppercase tracking-wider">PDF Document URL</Label>
                              <Input
                                id="msg-pdf"
                                placeholder="e.g. https://example.com/catalog.pdf"
                                value={sel.config?.pdfUrl || sel.config?.fileUrl || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  updStep({
                                    config: { ...(sel.config || {}), pdfUrl: val, fileUrl: val }
                                  });
                                }}
                                className={inputCls}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="msg-link" className="text-[9px] text-white/30 font-medium uppercase tracking-wider">Button Link URL</Label>
                              <Input
                                id="msg-link"
                                placeholder="e.g. https://vaclav.fashion/shop"
                                value={sel.config?.linkUrl || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  updStep({
                                    config: { ...(sel.config || {}), linkUrl: val }
                                  });
                                }}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="node-note" className="text-[10px] font-bold uppercase tracking-widest text-white/25">Note</Label>
                    <Textarea id="node-note" rows={3} value={sel.description || ''} onChange={e => updStep({ description: e.target.value })} disabled={selLocked} className={textCls} />
                  </div>
                </>
              )}
              {propTab === 'mapping' && sel?.type === 'message' && (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/35">
                    Available variable sources are adjusted for the selected trigger event.
                  </div>
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/35">
                    {latestMatchingWebhookLog
                      ? (
                        <div className="space-y-2">
                          <div>
                            Detected {activeWebhookVariableOptions.length} webhook field{activeWebhookVariableOptions.length === 1 ? '' : 's'} from the latest matching {latestMatchingWebhookLog.type} event{latestMatchingWebhookLog.topic ? ` (${latestMatchingWebhookLog.topic})` : ''}.
                          </div>
                          <details className="group">
                            <summary className="text-[10px] text-emerald-400/60 cursor-pointer hover:text-emerald-400 font-bold uppercase tracking-wider list-none flex items-center gap-1">
                              <Search className="w-3 h-3" /> View Raw Payload
                            </summary>
                            <pre className="mt-2 p-2 bg-black/40 rounded border border-white/5 text-[9px] text-white/40 overflow-auto max-h-48 font-mono leading-tight">
                              {JSON.stringify(latestMatchingWebhookLog.payload, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )
                      : 'No matching webhook payload found yet. The dropdown is showing built-in variable options only.'}
                  </div>
                  <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Template Slots</span><span className="text-[10px] text-white/25">{activeTriggerEvent || 'No trigger selected'}</span></div>
                  {(sel.variableMappings || []).map((m, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/25">{m.label || selectedTemplateSlots[i]?.label || `Variable ${i + 1}`}</div>
                      {selectedTemplateSlots[i]?.templateText && (
                        <div className="mt-1.5 rounded-lg bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45">
                          <div className="font-semibold text-white/60">Template text</div>
                          <div className="mt-1 whitespace-pre-wrap">{selectedTemplateSlots[i].templateText}</div>
                        </div>
                      )}
                      {selectedTemplateSlots[i]?.example && (
                        <div className="mt-1 text-[10px] text-white/35">Default example: {selectedTemplateSlots[i].example}</div>
                      )}
                      {sel.template && !msgLocked ? (
                        <div className="mt-2 space-y-2">
                          <Select
                            value={m.mode === 'text' ? 'text' : (m.value || 'text')}
                            onValueChange={value => {
                              const nextMode = value === 'text' ? 'text' : 'token'
                              const nextValue = value === 'text' ? '' : value
                              updStep({
                                variableMappings: (sel.variableMappings || []).map((entry, index) => index === i ? { ...entry, mode: nextMode, value: nextValue } : entry)
                              })
                            }}
                          >
                            <SelectTrigger className={inputCls}><SelectValue placeholder="Choose source" /></SelectTrigger>
                            <SelectContent className="z-[260] bg-[#13151f] border-white/10">
                              {activeVariableOptions.map(option => (
                                <SelectItem key={option.value} value={option.value} className="text-white/70 text-xs focus:bg-white/8 focus:text-white">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {m.mode === 'text' && (
                            <Input
                              value={m.value || ''}
                              onChange={e => updStep({
                                variableMappings: (sel.variableMappings || []).map((entry, index) => index === i ? { ...entry, mode: 'text', value: e.target.value } : entry)
                              })}
                              className={inputCls}
                              placeholder={
                                selectedTemplateSlots[i]?.parameterType === 'media'
                                  ? 'Enter public media URL'
                                  : (selectedTemplateSlots[i]?.example || 'Enter custom text')
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <div className="mt-1.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/50 font-mono">{m.value}</div>
                      )}
                    </div>
                  ))}
                  {selTpl && (
                    <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-3">
                      <div className="text-xs font-semibold text-violet-300">{selTpl.name}</div>
                      <div className="mt-1.5 text-[11px] text-white/35">{getAutomationTemplateBodyText(selTpl) || 'No preview'}</div>
                      <div className="mt-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45">
                        <div className="font-semibold text-white/60">Mapped preview</div>
                        <div className="mt-1 whitespace-pre-wrap">{renderAutomationTemplateBodyPreview(selTpl, sel.variableMappings || []) || 'No body placeholders'}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {propTab === 'mapping' && sel?.type === 'zoho_action' && (
                <div className="space-y-2.5">
                  {sel.action !== 'upsert_lead' ? (
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/35">
                      This action does not require field mappings. Choose "Create or Update Lead" action under Settings tab to define mappings.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-white/[0.05] bg-[#0c0d12] px-3 py-2.5 text-[11px] text-white/35">
                        Define how customer details and custom variables are written to Zoho CRM.
                      </div>
                      
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Standard Lead Mapping</Label>
                          <span className="text-[9px] text-white/30 italic">Required fields</span>
                        </div>

                        {/* Company Field */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-white/70 font-medium">Company *</span>
                          <Input 
                            className={inputCls}
                            value={sel.createFields?.Company ?? ''} 
                            onChange={e => {
                              const createFields = { ...sel.createFields, Company: e.target.value }
                              updStep({ createFields })
                            }}
                            placeholder="e.g. {{company}} or ourname"
                          />
                        </div>

                        {/* Last Name Field */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-white/70 font-medium">Last Name *</span>
                          <Input 
                            className={inputCls}
                            value={sel.createFields?.Last_Name ?? ''} 
                            onChange={e => {
                              const createFields = { ...sel.createFields, Last_Name: e.target.value }
                              updStep({ createFields })
                            }}
                            placeholder="e.g. {{customer_name}}"
                          />
                        </div>
                      </div>

                      {/* Custom Fields Map */}
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-3 space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Custom Field Mappings</Label>
                        
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {Object.entries(sel.createFields || {})
                            .filter(([key]) => key !== 'Company' && key !== 'Last_Name')
                            .map(([key, val]) => (
                              <div key={key} className="flex items-center gap-1.5">
                                <Input 
                                  className="flex-1 bg-white/5 border-white/10 text-xs h-8 text-white/80" 
                                  value={key} 
                                  disabled 
                                />
                                <Input 
                                  className="flex-1 bg-white/5 border-white/10 text-xs h-8" 
                                  value={val || ''} 
                                  onChange={e => {
                                    const createFields = { ...sel.createFields, [key]: e.target.value }
                                    updStep({ createFields })
                                  }}
                                />
                                <Button 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                                  onClick={() => {
                                    const createFields = { ...sel.createFields }
                                    delete createFields[key]
                                    updStep({ createFields })
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                        </div>

                        {/* Add Field Inline Form */}
                        <div className="flex gap-1.5 items-center">
                          <datalist id="zoho-fields-list">
                            <option value="First_Name" />
                            <option value="Email" />
                            <option value="Phone" />
                            <option value="Mobile" />
                            <option value="Lead_Source" />
                            <option value="Lead_Status" />
                            <option value="Industry" />
                            <option value="Website" />
                            <option value="City" />
                            <option value="State" />
                            <option value="Zip_Code" />
                            <option value="Country" />
                            <option value="Description" />
                          </datalist>
                          <Input 
                            id="new-zoho-key" 
                            placeholder="Field API Name" 
                            className="flex-1 bg-white/5 border-white/10 text-xs h-8" 
                            list="zoho-fields-list"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const btn = document.getElementById('add-zoho-field-btn')
                                if (btn) btn.click()
                              }
                            }}
                          />
                          <Input 
                            id="new-zoho-val" 
                            placeholder="Value or {{var}}" 
                            className="flex-1 bg-[#161a2b] border-white/10 text-xs h-8" 
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const btn = document.getElementById('add-zoho-field-btn')
                                if (btn) btn.click()
                              }
                            }}
                          />
                          <Button 
                            id="add-zoho-field-btn"
                            onClick={() => {
                              const keyInput = document.getElementById('new-zoho-key')
                              const valInput = document.getElementById('new-zoho-val')
                              const k = keyInput?.value?.trim()
                              const v = valInput?.value?.trim()
                              if (k) {
                                const createFields = { ...sel.createFields, [k]: v }
                                updStep({ createFields })
                                if (keyInput) keyInput.value = ''
                                if (valInput) valInput.value = ''
                              }
                            }}
                            className="h-8 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 px-3 text-xs shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Clickable Variable Cheat Sheet */}
                      {Array.isArray(activeVariableOptions) && activeVariableOptions.length > 0 && (
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Available Variables</Label>
                            <span className="text-[9px] text-white/30 italic">Click to copy value</span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto pr-1">
                            {activeVariableOptions
                              .filter(opt => opt.value !== 'text')
                              .map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(opt.value)
                                    toast.success(`Copied ${opt.value} to clipboard!`)
                                  }}
                                  className="text-[10px] bg-white/5 hover:bg-orange-500/10 hover:text-orange-400 border border-white/5 hover:border-orange-500/20 text-white/70 px-1.5 py-0.5 rounded transition-all font-mono flex items-center gap-1 select-none text-left cursor-pointer"
                                  title={`Copy: ${opt.label}`}
                                >
                                  <span className="font-semibold text-[10px] text-orange-300">{opt.value}</span>
                                  <span className="text-[8px] text-white/35 font-sans">({opt.label})</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {propTab === 'logs' && (
	                <div className="space-y-2">
	                  <div className={`rounded-xl border p-3 ${activeValidation.errors.length > 0
	                    ? 'border-rose-500/20 bg-rose-500/6'
	                    : activeValidation.warnings.length > 0
	                      ? 'border-amber-500/20 bg-amber-500/6'
	                      : 'border-emerald-500/20 bg-emerald-500/6'}`}>
	                    <div className="flex items-center justify-between gap-3">
	                      <div>
	                        <div className="text-xs font-semibold text-white">Publish readiness</div>
	                        <div className="mt-1 text-[11px] text-white/40">
	                          {activeValidation.errors.length > 0
	                            ? `${activeValidation.errors.length} blocking issue${activeValidation.errors.length === 1 ? '' : 's'}`
	                            : activeValidation.warnings.length > 0
	                              ? `${activeValidation.warnings.length} warning${activeValidation.warnings.length === 1 ? '' : 's'}`
	                              : 'This flow is ready to publish.'}
	                        </div>
	                      </div>
	                      {activeValidation.firstErrorStepId && (
	                        <Button
	                          size="sm"
	                          variant="ghost"
	                          onClick={() => {
	                            setSelId(activeValidation.firstErrorStepId)
	                            setPropTab('settings')
	                          }}
	                          className="h-7 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white"
	                        >
	                          Jump to issue
	                        </Button>
	                      )}
	                    </div>
	                    {(activeValidation.errors.length > 0 || activeValidation.warnings.length > 0) && (
	                      <div className="mt-2 space-y-1.5">
	                        {activeValidation.errors.slice(0, 4).map((issue, index) => (
	                          <div key={`error-${index}`} className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-[10px] text-white/80">
	                            {issue.stepTitle ? `${issue.stepTitle}: ` : ''}{issue.message}
	                          </div>
	                        ))}
	                        {activeValidation.warnings.slice(0, Math.max(0, 4 - activeValidation.errors.length)).map((issue, index) => (
	                          <div key={`warning-${index}`} className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-[10px] text-white/60">
	                            {issue.stepTitle ? `${issue.stepTitle}: ` : ''}{issue.message}
	                          </div>
	                        ))}
	                      </div>
	                    )}
	                  </div>
	                  {lastTest && (
	                    <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-3">
                      <div className="text-xs font-semibold text-violet-300">Last test</div>
                      <div className="mt-1 text-[11px] text-white/35">
                        Source: {lastTest.source === 'dummy' ? 'Dummy data' : 'Latest order'}
                        {lastTest.contextPreview?.order_number ? ` · Order ${lastTest.contextPreview.order_number}` : ''}
                      </div>
                      <div className="mt-2 space-y-1">
                        {(lastTest.results || []).slice(0, 4).map((result, index) => (
                          <div key={index} className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45">
                            <span className="font-semibold text-white/70">{result.stepTitle}</span>
                            {' · '}
                            {result.status}
                            {result.recipient ? ` · ${result.recipient}` : ''}
                            {result.error ? ` · ${result.error}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {automations.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                      <div><div className="text-xs font-semibold text-white/70 truncate max-w-[140px]">{a.name}</div><div className="text-[10px] text-white/25 mt-0.5">{a.steps?.length || 0} nodes</div></div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status ? 'bg-emerald-500/12 text-emerald-400' : 'bg-white/[0.05] text-white/25'}`}>{a.status ? 'Running' : 'Stopped'}</span>
                    </div>
                  ))}
                  {activityLogs.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-white/50 px-1">Recent Activity</div>
                      {activityLogs.map((log, i) => (
                        <div key={log.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-violet-400">@{log.recipient}</span>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2))
                                  toast.success('Event data copied')
                                }}
                                className="p-1 rounded-md hover:bg-white/10 text-white/20 hover:text-white/60 transition-colors"
                                title="Copy JSON for mapping"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              <span className="text-[10px] text-white/20">{new Date(log.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          {log.payload && (
                            <div className="rounded-lg bg-black/40 p-2 overflow-hidden">
                              <pre className="text-[9px] text-white/40 font-mono overflow-x-auto">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {activityLogs.length === 0 && !fetchingLogs && (
                    <div className="rounded-xl border border-dashed border-white/8 p-8 text-[11px] text-white/20 text-center">
                      <Zap className="h-5 w-5 mx-auto mb-2 opacity-20" />
                      No recent events for this automation
                    </div>
                  )}
                  {fetchingLogs && (
                    <div className="text-center py-8">
                       <div className="h-4 w-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2 opacity-50" />
                       <span className="text-[10px] text-white/20">Loading activity...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
	          </ScrollArea>
	          <div className="px-4 pb-4 pt-3 border-t border-white/[0.05] space-y-2">
	            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/45">
	              <div className="font-semibold text-white/65">{saveLabel}</div>
	              <div className="mt-1">{saveDescription}</div>
	            </div>
	            <Button variant="ghost" aria-label="Discard draft and reset the current flow"
	              onClick={resetActiveFlowToDefault}
	              className="w-full rounded-xl text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/8 text-xs font-bold h-8 transition-all active:scale-95">Discard Draft</Button>
          </div>
          </aside>
        </>
      )}
    </div>
    {/* NEW FLOW DIALOG — rendered at root so overflow can't clip it */}
      <Dialog open={dlgOpen} onOpenChange={v => { setDlgOpen(v); if (!v) { setDraftName(''); setMode('blank'); setCloneSourceId((cloneSourceOptions.some(flow => flow.id === active?.id) ? active?.id : cloneSourceOptions[0]?.id) || '') } }}>
        <DialogContent overlayClassName="z-[200]" className="bg-[#13151f] border border-white/10 text-white sm:max-w-[500px] z-[200]">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Create automation</DialogTitle>
            <DialogDescription className="text-white/40 text-sm">Name the flow, pick a starting point, then build on the canvas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="flow-name" className="text-[10px] font-bold uppercase tracking-widest text-white/30">Flow Name</Label>
              <Input
                id="flow-name"
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. Post-delivery feedback"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl focus:border-violet-500/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { m: 'template', icon: Copy, title: 'Clone template', desc: 'Duplicate one of your existing flows and edit from there' },
                { m: 'blank', icon: Sparkles, title: 'Blank canvas', desc: 'Start with one trigger and build from scratch' }
              ].map(({ m, icon: Icon, title, desc }) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`rounded-xl border p-4 text-left transition-all duration-200 ${mode === m
                    ? 'border-violet-500/60 bg-violet-600/10 shadow-[0_0_0_1px_rgba(139,92,246,0.3)]'
                    : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/12'
                    }`}>
                  <Icon className="h-4 w-4 mb-3 text-violet-400" aria-hidden="true" />
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-xs text-white/40 leading-relaxed">{desc}</div>
                </button>
              ))}
            </div>
            {mode === 'template' && (
              <div className="space-y-1.5">
                <Label htmlFor="clone-source" className="text-[10px] font-bold uppercase tracking-widest text-white/30">Clone From</Label>
                <Select value={cloneSourceId} onValueChange={setCloneSourceId} disabled={cloneSourceOptions.length === 0}>
                  <SelectTrigger id="clone-source" className="bg-white/5 border-white/10 text-white rounded-xl focus:border-violet-500/50">
                    <SelectValue placeholder={cloneSourceOptions.length ? 'Choose flow to clone' : 'No flows available'} />
                  </SelectTrigger>
                  <SelectContent className="z-[260] max-h-80 overflow-y-auto border-white/10 bg-[#13151f] text-white">
                    {createdCloneableAutomations.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Created Flows</SelectLabel>
                        {createdCloneableAutomations.map(flow => (
                          <SelectItem key={flow.id} value={flow.id} className="text-white/80 text-xs focus:bg-white/8 focus:text-white">
                            {flow.name}{flow.id === active?.id ? ' (current)' : ''} • created
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {createdCloneableAutomations.length > 0 && defaultCloneableAutomations.length > 0 && (
                      <SelectSeparator className="my-1 bg-white/8" />
                    )}
                    {defaultCloneableAutomations.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Default Templates</SelectLabel>
                        {defaultCloneableAutomations.map(flow => (
                          <SelectItem key={flow.id} value={flow.id} className="text-white/80 text-xs focus:bg-white/8 focus:text-white">
                            {flow.name}{flow.id === active?.id ? ' (current)' : ''} • default
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/35">
                  {cloneSourceOptions.length
                    ? `Showing ${createdCloneableAutomations.length} created flow${createdCloneableAutomations.length === 1 ? '' : 's'} and ${defaultCloneableAutomations.length} default template${defaultCloneableAutomations.length === 1 ? '' : 's'} to clone from.`
                    : 'Create one flow first before using clone template.'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDlgOpen(false)} className="text-white/50 hover:text-white hover:bg-white/8">Cancel</Button>
            <Button type="button" onClick={handleCreate} disabled={mode === 'template' && !cloneSourceId} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold disabled:opacity-40 disabled:hover:bg-violet-600">
              <CopyPlus className="mr-2 h-4 w-4" />Create flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
