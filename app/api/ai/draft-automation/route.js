import { NextResponse } from 'next/server'
import { generateAIResponse } from '@/lib/ai'
import { getStoredIntegrations } from '@/lib/db/integration-repository'

const KNOWN_STEP_TYPES = [
  'trigger', 'message', 'interactive', 'condition', 'delay', 'ai', 'switch',
  'ab_split', 'shopify_discount', 'shopify_refund', 'shopify_gift_card',
  'product_list', 'product_carousel', 'single_product', 'channel_post',
  'add_to_wishlist', 'back_in_stock_subscribe', 'inventory_snapshot',
  'record_feedback', 'assign_referral', 'spin_wheel',
  'tag_audience', 'business_hours', 'language_detect', 'handoff_summary',
  'opt_in', 'send_optin_prompt', 'vip_perk'
]

/**
 * LLM-suggested automation draft from a natural language prompt.
 *
 *   POST /api/ai/draft-automation
 *     body: { prompt: string, userId?: string }
 *
 * Returns a step graph (JSON) the caller can review and save.
 * Restricted to step types the engine already knows about.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const prompt = String(body.prompt || '').trim()
    const userId = body.userId || 'default'
    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt required' }, { status: 400 })
    }

    const integrations = await getStoredIntegrations(userId).catch(() => ({}))
    const businessName = integrations?.branding?.businessName || process.env.BUSINESS_NAME || 'Our Business'

    const system = `You design WhatsApp automation graphs for a tool called ChatFlow.
Available step types (use exactly these strings):
${KNOWN_STEP_TYPES.join(', ')}

Output a single JSON object with this shape:
{
  "name": "string",
  "summary": "string",
  "source": "Shopify" | "WhatsApp" | "Customer Profile" | "Custom",
  "steps": [
    {
      "id": "step-...",
      "type": "trigger|message|...",
      "title": "string",
      "description": "string",
      "event"?: "string",         // for trigger steps
      "config"?: { ... },         // free-form, depends on step type
      "message"?: "string",       // for message steps
      "options"?: [{ id, label }],// for interactive steps
      "position": { "x": number, "y": number },
      "connections": { "main": "next-step-id", "fallback"?: "step-id", "option-id"?: "step-id" }
    }
  ]
}

Rules:
- The first step must be a trigger with an "event" (e.g. "shopify.order_created", "whatsapp.message_received", "customer.win_back").
- Each step needs a unique id and a connection map (use "main" for the happy path).
- Use concise business-friendly titles.
- Reply with STRICT JSON only, no commentary.`

    const raw = await generateAIResponse(`${system}\n\nUser prompt: ${prompt}`, [], businessName, [])
    const draft = extractJson(raw)
    if (!draft || !Array.isArray(draft.steps)) {
      return NextResponse.json({ success: false, error: 'model_returned_unparseable_json', raw: String(raw).slice(0, 1000) }, { status: 502 })
    }
    // Sanity-check: every step type must be known
    const warnings = []
    for (const s of draft.steps) {
      if (!s?.id || !s?.type) warnings.push({ id: s?.id, reason: 'missing_id_or_type' })
      else if (!KNOWN_STEP_TYPES.includes(s.type)) warnings.push({ id: s.id, reason: 'unknown_step_type', type: s.type })
    }
    return NextResponse.json({
      success: true,
      prompt,
      draft,
      warnings,
      acceptedStepTypes: KNOWN_STEP_TYPES
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function extractJson(text) {
  if (!text) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch (e) { return null }
}