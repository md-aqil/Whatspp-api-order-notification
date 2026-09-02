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

    <div className="flex-1 relative overflow-hidden bg-[#e5ddd5] dark:bg-[#0b0d14]">
      {/* Fixed Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 dark:hidden" style={{ backgroundImage: `url('/images/doodle-light.jpg')`, backgroundRepeat: 'repeat', backgroundSize: '800px', mixBlendMode: 'multiply', opacity: '0.8' }}></div>
        <div className="absolute inset-0 hidden dark:block" style={{ backgroundImage: `url('/images/doodle-dark.png')`, backgroundRepeat: 'repeat', backgroundSize: '800px', mixBlendMode: 'screen', opacity: '0.4' }}></div>
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
            const imgSource = message.imageUrl || message.image || message.mediaUrl;
            
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
                    {imgSource && (
                      <div className="mb-2 rounded-xl overflow-hidden max-w-[280px] border border-black/10 dark:border-white/10">
                        <img src={imgSource} alt="Attached" className="w-full h-auto object-cover max-h-64" />
                      </div>
                    )}
                    {message.text && message.text !== '[Image]' && (
                      <span className="text-[14.5px] md:text-[15.5px] leading-[1.5] break-words whitespace-pre-wrap font-normal">
                        {message.text || message.message}
                      </span>
                    )}
                    <div className={`flex items-center justify-end space-x-1 mt-1 opacity-40 self-end`}>
                      <span className="text-[9px] md:text-[10px] font-medium tabular-nums">
                        {formatTime(message.timestamp || message.createdAt)}
                      </span>
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

      {/* AI Suggestions Row */}
      {suggestions.length > 0 && (
        <div className="bg-white/80 dark:bg-[#0b0d14]/80 backdrop-blur-md px-4 md:px-6 py-2 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 mr-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Suggestions</span>
            </div>
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setInputValue(suggestion)}
                className="text-[12px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all whitespace-nowrap"
              >
                {suggestion}
              </button>
            ))}
            <button 
              onClick={() => setSuggestions([])}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Multi-Image Attachment Preview Gallery */}
      {selectedImages.length > 0 && (
        <div className="bg-white/95 dark:bg-[#11131d]/95 backdrop-blur px-4 md:px-6 py-2.5 border-t border-emerald-200 dark:border-emerald-800/40 animate-in slide-in-from-bottom-2">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[80%]">
              {selectedImages.map((img, index) => (
                <div key={index} className="relative group flex-shrink-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-emerald-400 dark:border-emerald-600 shadow-sm bg-black/5">
                    <img src={img.previewUrl} alt={`Upload preview ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSelectedImage(index)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-14 w-14 rounded-lg border-2 border-dashed border-emerald-300 dark:border-emerald-700 flex flex-col items-center justify-center p-0 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex-shrink-0"
              >
                <span className="text-lg font-bold leading-none">+</span>
                <span className="text-[9px] font-medium">Add</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllSelectedImages}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 h-auto"
              >
                Clear all
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white dark:bg-[#0b0d14] px-4 md:px-6 py-4 md:py-6 border-t border-gray-100 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] relative z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 h-10 w-10 flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
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
