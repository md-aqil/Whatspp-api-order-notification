'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { toast, Toaster } from 'sonner'
import { 
  CheckCircle2, CheckCheck, Loader2, ImagePlus, RefreshCw, Send, Users, 
  Clock3, Wand2, Search, PlusCircle, Check, Package, User, 
  Megaphone, ShoppingBag, Layers, AlertCircle, Sparkles, Phone
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const variableOptions = [
  { value: 'text', label: 'Custom text', hint: 'Type any value manually.' },
  { value: '{{customer_name}}', label: 'Customer name', hint: 'Uses the recipient name when available.' },
  { value: '{{customer_phone}}', label: 'Customer phone', hint: 'Uses the recipient phone number.' },
  { value: '{{order_number}}', label: 'Order number', hint: 'Uses latest order number for recipient.' },
  { value: '{{catalog_link}}', label: 'Catalog link', hint: 'Uses WhatsApp or store catalog link.' },
  { value: '{{product_name}}', label: 'First product name', hint: 'Selected product title.' },
  { value: '{{product_price}}', label: 'First product price', hint: 'Selected product price.' },
  { value: '{{product_link}}', label: 'First product link', hint: 'Selected product direct URL.' }
]

function getTemplateBody(template) {
  return template?.components?.find((component) => component.type === 'BODY')?.text || 'Select an approved template to preview the message.'
}

function getComponentExamples(component, key) {
  const examples = component?.example?.[key]
  if (Array.isArray(examples) && Array.isArray(examples[0])) return examples[0]
  return []
}

function inferVariableFromExample(exampleText, index = 0) {
  const sample = String(exampleText || '').trim().toLowerCase()
  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('order') && sample.includes('number')) return '{{order_number}}'
  if (sample.includes('catalog') || sample.includes('collection') || sample.includes('link')) return '{{catalog_link}}'
  const fallbacks = ['{{customer_name}}', '{{catalog_link}}', '{{order_number}}']
  return fallbacks[index] || 'text'
}

function getTemplateParameterSlots(template) {
  const slots = []
  for (const component of template?.components || []) {
    if (component?.type === 'HEADER' && component.format === 'TEXT') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getComponentExamples(component, 'header_text')
      matches.forEach((placeholder, index) => {
        slots.push({ id: `header-${index}`, label: `Header ${placeholder}`, example: examples[index] || '', placeholder })
      })
    }
    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getComponentExamples(component, 'body_text')
      matches.forEach((placeholder, index) => {
        slots.push({ id: `body-${index}`, label: `Body ${placeholder}`, example: examples[index] || '', placeholder })
      })
    }
    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((placeholder, index) => {
          slots.push({ id: `button-${buttonIndex}-${index}`, label: `Button ${placeholder}`, example: button?.example?.[index] || '', placeholder })
        })
      })
    }
  }
  return slots
}

function fillTemplatePreview(body, variables) {
  if (!body) return 'Select an approved template to preview the message.'
  return body.replace(/\{\{(\d+)\}\}/g, (_match, rawIndex) => {
    const index = Number(rawIndex) - 1
    const value = Array.isArray(variables) ? variables[index] : ''
    if (value === '{{customer_name}}') return 'John Doe'
    if (value === '{{customer_phone}}') return '+91 98765 43210'
    if (value === '{{order_number}}') return '#1042'
    if (value === '{{catalog_link}}') return 'https://vaclavfashion.com'
    if (value === '{{product_name}}') return 'Vaclav Kurta'
    if (value === '{{product_price}}') return '₹1,499'
    if (value === '{{product_link}}') return 'https://vaclavfashion.com/products/kurta'
    if (value === 'custom' || value === 'text') return `[custom text]`
    return value?.trim() || `[value ${rawIndex}]`
  })
}

export default function CampaignsStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <CampaignsStudio />
    </Suspense>
  )
}

