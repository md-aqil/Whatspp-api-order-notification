'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  Users, 
  Send, 
  Paperclip, 
  X, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon,
  Smartphone
} from 'lucide-react'
import { toast } from 'sonner'
import { uploadSingleOrMultipleImages } from '@/lib/image-compressor'

export function BroadcastComposer({
  selectedChats = [],
  onRemoveChat,
  onClearSelection,
  onBatchSendComplete
}) {
  const [messageText, setMessageText] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 })
  const [sendResults, setSendResults] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [productsList, setProductsList] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const fileInputRef = useRef(null)

  const openProductPicker = async () => {
    setShowProductModal(true)
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

  const handlePickProduct = (product) => {
    if (product.image) {
      setSelectedImages((prev) => [
        ...prev,
        {
          file: null,
          previewUrl: product.image,
          isRemoteUrl: true,
          url: product.image
        }
      ])
    }

    const productInfo = `🛍️ *${product.title}*\n💰 Price: ${product.price ? '₹' + product.price : ''}\n${product.url ? '🔗 ' + product.url : ''}`.trim()
    setMessageText((prev) => (prev ? `${prev}\n\n${productInfo}` : productInfo))
    setShowProductModal(false)
    toast.success(`Attached "${product.title}"`)
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
        toast.error(`${file.name} is not a valid image`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`)
        continue
      }
      newEntries.push({
        file,
        previewUrl: URL.createObjectURL(file),
        isRemoteUrl: false
      })
    }

    if (newEntries.length > 0) {
      setSelectedImages((prev) => [...prev, ...newEntries])
    }
    e.target.value = ''
  }

  const removeImage = (indexToRemove) => {
    setSelectedImages((prev) => {
      const item = prev[indexToRemove]
      if (item?.previewUrl && !item?.isRemoteUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, idx) => idx !== indexToRemove)
    })
  }

  const insertVariable = (varName) => {
    setMessageText((prev) => prev + ` {${varName}}`)
  }

  const handleSendBroadcast = async () => {
    if (selectedChats.length === 0) {
      toast.error('Please select at least one recipient')
      return
    }

    if (messageText.trim() === '' && selectedImages.length === 0) {
      toast.error('Please type a message or attach an image')
      return
    }

    setIsSending(true)
    setProgress({ current: 0, total: selectedChats.length, percent: 0 })
    setSendResults(null)

    try {
      let uploadedUrls = []

      // 1. Collect remote images (Shopify products)
      const remoteImages = selectedImages.filter((img) => img.isRemoteUrl && img.url)
      remoteImages.forEach((img) => uploadedUrls.push(img.url))

      // 2. Upload local image files
      const localFiles = selectedImages.filter((img) => !img.isRemoteUrl && img.file)
      if (localFiles.length > 0) {
        setIsUploading(true)
        const newlyUploaded = await uploadSingleOrMultipleImages(localFiles.map((i) => i.file))
        uploadedUrls.push(...newlyUploaded)
        setIsUploading(false)
      }

      // 3. Send via Batch Endpoint
      const response = await fetch('/api/send-whatsapp-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: selectedChats.map((c) => ({
            phone: c.phone,
            name: c.name || ''
          })),
          message: messageText.trim(),
          imageUrls: uploadedUrls
        })
      })

      const rawText = await response.text()
      let data
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        if (response.status === 413 || rawText.includes('413') || rawText.includes('Too Large')) {
          throw new Error('Message payload or image is too large for the server.')
        }
        throw new Error(`Broadcast server error (Status ${response.status})`)
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send broadcast')
      }

      setSendResults(data)
      setProgress({
        current: data.sentCount,
        total: selectedChats.length,
        percent: 100
      })

      toast.success(`Broadcast sent to ${data.sentCount} customer(s)!`)

      if (onBatchSendComplete) {
        onBatchSendComplete(data)
      }
    } catch (error) {
      console.error('Broadcast error:', error)
      toast.error(error.message)
    } finally {
      setIsSending(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-[#0b0d14] overflow-y-auto">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageFilesChange}
      />

      {/* Header */}
      <div className="bg-white dark:bg-[#11131d] border-b border-gray-200 dark:border-slate-800 px-6 py-5 sticky top-0 z-20 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              Broadcast Message
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Send direct chat message and photos to multiple customers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="text-xs border-gray-200 dark:border-slate-700"
          >
            Exit Broadcast Mode
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
        {/* Recipient Chips Section */}
        <div className="bg-white dark:bg-[#11131d] rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Selected Recipients ({selectedChats.length})
              </span>
            </div>
            {selectedChats.length > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
            {selectedChats.map((chat) => (
              <div
                key={chat.id || chat.phone}
                className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full px-3 py-1.5 text-xs font-medium animate-in fade-in"
              >
                <span>{chat.name || chat.phone}</span>
                <span className="text-[10px] opacity-60">({chat.phone})</span>
                <button
                  type="button"
                  onClick={() => onRemoveChat(chat.id || chat.phone)}
                  className="hover:text-red-500 transition-colors p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Message Composition Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Editor */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white dark:bg-[#11131d] rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Message Content
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">Insert tag:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable('name')}
                    className="text-[11px] font-semibold bg-gray-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-700 dark:text-gray-300 hover:text-emerald-600 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-700"
                  >
                    {'{name}'}
                  </button>
                </div>
              </div>

              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here... e.g. Hello {name}, check out our new arrivals with exclusive wholesale pricing!"
                rows={6}
                className="w-full resize-none border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 rounded-xl p-3.5 focus:border-emerald-500 text-sm leading-relaxed"
              />

              {/* Attachments Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Attached Photos ({selectedImages.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openProductPicker}
                      className="h-8 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                      Shopify Products
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 text-xs border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                      Upload Photos
                    </Button>
                  </div>
                </div>

                {selectedImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2.5 p-2 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-800">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square border border-emerald-200 dark:border-emerald-800">
                        <img src={img.previewUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 dark:border-slate-800 hover:border-emerald-400 rounded-xl p-6 text-center cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-7 h-7 mx-auto text-gray-400 mb-1.5" />
                    <p className="text-xs text-gray-500 font-medium">Click to upload photos or pick from Shopify products above</p>
                  </div>
                )}
              </div>

              {/* Progress and Send Action */}
              {isSending && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span>Sending broadcast messages...</span>
                    <span>{progress.percent}%</span>
                  </div>
                  <div className="w-full bg-emerald-200 dark:bg-emerald-900/50 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {sendResults && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Delivered to {sendResults.sentCount} recipients
                      {sendResults.failedCount > 0 && ` (${sendResults.failedCount} failed)`}
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSendBroadcast}
                disabled={isSending || isUploading || selectedChats.length === 0}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isSending || isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isUploading ? 'Uploading Photos...' : 'Sending Broadcast...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Broadcast to {selectedChats.length} Customers</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Live WhatsApp Mobile Preview */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#11131d] rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                <span>Customer Preview</span>
              </div>

              {/* Phone Mockup Frame */}
              <div className="rounded-2xl border-4 border-gray-800 dark:border-slate-700 overflow-hidden shadow-xl bg-[#e5ddd5] dark:bg-[#0b0d14] min-h-[380px] flex flex-col justify-between">
                {/* Phone WhatsApp Header */}
                <div className="bg-[#075e54] dark:bg-[#1f2937] text-white px-3.5 py-2.5 flex items-center gap-2.5 shadow">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    VF
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">VaclavFashion</p>
                    <p className="text-[10px] opacity-75 leading-none">Online</p>
                  </div>
                </div>

                {/* WhatsApp Chat Body */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-end">
                  <div className="self-end max-w-[90%] bg-[#dcf8c6] dark:bg-[#056162] text-gray-900 dark:text-white rounded-xl rounded-tr-none p-2 shadow-sm text-xs space-y-1.5">
                    {selectedImages.length > 0 && (
                      <div className="rounded-lg overflow-hidden border border-black/10">
                        <img
                          src={selectedImages[0].previewUrl}
                          alt="Preview"
                          className="w-full h-36 object-cover"
                        />
                        {selectedImages.length > 1 && (
                          <div className="bg-black/60 text-white text-[10px] text-center py-0.5">
                            +{selectedImages.length - 1} more image{selectedImages.length > 2 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed">
                      {messageText
                        ? messageText.replace(/{name}/gi, selectedChats[0]?.name || 'Customer')
                        : 'Your broadcast message preview will appear here...'}
                    </p>

                    <p className="text-[9px] text-right opacity-60">Just now ✓✓</p>
                  </div>
                </div>

                {/* Mock Phone Bottom Input */}
                <div className="bg-gray-100 dark:bg-slate-900 p-2 border-t border-gray-200 dark:border-slate-800 text-center text-[10px] text-gray-400">
                  WhatsApp Cloud Delivery
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
