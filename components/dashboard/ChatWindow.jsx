'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ChatWindow({ chat, messages, onSendMessage }) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevMessageCountRef = useRef(messages.length)
  const isInitialRenderRef = useRef(true)
  const incomingSoundRef = useRef(null)
  const outgoingSoundRef = useRef(null)

  // Initialize sound effects
  useEffect(() => {
    incomingSoundRef.current = new Audio('/sounds/incoming-message.mp3')
    outgoingSoundRef.current = new Audio('/sounds/outgoing-message.mp3')
    
    // Cleanup
    return () => {
      if (incomingSoundRef.current) {
        incomingSoundRef.current = null
      }
      if (outgoingSoundRef.current) {
        outgoingSoundRef.current = null
      }
    }
  }, [])

  // Play sound effect
  const playSound = (soundRef) => {
    try {
      if (soundRef.current) {
        soundRef.current.currentTime = 0
        soundRef.current.play().catch(e => console.log("Sound play prevented by browser policy"))
      }
    } catch (error) {
      console.log("Sound could not be played", error)
    }
  }

  // Check if user is at the bottom of the chat
  const isUserAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const threshold = 50 // pixels from bottom
      return scrollHeight - scrollTop - clientHeight < threshold
    }
    return true
  }

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Handle scrolling when messages change
  useEffect(() => {
    const currentMessageCount = messages.length
    const hasNewMessages = currentMessageCount > prevMessageCountRef.current
    
    // On initial render, always scroll to bottom
    if (isInitialRenderRef.current) {
      scrollToBottom()
      isInitialRenderRef.current = false
    } 
    // If user sent a message (added by user), scroll to bottom and play outgoing sound
    else if (hasNewMessages && messages[messages.length - 1]?.isCustomer === false) {
      scrollToBottom()
      playSound(outgoingSoundRef)
    } 
    // If user is at bottom and new messages arrive, scroll to bottom and play incoming sound
    else if (hasNewMessages && isUserAtBottom()) {
      scrollToBottom()
      playSound(incomingSoundRef)
    }
    // If new message arrives but user is not at bottom, play incoming sound only
    else if (hasNewMessages && !isUserAtBottom()) {
      playSound(incomingSoundRef)
    }
    
    // Update the previous message count
    prevMessageCountRef.current = currentMessageCount
  }, [messages])

  // Handle scroll events
  const handleScroll = () => {
    // We don't need to do anything here, just let the natural scroll happen
  }

  // Set up scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return
    onSendMessage(inputValue)
    setInputValue('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date) => {
    try {
      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return 'Invalid time'
      }
      return format(dateObj, 'h:mm a')
    } catch (error) {
      return 'Invalid time'
    }
  }

  return (
    <div className="flex h-full flex-col rounded-[1.5rem] border border-slate-200/70 bg-white/90 shadow-[0_24px_50px_-36px_rgba(5,52,92,0.45)] dark:border-white/[0.06] dark:bg-[#0d0f17] dark:shadow-none">
      {/* Chat Header - Fixed to top */}
      <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50/85 p-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03]">
        <div className="flex items-center">
          <img
            src={chat.avatar}
            alt={chat.name}
            className="w-10 h-10 rounded-full object-cover mr-3"
          />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{chat.name}</h3>
            <p className="text-xs text-slate-500 dark:text-white/35">{chat.phone}</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100/80 p-4 dark:bg-[#11131d]"
      >
        <div className="space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isCustomer ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-xs md:max-w-md px-3 py-2 rounded-lg ${
                  message.isCustomer
                    ? 'rounded-tl-none bg-white text-slate-800 shadow-sm dark:bg-white/[0.06] dark:text-white'
                    : 'rounded-tr-none bg-emerald-100 text-slate-800 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-50'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.isCustomer ? 'text-slate-500 dark:text-white/35' : 'text-slate-600 dark:text-emerald-100/70'
                  } text-right`}
                >
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200/70 bg-white/95 p-3 dark:border-white/[0.06] dark:bg-[#0d0f17]">
        <div className="flex items-end space-x-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message"
            className="flex-1 resize-none rounded-full border border-slate-200/80 bg-white px-4 py-2 text-slate-900 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25"
            rows="1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={inputValue.trim() === ''}
            size="icon"
            className="rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:brightness-110"
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  )
}
