import { NextResponse } from 'next/server'
import { generateAISuggestions } from '@/lib/ai'
import { requireRequestUserId } from '@/lib/request-user'
import { queryMany } from '@/lib/postgres' // postgres.js is actually mysql
import { getStoredMessagesByPhone } from '@/lib/db/chat-repository'

export async function POST(req) {
  try {
    const userId = requireRequestUserId(req)
    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    // 1. Fetch Knowledge Base from MySQL (via postgres.js helper)
    const knowledgeItems = await queryMany(
      'SELECT title, content FROM knowledge_base WHERE userId = ?',
      [userId]
    )
    const knowledgeBase = knowledgeItems.map(item => `${item.title}: ${item.content}`).join('\n\n')

    // 2. Fetch Chat History (last 10 messages)
    const messages = await getStoredMessagesByPhone(phone, userId)
    const lastMessages = messages.slice(-10)

    if (lastMessages.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    const lastCustomerMessageObj = [...lastMessages].reverse().find(m => m.isCustomer)
    const lastCustomerMessage = lastCustomerMessageObj?.message || ''

    // 3. Generate Suggestions using Gemini
    const suggestions = await generateAISuggestions(lastCustomerMessage, knowledgeBase, lastMessages)
    
    return NextResponse.json({ suggestions })

  } catch (error) {
    console.error('AI Suggestions Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
