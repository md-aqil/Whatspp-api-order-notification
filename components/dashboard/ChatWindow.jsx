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
    <div className="flex h-full flex-col bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between bg-[#f0f2f5] px-4 py-2 dark:bg-[#202c33] dark:border-white/5 border-b border-gray-200">
        <div className="flex items-center cursor-pointer">
          <div className="relative">
            <img
              src={chat.avatar || 'https://i.pravatar.cc/150'}
              alt={chat.name}
              className="w-10 h-10 rounded-full object-cover mr-3"
            />
            <div className="absolute bottom-0 right-3 w-3 h-3 bg-emerald-500 border-2 border-[#f0f2f5] dark:border-[#202c33] rounded-full"></div>
          </div>
          <div>
            <h3 className="font-medium text-[#111b21] dark:text-[#e9edef] text-base leading-tight">{chat.name}</h3>
            <p className="text-xs text-[#667781] dark:text-[#8696a0]">online</p>
          </div>
        </div>
        <div className="flex items-center space-x-5 text-[#54656f] dark:text-[#aebac1]">
          <button className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" fill="currentColor"><path d="M15.9,14.3H15L14.7,14c1-1.1,1.6-2.7,1.6-4.3c0-3.7-3-6.7-6.7-6.7S3,6,3,9.7s3,6.7,6.7,6.7c1.6,0,3.2-0.6,4.3-1.6l0.3,0.3v0.8l5.1,5.1l1.5-1.5L15.9,14.3z M9.7,14.3c-2.6,0-4.6-2.1-4.6-4.6s2.1-4.6,4.6-4.6s4.6,2.1,4.6,4.6S12.2,14.3,9.7,14.3z"></path></svg>
          </button>
          <button className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" fill="currentColor"><path d="M12,7c1.1,0,2-0.9,2-2s-0.9-2-2-2s-2,0.9-2,2S10.9,7,12,7z M12,9c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S13.1,9,12,9z M12,15c-1.1,0-2,0.9-2,2s0.9,2,2,2s2-0.9,2-2S13.1,15,12,15z"></path></svg>
          </button>
        </div>
      </div>

      {/* Messages Container with WhatsApp Wallpaper */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-[#efeae2] dark:bg-[#0b141a] relative"
        style={{ 
          backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
          backgroundBlendMode: 'overlay',
          backgroundSize: '400px'
        }}
      >
        <div className="p-5 space-y-2">
          {messages.map((message, idx) => {
            const isLastInGroup = idx === messages.length - 1 || messages[idx+1]?.isCustomer !== message.isCustomer;
            
            return (
              <div
                key={message.id}
                className={`flex w-full mb-1 ${message.isCustomer ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`relative max-w-[85%] md:max-w-[65%] px-2.5 py-1.5 shadow-sm ${
                    message.isCustomer
                      ? 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-r-lg rounded-bl-lg'
                      : 'bg-[#dcf8c6] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-l-lg rounded-br-lg'
                  } ${!isLastInGroup ? 'rounded-lg' : ''}`}
                >
                  {/* Message Tail */}
                  {isLastInGroup && (
                    <div className={`absolute top-0 w-2 h-2.5 ${message.isCustomer ? '-left-2 bg-white dark:bg-[#202c33] [clip-path:polygon(100%_0,0_0,100%_100%)]' : '-right-2 bg-[#dcf8c6] dark:bg-[#005c4b] [clip-path:polygon(0_0,100%_0,0_100%)]'}`}></div>
                  )}
                  
                  <div className="flex flex-col">
                    <span className="text-[14.2px] leading-relaxed break-words">{message.text}</span>
                    <div className="flex items-center justify-end space-x-1 -mt-1 ml-4 select-none">
                      <span className="text-[11px] text-[#667781] dark:text-[#8696a0] uppercase">
                        {formatTime(message.timestamp)}
                      </span>
                      {!message.isCustomer && (
                        <svg viewBox="0 0 16 11" height="11" width="16" preserveAspectRatio="xMidYMid meet" className="text-[#53bdeb] fill-current"><path d="M11.053,2.372L5.808,7.618L5.344,7.153l-0.419-0.42c-0.198-0.198-0.518-0.198-0.716,0c-0.198,0.198-0.198,0.518,0,0.716l0.778,0.778l0,0l0.357,0.357c0.198,0.198,0.518,0.198,0.716,0l5.462-5.462c0.198-0.198,0.198-0.518,0-0.716C11.571,2.174,11.251,2.174,11.053,2.372z M15.429,2.372l-5.462,5.462c-0.198,0.198-0.518,0.198-0.716,0l-0.357-0.357c-0.198-0.198-0.518-0.198-0.716,0c-0.198,0.198-0.198,0.518,0,0.716l0.716,0.716c0.198,0.198,0.518,0.198,0.716,0l5.819-5.819c0.198-0.198,0.198-0.518,0-0.716C15.947,2.174,15.627,2.174,15.429,2.372z M1.745,5.117L0.892,5.97c-0.198,0.198-0.198,0.518,0,0.716l0.357,0.357c0.198,0.198,0.518,0.198,0.716,0l1.21-1.21c0.198-0.198,0.198-0.518,0-0.716l-0.357-0.357C2.62,4.563,2.3,4.563,2.102,4.761L2.102,4.761z"></path></svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2.5 flex items-center space-x-2">
        <div className="flex space-x-3 text-[#54656f] dark:text-[#aebac1]">
          <button className="hover:text-[#111b21] dark:hover:text-[#e9edef] transition-colors">
            <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M12,1c-6.1,0-11,4.9-11,11s4.9,11,11,11s11-4.9,11-11S18.1,1,12,1z M12,21c-4.9,0-9-4.1-9-9s4.1-9,9-9s9,4.1,9,9S16.9,21,12,21z M15.4,8.6c-0.4-0.4-1-0.4-1.4,0L12,10.6L10,8.6c-0.4-0.4-1-0.4-1.4,0c-0.4,0.4-0.4,1,0,1.4l2,2l-2,2c-0.4,0.4-0.4,1,0,1.4c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3l2-2l2,2c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3c0.4-0.4,0.4-1,0-1.4l-2-2l2-2C15.8,9.6,15.8,9,15.4,8.6z"></path></svg>
          </button>
          <button className="hover:text-[#111b21] dark:hover:text-[#e9edef] transition-colors">
            <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M16.5,6H13V3c0-0.55-0.45-1-1-1s-1,0.45-1,1v3H7.5C6.67,6,6,6.67,6,7.5V11h-3c-0.55,0-1,0.45-1,1s0.45,1,1,1h3v3.5c0,0.83,0.67,1.5,1.5,1.5H11v3c0,0.55,0.45,1,1,1s1-0.45,1-1v-3h3.5c0.83,0,1.5-0.67,1.5-1.5V13h3c0.55,0,1-0.45,1-1s-0.45-1-1-1h-3V7.5C18,6.67,17.33,6,16.5,6z"></path></svg>
          </button>
        </div>
        
        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-3 py-1.5 flex items-center">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message"
            className="flex-1 resize-none border-none bg-transparent focus-visible:ring-0 text-[#111b21] dark:text-[#e9edef] text-[15px] min-h-[20px] max-h-[120px]"
            rows="1"
          />
        </div>
        
        <button
          onClick={handleSendMessage}
          disabled={inputValue.trim() === ''}
          className={`p-2 rounded-full transition-colors ${inputValue.trim() === '' ? 'text-[#8696a0]' : 'text-[#00a884]'}`}
        >
          <Send className="w-6 h-6" fill="currentColor" />
        </button>
      </div>
    </div>
  )
}
