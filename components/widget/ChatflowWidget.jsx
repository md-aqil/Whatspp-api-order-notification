'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, MessageSquare, Sparkles, X, Bot, Image, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

/**
 * ChatflowWidget - Embeddable chatbot widget with full branding support.
 *
 * Props:
 * - userId: string - The user/account ID to load branding for
 * - position: 'bottom-right' | 'bottom-left' - Widget position
 * - logoUrl: string - Override logo URL
 * - businessName: string - Override business name
 * - botName: string - Override bot name
 * - welcomeMessage: string - Override welcome message
 * - primaryColor: string - Override primary color (hex)
 * - fontFamily: string - Override font family
 */
export function ChatflowWidget({
  userId = 'default',
  position = 'bottom-right',
  logoUrl: logoUrlProp,
  businessName: businessNameProp,
  botName: botNameProp,
  welcomeMessage: welcomeMessageProp,
  primaryColor: primaryColorProp,
  fontFamily: fontFamilyProp
} = {}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [branding, setBranding] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load branding from API
  useEffect(() => {
    async function loadBranding() {
      try {
        const res = await fetch(`/api/branding?userId=${encodeURIComponent(userId)}`, {
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setBranding(data.branding)
          }
        }
      } catch (error) {
        console.error('Failed to load branding:', error)
      }
    }
    loadBranding()
  }, [userId])

  // Resolve branding values (prop overrides > DB > defaults)
  const resolvedBranding = {
    logoUrl: logoUrlProp || branding?.logoUrl || null,
    businessName: businessNameProp || branding?.businessName || 'Our Business',
    botName: botNameProp || branding?.botName || 'Support Bot',
    welcomeMessage: welcomeMessageProp || branding?.welcomeMessage || 'Hello! How can I help you today?',
    primaryColor: primaryColorProp || branding?.primaryColor || '#005cc0',
    fontFamily: fontFamilyProp || branding?.fontFamily || 'Inter',
    position: position,
    enabled: branding?.enabled ?? true
  }

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Send message handler
  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return

    const userMessage = { id: `msg_${Date.now()}`, text: inputValue.trim(), isCustomer: true, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setSuggestions([])
    setIsLoading(true)

    try {
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
          const botMessage = {
            id: `bot_${Date.now()}`,
            text: data.response,
            isCustomer: false,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        }
      } else {
        // Try AI fallback
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
          const botMessage = {
            id: `bot_${Date.now()}`,
            text: aiData.response || aiData.text || "I'm looking into that for you.",
            isCustomer: false,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        } else {
          const botMessage = {
            id: `bot_${Date.now()}`,
            text: "I'll transfer you to a specialist member of our team right away. Please stay tuned! 👨‍💻",
            isCustomer: false,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        }
      }
    } catch (error) {
      console.error('Send message error:', error)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch AI suggestions
  const fetchSuggestions = async () => {
    if (!inputValue.trim()) return
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
      console.error('Failed to fetch suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        fetchSuggestions()
      } else {
        setSuggestions([])
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [inputValue])

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Welcome message when chat opens with no messages
  const showWelcome = messages.length === 0 && !isLoading

  // Position classes
  const positionClasses = resolvedBranding.position === 'bottom-left'
    ? 'bottom-4 left-4'
    : 'bottom-4 right-4'

  const widgetStyles = {
    fontFamily: resolvedBranding.fontFamily,
    '--brand-color': resolvedBranding.primaryColor,
    '--brand-light': resolvedBranding.primaryColor + '15',
    '--brand-hover': resolvedBranding.primaryColor + 'cc'
  }

  if (!resolvedBranding.enabled) return null

  return (
    <div className="chatflow-widget" style={widgetStyles}>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatflow-toggle-btn fixed z-[999999] w-14 h-14 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center text-white"
          style={{ backgroundColor: resolvedBranding.primaryColor, bottom: position === 'bottom-left' ? 24 : undefined, right: position !== 'bottom-left' ? 24 : undefined, left: position === 'bottom-left' ? 24 : undefined }}
          aria-label="Open chat"
        >
          {resolvedBranding.logoUrl ? (
            <img
              src={resolvedBranding.logoUrl}
              alt={resolvedBranding.businessName}
              className="w-8 h-8 rounded-full object-contain bg-white/20 p-0.5"
            />
          ) : (
            <MessageSquare className="w-6 h-6" />
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-[999999] bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-300 ${
            isMobile
              ? 'inset-0 w-full h-full rounded-none'
              : 'w-[400px] h-[560px]'
          }`}
          style={{
            [position === 'bottom-left' ? 'bottom' : 'bottom']: isMobile ? 0 : '40px',
            [position === 'bottom-left' ? 'left' : 'right']: isMobile ? 0 : '40px',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800"
            style={{ backgroundColor: resolvedBranding.primaryColor, color: '#fff' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shadow-sm">
                {resolvedBranding.logoUrl ? (
                  <img
                    src={resolvedBranding.logoUrl}
                    alt={resolvedBranding.businessName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-sm leading-tight">{resolvedBranding.businessName}</h3>
                <span className="text-[11px] opacity-80">{resolvedBranding.botName} · Online</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/20 transition-colors text-white"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#0f0f1e]"
            style={{
              backgroundImage: `radial-gradient(${resolvedBranding.primaryColor}12 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }}
          >
            {/* Welcome Message */}
            {showWelcome && (
              <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: resolvedBranding.primaryColor + '20', color: resolvedBranding.primaryColor }}
                >
                  <Bot className="w-4 h-4" />
                </div>
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                  style={{ backgroundColor: resolvedBranding.primaryColor + '12', color: '#374151' }}
                >
                  <p className="font-medium" style={{ color: resolvedBranding.primaryColor }}>
                    {resolvedBranding.botName}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">{resolvedBranding.welcomeMessage}</p>
                </div>
              </div>
            )}

            {/* Message History */}
            {messages.map((message, idx) => (
              <div
                key={message.id || idx}
                className={`flex ${message.isCustomer ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative max-w-[80%] px-4 py-2.5 shadow-sm backdrop-blur-md transition-all rounded-2xl text-sm leading-relaxed break-words ${
                    message.isCustomer
                      ? 'bg-white dark:bg-[#2a2a3e] text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tr-none'
                      : 'border border-gray-100/50 dark:border-gray-700/50 rounded-tl-none text-gray-800 dark:text-gray-100'
                  }`}
                  style={!message.isCustomer ? { backgroundColor: resolvedBranding.primaryColor + '12', borderLeft: `3px solid ${resolvedBranding.primaryColor}` } : {}}
                >
                  <span className="whitespace-pre-wrap font-normal">{message.text}</span>
                  <div className={`flex items-center justify-end mt-1 ${message.isCustomer ? '' : 'opacity-40'}`}>
                    <span className="text-[10px] font-medium tabular-nums text-gray-400">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: resolvedBranding.primaryColor + '20', color: resolvedBranding.primaryColor }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm"
                  style={{ backgroundColor: resolvedBranding.primaryColor + '12' }}
                >
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: resolvedBranding.primaryColor, animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: resolvedBranding.primaryColor, animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: resolvedBranding.primaryColor, animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#1a1a2e]/80 backdrop-blur-md px-4 py-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3 h-3" style={{ color: resolvedBranding.primaryColor }} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Quick Replies</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputValue(suggestion)
                      setSuggestions([])
                    }}
                    className="text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all whitespace-nowrap hover:shadow-sm"
                    style={{
                      color: resolvedBranding.primaryColor,
                      borderColor: resolvedBranding.primaryColor + '40',
                      backgroundColor: resolvedBranding.primaryColor + '0d'
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
                <button
                  onClick={() => setSuggestions([])}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a2e] px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                className="flex-shrink-0 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                style={{ color: resolvedBranding.primaryColor }}
              >
                <Image className="w-5 h-5" />
              </button>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                rows="1"
                className="flex-1 resize-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#25253e] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all text-sm"
                style={{
                  '--tw-ring-color': resolvedBranding.primaryColor,
                  fontFamily: resolvedBranding.fontFamily
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={inputValue.trim() === '' || isLoading}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: inputValue.trim() && !isLoading ? resolvedBranding.primaryColor : 'transparent',
                  color: inputValue.trim() && !isLoading ? '#fff' : resolvedBranding.primaryColor
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Powered By Footer */}
          <div className="text-center py-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0f0f1e]">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              Powered by <span className="font-bold" style={{ color: resolvedBranding.primaryColor }}>Chatflow</span>
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .chatflow-toggle-btn {
          transition: bottom 0.3s ease, right 0.3s ease, left 0.3s ease;
        }
        @media (max-width: 768px) {
          .chatflow-toggle-btn {
            bottom: 16px !important;
            right: 16px !important;
            left: auto !important;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Server-side helper to render the widget script tag
 */
export function ChatflowWidgetScript(props) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function(w,d,t){
  var s=d.createElement(t),p=d.getElementsByTagName(t)[0];
  s.async=true;s.src='/api/widget/chatflow.js';
  s.dataset.userId='${props.userId || 'default'}';
  s.dataset.position='${props.position || 'bottom-right'}';
  ${props.logoUrl ? "s.dataset.logoUrl='"+props.logoUrl+"'":""}
  ${props.businessName ? "s.dataset.businessName='"+props.businessName+"'":""}
  ${props.botName ? "s.dataset.botName='"+props.botName+"'":""}
  ${props.primaryColor ? "s.dataset.primaryColor='"+props.primaryColor+"'":""}
  ${props.welcomeMessage ? "s.dataset.welcomeMessage='"+props.welcomeMessage.replace(/'/g,"\\'")+"'":""}
  p.parentNode.insertBefore(s,p);
})(window,document,'script');
        `
      }}
    />
  )
}
