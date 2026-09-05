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

  useEffect(() => {
    if (!chat?.phone) {
      setHandoffSummary(null)
      setShowHandoff(false)
      return
    }
    let cancelled = false
    const loadHandoff = async () => {
      setLoadingHandoff(true)
      try {
        const res = await fetch(`/api/conversation/summary?phone=${encodeURIComponent(chat.phone)}&format=agent`)
        if (!res.ok) {
          if (!cancelled) setHandoffSummary(null)
          return
        }
        const data = await res.json()
        if (!cancelled) setHandoffSummary(data)
      } catch (err) {
        console.warn('Handoff summary load failed:', err?.message)
      } finally {
        if (!cancelled) setLoadingHandoff(false)
      }
    }
    loadHandoff()
    return () => { cancelled = true }
  }, [chat?.phone])

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

  const [showProductModal, setShowProductModal] = useState(false)
  const [productsList, setProductsList] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [handoffSummary, setHandoffSummary] = useState(null)
  const [loadingHandoff, setLoadingHandoff] = useState(false)
  const [showHandoff, setShowHandoff] = useState(false)

  const openProductPicker = async () => {
    setShowProductModal(true)
    setSelectedProductIds([])
    if (productsList.length === 0) {
      setLoadingProducts(true)
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const data = await res.json()
          setProductsList(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to load products:', err)
      } finally {
        setLoadingProducts(false)
      }
    }
  }

  const toggleProductSelection = (productId) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  const selectAllProducts = () => {
    setSelectedProductIds(filteredProducts.map(p => p.id))
  }

  const clearProductSelection = () => {
    setSelectedProductIds([])
  }

  const handleAttachSelectedProducts = () => {
    const selectedProds = productsList.filter(p => selectedProductIds.includes(p.id))
    if (selectedProds.length === 0) {
      setShowProductModal(false)
      return
    }

    const newImageEntries = []
    const infoLines = []

    selectedProds.forEach(product => {
      if (product.image) {
        newImageEntries.push({
          file: null,
          previewUrl: product.image,
          isRemoteUrl: true,
          url: product.image
        })
      }
      const priceStr = product.price ? `₹${product.price}` : ''
      const urlStr = product.url ? `\n🔗 ${product.url}` : ''
      infoLines.push(`🛍️ *${product.title}* ${priceStr ? `— ${priceStr}` : ''}${urlStr}`)
    })

    if (newImageEntries.length > 0) {
      setSelectedImages(prev => [...prev, ...newImageEntries])
    }

    const combinedInfo = infoLines.join('\n\n')
    setInputValue(prev => (prev ? `${prev}\n\n${combinedInfo}` : combinedInfo))
    setShowProductModal(false)
    toast.success(`Attached ${selectedProds.length} Shopify product(s) with images`)
  }

  const filteredProducts = productsList.filter((p) =>
    (p.title || '').toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(productSearch.toLowerCase())
  )

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
      newEntries.push({ file, previewUrl, isRemoteUrl: false })
    }

    if (newEntries.length > 0) {
      setSelectedImages((prev) => [...prev, ...newEntries])
    }
    e.target.value = ''
  }

  const removeSelectedImage = (indexToRemove) => {
    setSelectedImages((prev) => {
      const item = prev[indexToRemove]
      if (item?.previewUrl && !item?.isRemoteUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
      return prev.filter((_, idx) => idx !== indexToRemove)
    })
  }

  const clearAllSelectedImages = () => {
    selectedImages.forEach((img) => {
      if (img.previewUrl && !img.isRemoteUrl) URL.revokeObjectURL(img.previewUrl)
    })
    setSelectedImages([])
  }

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' && selectedImages.length === 0) return

    let uploadedUrls = []

    // 1. Remote images (Shopify products)
    const remoteImages = selectedImages.filter((img) => img.isRemoteUrl && img.url)
    remoteImages.forEach((img) => uploadedUrls.push(img.url))

    // 2. Local uploaded files
    const localFiles = selectedImages.filter((img) => !img.isRemoteUrl && img.file)
    if (localFiles.length > 0) {
      setIsUploadingImage(true)
      try {
        const newlyUploaded = await uploadSingleOrMultipleImages(localFiles.map(item => item.file))
        uploadedUrls.push(...newlyUploaded)
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

    // Play outgoing sound
    if (outgoingSoundRef.current) {
      outgoingSoundRef.current.currentTime = 0;
      outgoingSoundRef.current.play().catch(e => console.log('Audio play blocked:', e));
    }

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

      {/* Handoff summary banner — surfaced whenever a context-rich customer is open */}
      {chat && handoffSummary?.success && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl border border-amber-200/70 dark:border-amber-700/40 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-2.5">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Handoff context</span>
                  {handoffSummary?.raw?.profile?.lifetimeTier && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200">
                      {String(handoffSummary.raw.profile.lifetimeTier).toUpperCase()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHandoff(s => !s)}
                    className="ml-auto text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:underline"
                  >
                    {showHandoff ? 'Hide' : 'Show details'}
                  </button>
                </div>
                {loadingHandoff ? (
                  <div className="text-xs text-amber-700/80 dark:text-amber-200/80">Loading context…</div>
                ) : showHandoff ? (
                  <pre className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-100/90 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{handoffSummary.summary}</pre>
                ) : (
                  <div className="text-xs text-amber-800/90 dark:text-amber-100/90 line-clamp-2">
                    {String(handoffSummary.summary || '').split('\n').slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Product Picker Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#11131d] rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                    Attach Shopify Catalog Products
                    <span className="text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {selectedProductIds.length} Selected
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">Select single or multiple products to insert into chat with images</p>
                </div>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar & Quick Selection Buttons */}
            <div className="p-3.5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 flex items-center gap-2">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by title, SKU or vendor..."
                className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllProducts}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-8 px-2.5 rounded-lg"
              >
                Select All
              </Button>
              {selectedProductIds.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearProductSelection}
                  className="text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-8 px-2.5 rounded-lg"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-gray-50 dark:divide-slate-800/50">
              {loadingProducts ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
                  <span className="text-xs text-gray-400 font-medium">Fetching Shopify Catalog...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No products matched your search.
                </div>
              ) : (
                filteredProducts.map((prod) => {
                  const isChecked = selectedProductIds.includes(prod.id)
                  return (
                    <div
                      key={prod.id}
                      onClick={() => toggleProductSelection(prod.id)}
                      className={`pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-2xl cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/30'
                          : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                            : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}>
                          {isChecked && <span className="text-xs font-bold leading-none">✓</span>}
                        </div>

                        {/* Product Image */}
                        <div className="w-13 h-13 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 flex-shrink-0 border border-gray-200 dark:border-slate-700">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <ShoppingBag className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <h4 className={`text-xs font-bold truncate ${isChecked ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                            {prod.title}
                          </h4>
                          <p className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {prod.price ? `₹${prod.price}` : 'Free'}
                          </p>
                          {prod.description && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[260px]">
                              {prod.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer / Action Bar */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                {selectedProductIds.length === 0 ? 'Click products to select' : `${selectedProductIds.length} product(s) selected`}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProductModal(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedProductIds.length === 0}
                  onClick={handleAttachSelectedProducts}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 rounded-xl shadow-md disabled:opacity-40"
                >
                  Attach ({selectedProductIds.length}) Products
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="flex items-center justify-between bg-white dark:bg-[#0b0d14] border-b border-gray-200 dark:border-slate-800 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center">
          <div className="relative">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-sm uppercase tracking-wider select-none">
              {chat.avatar && !chat.avatar.includes('pravatar') ? (
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {chat.name && !/^\+?\d+$/.test(chat.name.trim())
                    ? chat.name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    : (chat.phone ? chat.phone.slice(-2) : 'WA')}
                </span>
              )}
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

        <div className="flex items-center gap-2">
          {/* Pick Product Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={openProductPicker}
            className="rounded-xl border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-emerald-600 hover:border-emerald-500 h-9 px-3 gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
            <span>Send Product</span>
          </Button>

          {/* AI Suggestions Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSuggestions}
            disabled={loadingSuggestions}
            className="rounded-xl border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-emerald-600 hover:border-emerald-500 h-9 px-3 gap-1.5"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-500 ${loadingSuggestions ? 'animate-spin' : ''}`} />
            <span>AI Replies</span>
          </Button>
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
            const isCustomer = message.isCustomer == 1 || message.isCustomer === true || message.sender === 'customer' || message.sender === 'user'
            const timeStr = message.timestamp ? format(new Date(message.timestamp), 'h:mm a') : ''
            
            let messageImages = []
            if (Array.isArray(message.imageUrls) && message.imageUrls.length > 0) {
              messageImages = message.imageUrls
            } else if (message.imageUrl) {
              messageImages = [message.imageUrl]
            } else if (message.image) {
              messageImages = [message.image]
            } else if (message.mediaUrl) {
              messageImages = [message.mediaUrl]
            }

            const messageText = message.content || message.message || message.text || ''

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
                  {messageText && messageText !== '[Image]' && (
                    <p className="text-[13px] md:text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                      {messageText}
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

