'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Send, MessageSquare, Sparkles, X, Bot, Image, Loader2 } from 'lucide-react'

/**
 * ChatflowWidgetIframe - The iframe content rendered by the widget embed script.
 * This is a standalone page that lives inside an iframe for isolation.
 */
export default function ChatflowWidgetIframe() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId') || 'default'
  const bgColor = searchParams.get('bgColor') || '#005cc0'
  const botName = searchParams.get('botName') || 'Support Bot'
  const businessName = searchParams.get('businessName') || 'Our Business'
  const welcomeMessage = searchParams.get('welcomeMessage') || 'Hello! How can I help you today?'
  const logoUrl = searchParams.get('logoUrl') || null
  const position = searchParams.get('position') || 'bottom-right'

  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isWelcomeSent, setIsWelcomeSent] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Send welcome message on first load
  useEffect(() => {
    if (!isWelcomeSent) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `welcome_${Date.now()}`,
          text: welcomeMessage,
          isCustomer: false,
          timestamp: new Date()
        }])
        setIsWelcomeSent(true)
      }, 500)
    }
  }, [isWelcomeSent, welcomeMessage])

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return

    const userMessage = {
      id: `msg_${Date.now()}`,
      text: inputValue.trim(),
      isCustomer: true,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setSuggestions([])
    setIsLoading(true)

    try {
      // Try sending via WhatsApp API first
      const res = await fetch('/api/send-whatsapp-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          userId
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.response) {
          setMessages(prev => [...prev, {
            id: `bot_${Date.now()}`,
            text: data.response,
            isCustomer: false,
            timestamp: new Date()
          }])
        }
      } else {
        // Fallback: AI response
        const aiRes = await fetch('/api/ai/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.text,
            userId,
            history: messages.map(m => ({
              message: m.text,
              isCustomer: m.isCustomer
            }))
          })
        })

        if (aiRes.ok) {
          const aiData = await aiRes.json()
          setMessages(prev => [...prev, {
            id: `bot_${Date.now()}`,
            text: aiData.response || aiData.text || "I'll look into that for you.",
            isCustomer: false,
            timestamp: new Date()
          }])
        }
      }
    } catch (error) {
      console.error('Send error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSuggestions = async () => {
    if (!inputValue.trim()) { setSuggestions([]); return; }
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          userId,
          history: messages.slice(-10).map(m => ({
            message: m.text,
            isCustomer: m.isCustomer
          }))
        })
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Suggestions error:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (inputValue.trim()) fetchSuggestions() }, 500)
    return () => clearTimeout(timer)
  }, [inputValue])

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() }
  }

  const showWelcome = messages.length === 0 && !isLoading

  return (
    <div className="chatflow-iframe-widget" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: bgColor, color: '#fff' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="w-full h-full object-cover" />
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-[13px] leading-tight">{businessName}</h3>
            <span className="text-[10px] opacity-75">{botName} · Online</span>
          </div>
        </div>
        <button
          onClick={() => window.parent.postMessage({ type: 'chatflow-close' }, '*')}
          className="rounded-full p-1.5 hover:bg-white/20 transition-colors text-white"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-gray-50 h-[400px]">
        {showWelcome && (
          <div className="flex items-start gap-2.5 animate-in fade-in">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: bgColor + '1a', color: bgColor }}>
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm"
              style={{ backgroundColor: bgColor + '10' }}>
              <p className="font-medium mb-0.5" style={{ color: bgColor }}>{botName}</p>
              <p className="text-gray-600 text-[13px]">{welcomeMessage}</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.isCustomer ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`relative max-w-[80%] px-3 py-2 text-sm leading-relaxed shadow-sm rounded-2xl ${
                msg.isCustomer
                  ? 'bg-white text-gray-800 border border-gray-100 rounded-tr-none'
                  : 'border border-gray-100/50 rounded-tl-none text-gray-800'
              }`}
              style={!msg.isCustomer ? { backgroundColor: bgColor + '0d', borderLeft: `3px solid ${bgColor}` } : {}}
            >
              <span className="whitespace-pre-wrap">{msg.text}</span>
              <div className={`flex justify-end mt-0.5 ${msg.isCustomer ? '' : 'opacity-40'}`}>
                <span className="text-[9px] text-gray-400">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: bgColor + '1a', color: bgColor }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="flex gap-1.5 items-center" style={{ color: bgColor }}>
              <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: bgColor, animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: bgColor, animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: bgColor, animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {suggestions.length > 0 && (
        <div className="border-t bg-white/90 backdrop-blur-sm px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s, i) => (
              <button key={i}
                onClick={() => { setInputValue(s); setSuggestions([]) }}
                className="text-[10px] font-medium px-2 py-1 rounded-full border transition-all"
                style={{ color: bgColor, borderColor: bgColor + '40', backgroundColor: bgColor + '0d' }}
              >{s}</button>
            ))}
            <button onClick={() => setSuggestions([])} className="p-1 text-gray-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows="1"
            className="flex-1 resize-none border border-gray-200 bg-gray-50 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{ '--tw-ring-color': bgColor }}
          />
          <button
            onClick={handleSendMessage}
            disabled={inputValue.trim() === '' || isLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow disabled:opacity-40 transition-all"
            style={{ backgroundColor: inputValue.trim() && !isLoading ? bgColor : 'transparent', color: inputValue.trim() && !isLoading ? '#fff' : bgColor }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}