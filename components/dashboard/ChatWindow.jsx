'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Send, MessageSquare, Sparkles, X, Loader2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { uploadSingleOrMultipleImages } from '@/lib/image-compressor'

export function ChatWindow({ chat, messages, onSendMessage }) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedImages, setSelectedImages] = useState([])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevMessageCountRef = useRef(messages.length)
  const isInitialRenderRef = useRef(true)
  const incomingSoundRef = useRef(null)
  const outgoingSoundRef = useRef(null)

  // Initialize sound effects with high-quality sources
  useEffect(() => {
    incomingSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3')
    outgoingSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3')
    
    return () => {
      incomingSoundRef.current = null
      outgoingSoundRef.current = null
    }
  }, [])

  // Tab Title Notification Logic
  useEffect(() => {
    let intervalId;
    const originalTitle = document.title;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isCustomer === true && !isInitialRenderRef.current) {
      if (document.hidden) {
        let showNotification = true;
        intervalId = setInterval(() => {
          document.title = showNotification ? "📩 (1) New Message!" : originalTitle;
          showNotification = !showNotification;
        }, 1000);
      }
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        document.title = originalTitle;
        if (intervalId) clearInterval(intervalId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.title = originalTitle;
    };
  }, [messages]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  useEffect(() => {
    const currentMessageCount = messages.length
    
    if (isInitialRenderRef.current) {
      scrollToBottom('auto')
      isInitialRenderRef.current = false
    } 
    else if (currentMessageCount > prevMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1]
      
      if (lastMessage?.isCustomer) {
        incomingSoundRef.current?.play().catch(e => console.log('Audio play blocked:', e))
      } else {
        outgoingSoundRef.current?.play().catch(e => console.log('Audio play blocked:', e))
      }
      
      scrollToBottom('smooth')
    }
    
    prevMessageCountRef.current = messages.length
  }, [messages])

  useEffect(() => {
    scrollToBottom('auto')
    isInitialRenderRef.current = false
  }, [chat?.id])

  const fetchSuggestions = async () => {
    if (!chat?.phone) return
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: chat.phone })
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

  const handleImageFilesChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newEntries = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not a supported image file`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10MB limit`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      newEntries.push({ file, previewUrl })
    }

    if (newEntries.length > 0) {
      setSelectedImages((prev) => [...prev, ...newEntries])
    }
    e.target.value = ''
  }

  const removeSelectedImage = (indexToRemove) => {
    setSelectedImages((prev) => {
      const item = prev[indexToRemove]
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
      return prev.filter((_, idx) => idx !== indexToRemove)
    })
  }

  const clearAllSelectedImages = () => {
    selectedImages.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
    })
    setSelectedImages([])
  }

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' && selectedImages.length === 0) return

    let uploadedUrls = []

    if (selectedImages.length > 0) {
      setIsUploadingImage(true)
      try {
        uploadedUrls = await uploadSingleOrMultipleImages(selectedImages.map(item => item.file))
      } catch (err) {
        toast.error(`Image upload failed: ${err.message}`)
        setIsUploadingImage(false)
        return
      } finally {
        setIsUploadingImage(false)
      }
    }

    const textToSend = inputValue.trim()
    clearAllSelectedImages()
    setInputValue('')

    onSendMessage(textToSend, uploadedUrls)
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
      {/* Hidden File Input for Multi-Images */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageFilesChange}
      />

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
      </div>

      {/* Messages Feed */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[#efeae2]/30 dark:bg-[#0b0d14]"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">No messages yet</h3>
            <p className="text-xs text-gray-400 max-w-xs">
              Start the conversation by sending a text message or sharing a product photo below.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isCustomer = message.isCustomer ?? (message.sender === 'customer' || message.sender === 'user')
            const timeStr = message.timestamp ? format(new Date(message.timestamp), 'h:mm a') : ''
            const messageImages = Array.isArray(message.imageUrls) 
              ? message.imageUrls 
              : (message.imageUrl ? [message.imageUrl] : [])

            return (
              <div
                key={message.id || index}
                className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'} animate-in fade-in-50 duration-200`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3.5 shadow-sm space-y-2 ${
                    isCustomer
                      ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-tl-sm border border-gray-100 dark:border-slate-700/50'
                      : 'bg-emerald-600 text-white rounded-tr-sm shadow-emerald-600/10'
                  }`}
                >
                  {/* Render Message Photos */}
                  {messageImages.length > 0 && (
                    <div className={`grid gap-1.5 rounded-xl overflow-hidden ${
                      messageImages.length === 1 ? 'grid-cols-1' : messageImages.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
                    }`}>
                      {messageImages.map((imgUrl, imgIdx) => (
                        <a 
                          key={imgIdx} 
                          href={imgUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg bg-black/10 aspect-square group relative"
                        >
                          <img 
                            src={imgUrl} 
                            alt={`Attachment ${imgIdx + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Text Content */}
                  {message.content && (
                    <p className="text-[13px] md:text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  )}

                  {/* Timestamp */}
                  <div className={`flex items-center justify-end gap-1 text-[10px] ${
                    isCustomer ? 'text-gray-400' : 'text-emerald-100'
                  }`}>
                    <span>{timeStr}</span>
                    {!isCustomer && (
                      <span className="text-xs">✓✓</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected Image Preview Gallery (Before Sending) */}
      {selectedImages.length > 0 && (
        <div className="bg-white dark:bg-[#11131d] px-6 py-3 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {selectedImages.map((item, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 shadow-sm flex-shrink-0 group">
                  <img src={item.previewUrl} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeSelectedImage(idx)}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-14 w-14 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 flex flex-col items-center justify-center p-0 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex-shrink-0"
              >
                <span className="text-lg font-bold leading-none">+</span>
                <span className="text-[9px] font-medium">Add</span>
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllSelectedImages}
              className="text-xs text-red-500 hover:text-red-700 h-auto"
            >
              Clear all
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white dark:bg-[#0b0d14] px-4 md:px-6 py-4 md:py-6 border-t border-gray-100 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] relative z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            {/* Attachment Button */}
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => fileInputRef.current?.click()}
              title="Attach photos"
              className="text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 h-10 w-10 flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </Button>

            {/* Shopify Products Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openProductPicker}
              title="Pick product from Shopify"
              className="text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 h-10 w-10 flex-shrink-0"
            >
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
            </Button>
          </div>
          
          <div className="flex-1 relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedImages.length > 0 ? "Add a caption (optional)..." : "Type your message..."}
              className="w-full resize-none border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500/10 text-gray-900 dark:text-white text-[14px] md:text-[15px] min-h-[44px] max-h-[120px] shadow-sm"
              rows="1"
            />
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={(inputValue.trim() === '' && selectedImages.length === 0) || isUploadingImage}
            className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex-shrink-0 shadow-md transition-all ${
              (inputValue.trim() === '' && selectedImages.length === 0) || isUploadingImage
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