function CampaignsStudio() {
  const [audienceType, setAudienceType] = useState('single') // 'single' | 'all_customers' | 'recent_buyers' | 'custom'
  const [campaignName, setCampaignName] = useState('New Campaign')
  const [singlePhone, setSinglePhone] = useState('')
  const [customPhones, setCustomPhones] = useState('')
  const [selectedContacts, setSelectedContacts] = useState([])
  
  const [templates, setTemplates] = useState([])
  const [products, setProducts] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  
  const [messageMode, setMessageMode] = useState('template') // 'template' | 'custom'
  const [customText, setCustomText] = useState('Hello {{customer_name}}, check out our new arrivals and special collection! ✨\n\nShop our top picks below:')
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [templateVariables, setTemplateVariables] = useState([])
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [customNote, setCustomNote] = useState('')
  
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isSending, setIsSending] = useState(false)
  
  const [audienceCounts, setAudienceCounts] = useState({ allCustomers: 0, recentBuyers: 0 })
  const [existingContacts, setExistingContacts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [templateFilter, setTemplateFilter] = useState('ALL')
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadTemplates()
    loadProducts()
    loadAudienceStats()
  }, [])

  async function loadAudienceStats() {
    try {
      const [chatsRes, ordersRes] = await Promise.all([
        fetch('/api/chats').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/orders').then(r => r.ok ? r.json() : []).catch(() => [])
      ])
      
      const contactsMap = new Map()
      const uniquePhones = new Set()

      ;(chatsRes || []).forEach(c => {
        if (c.phone) {
          const raw = String(c.phone).replace(/\D/g, '')
          if (raw.length >= 10) {
            uniquePhones.add(raw)
            contactsMap.set(raw, {
              id: c.id || raw,
              name: c.name || 'Customer',
              phone: raw
            })
          }
        }
      })

      ;(ordersRes || []).forEach(o => { 
        const p = o.customerPhone || o.phone
        if (p) {
          const raw = String(p).replace(/\D/g, '')
          if (raw.length >= 10) {
            uniquePhones.add(raw)
            if (!contactsMap.has(raw)) {
              contactsMap.set(raw, {
                id: o.id || raw,
                name: o.customerName || 'Store Buyer',
                phone: raw
              })
            }
          }
        }
      })

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentOrders = (ordersRes || []).filter(o => {
        const orderDate = new Date(o.createdAt || o.created_at || o.timestamp)
        return !isNaN(orderDate.getTime()) && orderDate >= thirtyDaysAgo
      })
      const recentPhones = new Set()
      recentOrders.forEach(o => {
        const p = o.customerPhone || o.phone
        if (p) recentPhones.add(String(p).replace(/\D/g, ''))
      })

      if (recentPhones.size === 0) {
        (chatsRes || []).forEach(c => {
          const chatDate = new Date(c.timestamp || c.createdAt)
          if (!isNaN(chatDate.getTime()) && chatDate >= thirtyDaysAgo && c.phone) {
            recentPhones.add(String(c.phone).replace(/\D/g, ''))
          }
        })
      }

      setAudienceCounts({
        allCustomers: uniquePhones.size,
        recentBuyers: recentPhones.size
      })
      const contactsList = Array.from(contactsMap.values())
      setExistingContacts(contactsList)
      if (contactsList.length > 0 && !singlePhone) {
        setSinglePhone(contactsList[0].phone)
      }
    } catch (e) {
      console.error('Failed to load audience stats:', e)
    }
  }

  async function loadTemplates() {
    try {
      setLoadingTemplates(true)
      const res = await fetch('/api/whatsapp-templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load templates')
      const templateList = Array.isArray(data) ? data : []
      setTemplates(templateList)
      if (templateList.length > 0 && !selectedTemplateName) {
        selectTemplate(templateList[0])
      }
    } catch (error) { toast.error(error.message) }
    finally { setLoadingTemplates(false) }
  }

  async function loadProducts() {
    try {
      setLoadingProducts(true)
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) { console.error(error) }
    finally { setLoadingProducts(false) }
  }

  const selectedTemplate = useMemo(() => 
    templates.find(t => t.name === selectedTemplateName) || null
  , [templates, selectedTemplateName])

  const selectedTemplateSlots = useMemo(() => 
    getTemplateParameterSlots(selectedTemplate)
  , [selectedTemplate])

  const templateSupportsMediaHeader = useMemo(() => {
    if (messageMode === 'custom') return true
    if (!selectedTemplate) return false
    const headerComponent = selectedTemplate.components?.find(c => c.type === 'HEADER')
    return Boolean(headerComponent && (headerComponent.format === 'IMAGE' || headerComponent.format === 'VIDEO' || headerComponent.format === 'DOCUMENT'))
  }, [messageMode, selectedTemplate])

  const renderedCustomTextPreview = useMemo(() => {
    return customText
      .replace(/\{\{customer_name\}\}/g, 'John Doe')
      .replace(/\{\{customer_phone\}\}/g, '+91 98765 43210')
      .replace(/\{\{order_number\}\}/g, '#1042')
      .replace(/\{\{catalog_link\}\}/g, 'https://vaclav.fashion/shop')
      .replace(/\{\{product_name\}\}/g, products.find(p => selectedProductIds.includes(p.id))?.title || 'Vaclav Kurta')
  }, [customText, products, selectedProductIds])

  function selectTemplate(template) {
    setSelectedTemplateName(template.name)
    const slots = getTemplateParameterSlots(template)
    setTemplateVariables(slots.map((s, idx) => inferVariableFromExample(s.example, idx)))
    const headerComponent = template.components?.find(c => c.type === 'HEADER')
    const supportsMedia = Boolean(headerComponent && (headerComponent.format === 'IMAGE' || headerComponent.format === 'VIDEO' || headerComponent.format === 'DOCUMENT'))
    if (!supportsMedia) {
      setHeaderImageUrl('')
    }
  }

  function handleVariableChange(index, value) {
    setTemplateVariables(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function toggleProduct(productId) {
    setSelectedProductIds(prev => {
      const isSelected = prev.includes(productId)
      const next = isSelected ? prev.filter(id => id !== productId) : [...prev, productId]
      const prod = products.find(p => p.id === productId)
      const imgSrc = prod?.image || (prod?.images && prod.images[0]?.src) || ''
      if (!isSelected && imgSrc) {
        setHeaderImageUrl(imgSrc)
      } else if (isSelected && next.length > 0) {
        const remainingProd = products.find(p => p.id === next[0])
        const remImg = remainingProd?.image || (remainingProd?.images && remainingProd.images[0]?.src) || ''
        if (remImg) setHeaderImageUrl(remImg)
      } else if (isSelected && next.length === 0 && headerImageUrl === imgSrc) {
        setHeaderImageUrl('')
      }
      return next
    })
  }

  async function handleHeaderImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingImage(true)
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/uploads/campaign-image', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to upload image')
      const url = data.url || (data.urls && data.urls[0])
      if (url) {
        setHeaderImageUrl(url)
        toast.success('Header image uploaded!')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function toggleContactCheckbox(phone) {
    const clean = String(phone).replace(/\D/g, '')
    setSelectedContacts(prev => {
      const next = prev.includes(clean) ? prev.filter(p => p !== clean) : [...prev, clean]
      setCustomPhones(next.join(', '))
      return next
    })
  }

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return existingContacts
    const term = contactSearch.toLowerCase()
    return existingContacts.filter(c => 
      c.name.toLowerCase().includes(term) || c.phone.includes(term)
    )
  }, [existingContacts, contactSearch])

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products
    const term = productSearch.toLowerCase()
    return products.filter(p => 
      (p.title || p.name || '').toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term) ||
      (p.vendor || '').toLowerCase().includes(term)
    )
  }, [products, productSearch])

  const filteredTemplates = useMemo(() => {
    if (templateFilter === 'ALL') return templates
    return templates.filter(t => (t.category || '').toUpperCase() === templateFilter)
  }, [templates, templateFilter])

  // Recipient Count & Estimation
  const resolvedRecipients = useMemo(() => {
    if (audienceType === 'single') {
      const clean = singlePhone.replace(/\D/g, '')
      return clean.length >= 10 ? [clean] : []
    }
    if (audienceType === 'all_customers') {
      return Array.from({ length: audienceCounts.allCustomers || 1 })
    }
    if (audienceType === 'recent_buyers') {
      return Array.from({ length: audienceCounts.recentBuyers || 1 })
    }
    // Custom
    const fromInput = customPhones.split(/[\n,]/).map(p => p.replace(/\D/g, '')).filter(p => p.length >= 10)
    return Array.from(new Set([...selectedContacts, ...fromInput]))
  }, [audienceType, singlePhone, customPhones, selectedContacts, audienceCounts])

  const estimatedCost = useMemo(() => {
    return (resolvedRecipients.length * 0.78).toFixed(2)
  }, [resolvedRecipients])

  // Send Execution Handler
  async function handleSend() {
    if (messageMode === 'template' && !selectedTemplateName) {
      toast.error('Please select an approved WhatsApp template.')
      return
    }

    if (messageMode === 'custom' && !customText.trim() && !headerImageUrl && selectedProductIds.length === 0) {
      toast.error('Please enter custom text or attach an image.')
      return
    }

    if (resolvedRecipients.length === 0) {
      toast.error('Please specify at least one valid recipient phone number.')
      return
    }

    try {
      setIsSending(true)

      // Direct single dispatch using /api/send-catalog if single contact
      if (audienceType === 'single') {
        const phone = resolvedRecipients[0]
        const res = await fetch('/api/send-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            recipient: phone,
            recipients: [phone],
            products: selectedProductIds,
            productIds: selectedProductIds,
            customMessage: messageMode === 'custom' ? customText : (customNote || undefined),
            template: messageMode === 'template' ? selectedTemplateName : undefined,
            templateName: messageMode === 'template' ? selectedTemplateName : undefined,
            templateLanguage: messageMode === 'template' ? (selectedTemplate?.language || 'en_US') : undefined,
            templateCategory: messageMode === 'template' ? (selectedTemplate?.category || 'MARKETING') : undefined,
            templateComponents: messageMode === 'template' ? (selectedTemplate?.components || []) : [],
            templateHeaderImageUrl: headerImageUrl || undefined,
            imageUrl: headerImageUrl || undefined,
            variables: messageMode === 'template' ? templateVariables : [],
            templateVariables: messageMode === 'template' ? templateVariables : []
          })
        })

        const data = await res.json()
        if (!res.ok || data.success === false) {
          const failMsg = (data.results || []).find(r => !r.success)?.error || data.error || 'Failed to send message'
          throw new Error(failMsg)
        }
        toast.success(`Message sent successfully to +${phone}!`)
        return
      }

      // Bulk Broadcast Dispatch via /api/campaigns
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim() || 'WhatsApp Broadcast',
          campaignType: messageMode === 'custom' ? (headerImageUrl ? 'custom_media' : 'custom_text') : 'template',
          template: messageMode === 'template' ? selectedTemplateName : undefined,
          templateLanguage: messageMode === 'template' ? (selectedTemplate?.language || 'en') : undefined,
          templateCategory: messageMode === 'template' ? (selectedTemplate?.category || 'MARKETING') : undefined,
          templateHeaderImageUrl: headerImageUrl || undefined,
          message: messageMode === 'custom' ? customText : getTemplateBody(selectedTemplate),
          variables: messageMode === 'template' ? templateVariables : [],
          productIds: selectedProductIds,
          audience: audienceType,
          recipients: audienceType === 'custom' ? resolvedRecipients : [],
          status: 'scheduled'
        })
      })

      const createData = await createRes.json()
      if (!createRes.ok || !createData.id) {
        throw new Error(createData.error || 'Failed to initialize broadcast')
      }

      const sendRes = await fetch(`/api/campaigns/${createData.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const sendData = await sendRes.json()
      if (!sendRes.ok || sendData.success === false) {
        const failed = (sendData.results || []).filter(r => !r.success).map(r => r.error).filter(Boolean)
        throw new Error(failed[0] || sendData.error || 'Broadcast dispatch failed')
      }

      const count = sendData.results?.filter(r => r.success)?.length || resolvedRecipients.length
      toast.success(`Broadcast sent successfully to ${count} recipient(s)!`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsSending(false)
    }
  }

  const renderPreviewText = (text) => {
    if (!text) return null
    const parts = text.split(/(\{\{\d+\}\})/g)
    return parts.map((part, i) => {
      if (part.match(/\{\{\d+\}\}/)) {
        return <span key={i} className="font-bold text-blue-600 mx-1">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 overflow-hidden relative rounded-xl border border-slate-200 shadow-sm">
      <Toaster position="top-right" richColors />

      {/* Studio Header */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <Megaphone className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Broadcast & Campaign Studio</h1>
            <p className="text-[11px] text-slate-500">
              Send approved WhatsApp templates & catalog products to single contacts or mass audiences.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
            {audienceType === 'single' ? 'Single Message' : `Broadcast (${resolvedRecipients.length} Recipients)`}
          </div>
        </div>
      </header>

      {/* Main 3-Column Studio */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* ===================== COLUMN 1: STEP 1 - AUDIENCE ===================== */}
        <section className="w-full md:w-1/4 md:min-w-[280px] lg:min-w-[320px] bg-slate-50 p-5 flex flex-col gap-5 overflow-y-auto border-r border-slate-200 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">Step 1</span>
            <h2 className="text-sm font-bold text-slate-900 mb-3">Choose Audience</h2>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAudienceType('single')}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                  audienceType === 'single' 
                    ? 'border-blue-600 bg-white ring-2 ring-blue-600/10 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Phone className={`w-4 h-4 mb-1 ${audienceType === 'single' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-xs font-bold text-slate-900">Single Contact</p>
                <p className="text-[10px] text-slate-400">1 Customer</p>
              </button>

              <button
                type="button"
                onClick={() => setAudienceType('all_customers')}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                  audienceType === 'all_customers' 
                    ? 'border-blue-600 bg-white ring-2 ring-blue-600/10 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Users className={`w-4 h-4 mb-1 ${audienceType === 'all_customers' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-xs font-bold text-slate-900">All Customers</p>
                <p className="text-[10px] text-slate-400">{(audienceCounts.allCustomers || 0).toLocaleString()} Total</p>
              </button>

              <button
                type="button"
                onClick={() => setAudienceType('recent_buyers')}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                  audienceType === 'recent_buyers' 
                    ? 'border-blue-600 bg-white ring-2 ring-blue-600/10 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Clock3 className={`w-4 h-4 mb-1 ${audienceType === 'recent_buyers' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-xs font-bold text-slate-900">Recent Buyers</p>
                <p className="text-[10px] text-slate-400">Last 30 days</p>
              </button>

              <button
                type="button"
                onClick={() => setAudienceType('custom')}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                  audienceType === 'custom' 
                    ? 'border-blue-600 bg-white ring-2 ring-blue-600/10 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Wand2 className={`w-4 h-4 mb-1 ${audienceType === 'custom' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-xs font-bold text-slate-900">Custom List</p>
                <p className="text-[10px] text-slate-400">Select / CSV</p>
              </button>
            </div>
          </div>

          {/* AUDIENCE INPUT DETAILS */}
          {audienceType === 'single' ? (
            <div className="space-y-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <Label className="text-xs font-bold text-slate-800">Customer Phone Number</Label>
              <Input 
                className="bg-slate-50 border-slate-200 text-xs h-8 rounded-lg"
                value={singlePhone}
                onChange={(e) => setSinglePhone(e.target.value)}
                placeholder="e.g. 917210562014"
              />
              <p className="text-[10px] text-slate-400">Include country code without +</p>

              <div className="pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">Quick Pick from Recent Chats</Label>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredContacts.map(c => {
                    const isSelected = singlePhone === c.phone
                    return (
                      <div
                        key={c.phone}
                        onClick={() => setSinglePhone(c.phone)}
                        className={`p-2 rounded-lg cursor-pointer text-xs flex items-center justify-between ${
                          isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className={`font-semibold truncate text-[11px] ${isSelected ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                          <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>+{c.phone}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : audienceType === 'custom' ? (
            <div className="space-y-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800">Select Contacts ({selectedContacts.length})</Label>
                <div className="flex gap-2 text-[10px]">
                  <button type="button" onClick={() => setSelectedContacts(filteredContacts.map(c => c.phone))} className="text-blue-600 font-bold hover:underline">Select All</button>
                  <button type="button" onClick={() => setSelectedContacts([])} className="text-slate-400 hover:underline">Clear</button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {filteredContacts.map(c => {
                  const isChecked = selectedContacts.includes(c.phone)
                  return (
                    <div
                      key={c.phone}
                      onClick={() => toggleContactCheckbox(c.phone)}
                      className={`p-2 rounded-lg cursor-pointer text-xs flex items-center justify-between ${
                        isChecked ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold text-slate-900 truncate text-[11px]">{c.name}</p>
                        <p className="text-[10px] text-slate-500">+{c.phone}</p>
                      </div>
                      <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded text-blue-600 h-3.5 w-3.5" />
                    </div>
                  )
                })}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">Or Paste Multiple Numbers</Label>
                <Textarea 
                  className="bg-slate-50 border-slate-200 text-xs p-2 rounded-lg"
                  rows={2}
                  value={customPhones}
                  onChange={(e) => setCustomPhones(e.target.value)}
                  placeholder="917210562014, 919876543210..."
                />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
              <Label className="text-xs font-bold text-slate-800">Broadcast Campaign Name</Label>
              <Input 
                className="bg-slate-50 border-slate-200 text-xs h-8 rounded-lg"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Festive Sale Blast"
              />
            </div>
          )}

          {/* Cost Preview Box */}
          {audienceType !== 'single' && (
            <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-blue-900">Estimated Cost</span>
                <span className="text-sm font-bold text-blue-700">₹{estimatedCost}</span>
              </div>
              <p className="text-[10px] text-blue-600/80">
                Meta rate (₹0.78 / msg) for {resolvedRecipients.length} recipients.
              </p>
            </div>
          )}
        </section>

        {/* ===================== COLUMN 2: STEP 2 - TEMPLATE & PRODUCTS ===================== */}
        <section className="flex-1 bg-white p-5 lg:p-6 flex flex-col gap-5 overflow-y-auto border-r border-slate-200">
          
          {/* MODE SELECTOR: APPROVED TEMPLATES VS CUSTOM IMAGE/TEXT */}
          <div className="space-y-3 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Step 2</span>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  {messageMode === 'template' ? 'Select Approved WhatsApp Template' : 'Compose Custom Image & Text Message'}
                </h2>
              </div>
              
              {/* MODE TOGGLE PILLS */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setMessageMode('template')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 ${
                    messageMode === 'template'
                      ? 'bg-white text-blue-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Approved Template
                </button>
                <button
                  type="button"
                  onClick={() => setMessageMode('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 ${
                    messageMode === 'custom'
                      ? 'bg-blue-600 text-white shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Custom Image & Text
                </button>
              </div>
            </div>

            {/* TEMPLATE MODE */}
            {messageMode === 'template' ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    {['ALL', 'UTILITY', 'MARKETING'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTemplateFilter(cat)}
                        className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                          templateFilter === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat === 'UTILITY' ? 'Utility (Free)' : cat}
                      </button>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={loadTemplates} disabled={loadingTemplates} className="h-7 px-2 text-[11px] rounded-lg">
                    <RefreshCw className={`w-3 h-3 mr-1 ${loadingTemplates ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Horizontal Scrolling Templates Deck */}
                <div className="flex gap-3 overflow-x-auto pb-2.5 pt-1 scrollbar-thin scroll-smooth">
                  {filteredTemplates.length === 0 ? (
                    <div className="w-full py-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                      {loadingTemplates ? 'Loading Meta approved templates...' : 'No approved templates found in this category.'}
                    </div>
                  ) : (
                    filteredTemplates.map((template) => {
                      const isSelected = selectedTemplateName === template.name
                      const isUtility = (template.category || '').toUpperCase() === 'UTILITY'
                      return (
                        <div
                          key={template.name}
                          onClick={() => selectTemplate(template)}
                          className={`min-w-[280px] max-w-[320px] shrink-0 p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-2 select-none ${
                            isSelected 
                              ? 'border-blue-600 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 ring-2 ring-blue-600/20 shadow-md scale-[1.01]' 
                              : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 truncate" title={template.name}>
                                  {template.name}
                                </span>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                  isUtility ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {template.category || 'MARKETING'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                                  {template.language || 'en'}
                                </span>
                              </div>
                            </div>

                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              Approved
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 line-clamp-3 bg-slate-50/90 border border-slate-100 p-2 rounded-lg font-mono text-[10.5px] leading-relaxed">
                            {getTemplateBody(template)}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* CUSTOM IMAGE & TEXT COMPOSER */
              <div className="space-y-3.5 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Custom Message Body</Label>
                    <span className="text-[10px] text-slate-400 font-medium">Supports WhatsApp formatting (*bold*, _italic_)</span>
                  </div>
                  <Textarea
                    rows={4}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Write your custom announcement or promotional message here..."
                    className="bg-slate-50 border-slate-200 text-xs rounded-xl p-3 leading-relaxed focus:bg-white transition-all"
                  />
                  
                  {/* Dynamic Variable Quick-Insert Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Insert:</span>
                    {[
                      { tag: '{{customer_name}}', label: '👤 Name' },
                      { tag: '{{catalog_link}}', label: '🔗 Store Link' },
                      { tag: '{{product_name}}', label: '👗 Product' },
                      { tag: '{{order_number}}', label: '📦 Order #' }
                    ].map(chip => (
                      <button
                        key={chip.tag}
                        type="button"
                        onClick={() => setCustomText(prev => prev + (prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' ') + chip.tag)}
                        className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] border border-blue-200 transition-colors"
                      >
                        {chip.label}
                      </button>
                    ))}

                    {selectedProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const selectedProds = products.filter(p => selectedProductIds.includes(p.id))
                          const lines = selectedProds.map((p, idx) => {
                            const price = p.price || p.variants?.[0]?.price ? `₹${p.price || p.variants?.[0]?.price}` : ''
                            const link = p.url || (p.handle ? `https://vaclavfashion.com/products/${p.handle}` : '')
                            return `${idx + 1}️⃣ *${p.title || p.name}* ${price ? `— ${price}` : ''}${link ? `\n🔗 ${link}` : ''}`
                          })
                          const catalogBlock = `🛍️ *Our Featured Products:*\n\n${lines.join('\n\n')}\n\n✨ Tap any link to order or reply to chat!`
                          setCustomText(prev => prev.trim() ? `${prev.trim()}\n\n${catalogBlock}` : catalogBlock)
                          toast.success(`Inserted ${selectedProds.length} product(s) into message!`)
                        }}
                        className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-sm transition-colors flex items-center gap-1"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        + Insert {selectedProductIds.length} Products
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION B: SHOPIFY PRODUCT CATALOG (HORIZONTAL ROWS) */}
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  Attach Shopify Catalog Products ({selectedProductIds.length} Selected)
                </h2>
                <p className="text-[11px] text-slate-500">Pick products to feature in the catalog or banner</p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search product..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 h-7 text-xs bg-slate-50 border-slate-200 rounded-lg w-40"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadProducts} className="h-7 px-2 text-[11px] rounded-lg">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Sync
                </Button>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-72">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id)
                const imageSrc = product.image || (product.images && product.images[0]?.src) || ''
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-600/10 shadow-sm' 
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                        {imageSrc ? (
                          <img src={imageSrc} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 truncate">{product.title || product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-blue-600">
                            ₹{product.price || product.variants?.[0]?.price || '0.00'}
                          </span>
                          {product.vendor && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                              {product.vendor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                        isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ===================== COLUMN 3: STEP 3 - PREVIEW & DISPATCH ===================== */}
        <section className="w-full md:w-1/3 md:min-w-[320px] lg:min-w-[350px] bg-slate-50 p-5 lg:p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Step 3</span>
            <h2 className="text-sm font-bold text-slate-900">Preview & Dispatch</h2>
          </div>

          {/* Header Image Dropzone (When template supports Image/Media OR custom mode) */}
          {templateSupportsMediaHeader && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5 text-blue-600" />
                  {messageMode === 'custom' ? 'Promotional Banner / Image' : 'Header Image Banner'}
                </Label>
                {headerImageUrl && (
                  <button type="button" onClick={() => setHeaderImageUrl('')} className="text-[11px] text-rose-600 hover:underline font-semibold">
                    Clear
                  </button>
                )}
              </div>

              {headerImageUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-32 flex items-center justify-center">
                  <img src={headerImageUrl} alt="Header" className="w-full h-full object-cover max-h-32" />
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-lg text-center cursor-pointer transition-colors bg-slate-50"
                >
                  <input type="file" ref={fileInputRef} onChange={handleHeaderImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
                  {uploadingImage ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-blue-600 font-semibold py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading...
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <ImagePlus className="w-4 h-4 text-slate-400 mx-auto" />
                      <p className="text-[11px] font-bold text-slate-700">Click to upload banner image</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Variable Mapping (Only in Template Mode) */}
          {messageMode === 'template' && selectedTemplateSlots.length > 0 && (
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800">Dynamic Template Variables</Label>
                <span className="text-[10px] text-slate-400 font-medium">Mapped to Shopify & Custom Data</span>
              </div>
              
              <div className="space-y-2.5">
                {selectedTemplateSlots.map((slot, index) => {
                  const rawVal = templateVariables[index] || ''
                  const isDynamic = rawVal.startsWith('{{') && rawVal.endsWith('}}')
                  const selectValue = isDynamic ? rawVal : 'custom'

                  return (
                    <div key={slot.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">{slot.label}</span>
                        {slot.example && <span className="text-slate-400 text-[10px]">e.g. {slot.example}</span>}
                      </div>

                      <Select 
                        value={selectValue} 
                        onValueChange={(val) => {
                          if (val === 'custom') {
                            handleVariableChange(index, slot.example || '')
                          } else {
                            handleVariableChange(index, val)
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs bg-white border-slate-200 rounded-lg shadow-2xs">
                          <SelectValue placeholder="Select variable mapping" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom" className="text-xs font-semibold text-blue-600">
                            ✏️ Custom text / URL
                          </SelectItem>
                          <SelectItem value="{{customer_name}}" className="text-xs">👤 Customer name</SelectItem>
                          <SelectItem value="{{customer_phone}}" className="text-xs">📞 Customer phone</SelectItem>
                          <SelectItem value="{{order_number}}" className="text-xs">📦 Order number</SelectItem>
                          <SelectItem value="{{catalog_link}}" className="text-xs">🔗 Catalog link</SelectItem>
                          <SelectItem value="{{product_name}}" className="text-xs">👗 First product name</SelectItem>
                          <SelectItem value="{{product_price}}" className="text-xs">💰 First product price</SelectItem>
                          <SelectItem value="{{product_link}}" className="text-xs">🌐 First product direct link</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Custom Text Input Box */}
                      {selectValue === 'custom' && (
                        <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          <Input
                            type="text"
                            value={rawVal === 'custom' || rawVal === 'text' ? '' : rawVal}
                            onChange={(e) => handleVariableChange(index, e.target.value)}
                            placeholder={slot.example ? `Enter value (e.g. ${slot.example})` : 'Enter custom text or URL...'}
                            className="h-7 text-xs bg-white border-blue-300 focus:border-blue-500 rounded-lg shadow-2xs font-medium"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Live Phone Screen Preview */}
          <div className="space-y-1">
            <div className="bg-slate-900 rounded-[26px] p-2 shadow-xl border-4 border-slate-800 max-w-[260px] mx-auto">
              <div className="bg-[#EFEAE2] rounded-[18px] p-2.5 min-h-[260px] flex flex-col justify-end space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 bg-[#075E54] text-white p-2 flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">W</div>
                  <span className="text-[10px] font-bold truncate">Store Official</span>
                </div>

                <div className="bg-white rounded-xl p-2.5 shadow-sm space-y-1 max-w-[95%] self-start mt-6">
                  {headerImageUrl && (
                    <div className="rounded-lg overflow-hidden max-h-24 bg-slate-100">
                      <img src={headerImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {messageMode === 'custom' 
                      ? renderedCustomTextPreview 
                      : renderPreviewText(fillTemplatePreview(getTemplateBody(selectedTemplate) || 'Your message preview...', templateVariables))}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[8px] text-slate-400">
                    <span>12:00 PM</span>
                    <CheckCheck className="w-3 h-3 text-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final Action Launch Button */}
          <div className="pt-1">
            <Button
              onClick={handleSend}
              disabled={isSending || (messageMode === 'template' && !selectedTemplateName) || (messageMode === 'custom' && !customText.trim())}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending Message...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {messageMode === 'custom' ? 'Send Custom Message' : 'Send Message to Customer'}
                </>
              )}
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
