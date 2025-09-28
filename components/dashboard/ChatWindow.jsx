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
    <div className="flex flex-col h-full">
      {/* Chat Header - Fixed to top */}
      <div className="border-b p-4 sticky -top-6 bg-white z-10">
        <div className="flex items-center">
          <img
            src={chat.avatar}
            alt={chat.name}
            className="w-10 h-10 rounded-full object-cover mr-3"
          />
          <div>
            <h3 className="font-semibold text-gray-900">{chat.name}</h3>
            <p className="text-xs text-gray-500">{chat.phone}</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-gray-50"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex mb-4 ${message.isCustomer ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                message.isCustomer
                  ? 'bg-gray-200 text-gray-800 rounded-tl-none'
                  : 'bg-blue-500 text-white rounded-tr-none'
              }`}
            >
              <p className="text-sm">{message.text}</p>
              <p
                className={`text-xs mt-1 ${
                  message.isCustomer ? 'text-gray-500' : 'text-blue-100'
                } text-right`}
              >
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-white">
        <div className="flex items-end space-x-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 resize-none"
            rows="1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={inputValue.trim() === ''}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}