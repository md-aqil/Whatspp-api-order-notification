'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Send, MessageSquare } from 'lucide-react'
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

  // Initialize sound effects with high-quality sources
  useEffect(() => {
    // Use high-quality professional notification sounds
    incomingSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3') // Clean "Ding"
    outgoingSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3') // Soft "Whoosh"
    
    // Cleanup
    return () => {
      incomingSoundRef.current = null
      outgoingSoundRef.current = null
    }
  }, [])

  // Tab Title Notification Logic
  useEffect(() => {
    let intervalId;
    const originalTitle = document.title;
    const currentMessageCount = messages.length;
    
    // Check if the last message was from a customer AND we are not the active tab
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isCustomer === true && !isInitialRenderRef.current) {
      // Blink title if tab is hidden
      if (document.hidden) {
        let showNotification = true;
        intervalId = setInterval(() => {
          document.title = showNotification ? "📩 (1) New Message!" : originalTitle;
          showNotification = !showNotification;
        }, 1000);
      }
    }

    // Reset title when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearInterval(intervalId);
        document.title = originalTitle;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.title = originalTitle;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [messages])

  // Play sound effect with better handling
  const playSound = (soundRef) => {
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.volume = 0.5;
      soundRef.current.play().catch(e => {
        // Silently fail if browser blocks autoplay
        console.log("Audio play deferred until user interaction");
      });
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
    // Logic for new messages
    else if (hasNewMessages) {
      const lastMessage = messages[messages.length - 1]
      
      // If user/AI sent a message
      if (lastMessage?.isCustomer === false) {
        scrollToBottom()
        playSound(outgoingSoundRef)
      } 
      // If new incoming message from customer
      else {
        // Play sound regardless of position
        playSound(incomingSoundRef)
        
        // Scroll only if user is already at bottom
        if (isUserAtBottom()) {
          scrollToBottom()
        }
      }
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
    <div className="flex h-full flex-col bg-[#f9fafb] dark:bg-[#0b0d14] overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between bg-white dark:bg-[#0b0d14] border-b border-gray-200 dark:border-slate-800 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <div className="relative">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm">
              <img
                src={chat.avatar || `https://i.pravatar.cc/150?u=${chat.phone}`}
                alt={chat.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0b0d14] rounded-full"></div>
          </div>
          <div className="ml-3 md:ml-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-base md:text-lg tracking-tight">{chat.name}</h3>
            <div className="flex items-center mt-0.5">
              <span className="text-[11px] md:text-[12px] font-medium text-gray-500 dark:text-gray-400 mr-3">{chat.phone}</span>
              <div className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Online</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 h-9 w-9 md:h-10 md:w-10">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 h-9 w-9 md:h-10 md:w-10">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
          </Button>
        </div>
      </div>
    <div className="flex-1 relative overflow-hidden bg-[#e5ddd5] dark:bg-[#0b0d14]">
      {/* Fixed Background Layer - Does not scroll */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light Mode Doodle - Blended */}
        <div 
          className="absolute inset-0 dark:hidden"
          style={{
            backgroundImage: `url('/images/doodle-light.jpg')`,
            backgroundRepeat: 'repeat',
            backgroundSize: '800px',
            mixBlendMode: 'multiply',
            opacity: '0.8'
          }}
        ></div>

        {/* Dark Mode Doodle - Blended */}
        <div 
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: `url('/images/doodle-dark.png')`,
            backgroundRepeat: 'repeat',
            backgroundSize: '800px',
            mixBlendMode: 'screen',
            opacity: '0.4'
          }}
        ></div>

        {/* Softening Overlay - Tones down doodles slightly for better readability */}
        <div className="absolute inset-0 bg-[#e5ddd5]/30 dark:bg-[#0b0d14]/50 pointer-events-none"></div>
      </div>

      {/* Messages Scroll Layer */}
      <div 
        ref={messagesContainerRef}
        className="absolute inset-0 overflow-y-auto z-10 scroll-smooth"
      >
        <div className="p-4 md:p-8 space-y-4 max-w-4xl mx-auto min-h-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No messages yet</p>
            </div>
          )}
          
          {messages.map((message, idx) => {
            const isCustomer = message.isCustomer;
            
            return (
              <div
                key={message.id || idx}
                className={`flex w-full mb-1 ${isCustomer ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`relative max-w-[85%] md:max-w-[75%] px-4 py-2.5 shadow-sm backdrop-blur-md transition-all ${
                    isCustomer
                      ? 'bg-white/90 dark:bg-[#1f2937]/90 text-gray-800 dark:text-gray-100 border border-white/20 dark:border-slate-700/50 rounded-2xl rounded-tl-none'
                      : 'bg-[#dcf8c6]/95 dark:bg-[#056162]/90 text-gray-800 dark:text-white border border-white/10 dark:border-white/5 rounded-2xl rounded-tr-none'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[14.5px] md:text-[15.5px] leading-[1.5] break-words whitespace-pre-wrap font-normal">
                      {message.text || message.message}
                    </span>
                    <div className={`flex items-center justify-end space-x-1 mt-1 opacity-40 self-end`}>
                      <span className="text-[9px] md:text-[10px] font-medium tabular-nums">
                        {formatTime(message.timestamp || message.createdAt)}
                      </span>
                      {!isCustomer && (
                        <svg viewBox="0 0 16 15" width="12" height="12" fill={isCustomer ? "currentColor" : "#4fc3f7"}>
                          <path d="M15.01 3.3L8.07 10.24l-3.32-3.32-.73.73 4.05 4.05 7.68-7.68-.74-.72zm-4.72 0L9.56 4.03l2.8 2.8.73-.73-2.8-2.8zm-7.69.74l3.32 3.32.73-.73-4.05-4.05-.73.73z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-[#0b0d14] px-4 md:px-6 py-4 md:py-6 border-t border-gray-100 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] relative z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 h-10 w-10 flex-shrink-0">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </Button>
          
          <div className="flex-1 relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full resize-none border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500/10 text-gray-900 dark:text-white text-[14px] md:text-[15px] min-h-[44px] max-h-[120px] shadow-sm"
              rows="1"
            />
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={inputValue.trim() === ''}
            className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex-shrink-0 shadow-md transition-all ${
              inputValue.trim() === '' 
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
