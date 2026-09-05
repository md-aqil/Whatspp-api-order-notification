import { NextResponse } from 'next/server'
import { generateAIResponse } from '@/lib/ai'
import { getStoredIntegrations } from '@/lib/db/integration-repository'

/**
 * LLM-suggested A/B variants for a marketing message.
 *
 *   POST /api/ai/variants
 *     body: {
 *       baseMessage: string,
 *       goal: 'click_through' | 'reply' | 'purchase' | 'opt_in',
 *       tone?: 'friendly' | 'urgent' | 'playful' | 'professional',
 *       count?: number (1-5, default 3)
 *     }
 *
 * Returns the original + 3 alternative framings. The alternatives keep the
 * same placeholders ({{customer_name}} etc.) so they can be dropped into
 * the existing ab_split step directly.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const baseMessage = String(body.baseMessage || '').trim()
    if (!baseMessage) {
      return NextResponse.json({ success: false, error: 'baseMessage is required' }, { status: 400 })
    }
    const goal = body.goal || 'click_through'
    const tone = body.tone || 'friendly'
    const count = Math.min(Math.max(parseInt(body.count || 3, 10) || 3, 1), 5)

    const userId = body.userId || 'default'
    const integrations = await getStoredIntegrations(userId).catch(() => ({}))
    const businessName = integrations?.branding?.businessName || process.env.BUSINESS_NAME || 'Our Business'

    const prompt = `You are a WhatsApp marketing copywriter. Given an existing message and a goal, propose ${count} alternative framings for an A/B test.

Original message:
"""
${baseMessage}
"""

Goal: ${goal}
Tone: ${tone}

Hard rules:
- Keep the same placeholders (anything in {{double_braces}}) verbatim.
- Each alternative must be 1-3 short lines, WhatsApp-friendly (no markdown headings).
- Don't invent products, prices, or contact info that isn't in the original.
- Output strictly as a JSON array of strings, in the same language as the original. No commentary.

Example output: ["alt 1", "alt 2", "alt 3"]`

    const raw = await generateAIResponse(prompt, [], businessName, [])
    const parsed = extractJsonArray(raw)

    const alternatives = Array.isArray(parsed) ? parsed.slice(0, count) : []
    return NextResponse.json({
      success: true,
      original: baseMessage,
      goal,
      tone,
      count: alternatives.length,
      variants: alternatives
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function extractJsonArray(text) {
  if (!text) return null
  // Find the first [ ... ] span, tolerating stray backticks / commentary
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch (e) {
    return null
  }
}