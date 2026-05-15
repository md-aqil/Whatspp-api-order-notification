import { NextResponse } from 'next/server'
import { generateAIResponseWithBranding, generateAISuggestions } from '@/lib/ai'
import { queryMany } from '@/lib/postgres'
import { getStoredMessagesByPhone } from '@/lib/db/chat-repository'

export const dynamic = 'force-dynamic'

/**
 * AI Respond endpoint - generates AI response using branding from database
 */
export async function POST(req) {
  try {
    const { message, userId = 'default', history = [] } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Fetch knowledge base
    const knowledgeItems = await queryMany(
      'SELECT title, content FROM knowledge_base WHERE userId = ?',
      [userId]
    )
    const knowledgeBase = knowledgeItems.map(item => `${item.title}: ${item.content}`).join('\n\n')

    // Use branding-aware AI response
    const response = await generateAIResponseWithBranding(message, knowledgeBase, userId, history)

    return NextResponse.json({ response, success: true })
  } catch (error) {
    console.error('AI Respond error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}