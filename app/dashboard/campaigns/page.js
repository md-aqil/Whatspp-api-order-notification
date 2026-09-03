'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { 
  CheckCircle2, CheckCheck, Loader2, ImagePlus, RefreshCw, Send, Users, 
  Clock3, Wand2, HelpCircle, X, Search, PlusCircle, Check, Package, User, 
  Megaphone, ShoppingBag, ArrowRight, ExternalLink, Sparkles, Filter, AlertCircle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const audienceOptions = [
  { value: 'all_customers', label: 'All Customers', description: 'Total connected store audience', icon: Users },
  { value: 'recent_buyers', label: 'Recent Buyers', description: 'Last 30 days active purchasers', icon: Clock3 },
  { value: 'custom', label: 'Custom List / Contacts', description: 'Pick specific contacts or paste numbers', icon: Wand2 }
]

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
    return value?.trim() || `[value ${rawIndex}]`
  })
}

function buildEmptyCampaign() {
  return {
    name: 'New WhatsApp Broadcast',
    audience: 'all_customers',
    recipientPhones: '',
    template: '',
    templateLanguage: '',
    templateCategory: '',
    templateHeaderImageUrl: '',
    templateBody: '',
    variables: [],
    scheduledAt: ''
  }
}

export default function BroadcastCatalogStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <BroadcastCatalogStudio />
    </Suspense>
  )
}

function BroadcastCatalogStudio() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const modeParam = searchParams.get('mode')
  
  const [activeMode, setActiveMode] = useState(modeParam === 'catalog' ? 'catalog' : 'broadcast')
  const [templates, setTemplates] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [campaignForm, setCampaignForm] = useState(buildEmptyCampaign)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [audienceCounts, setAudienceCounts] = useState({ allCustomers: 0, recentBuyers: 0 })
  const [existingContacts, setExistingContacts] = useState([])
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('ALL')
  const [selectedContacts, setSelectedContacts] = useState([])
  const [directCatalogRecipient, setDirectCatalogRecipient] = useState('')
  const [customCatalogMessage, setCustomCatalogMessage] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (modeParam === 'catalog') setActiveMode('catalog')
  }, [modeParam])

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
      setExistingContacts(Array.from(contactsMap.values()))
    } catch (e) {
      console.error('Failed to load audience stats:', e)
    }
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
      if (!res.ok) throw new Error(data.error || 'Failed to upload header image')
      const uploadedUrl = data.url || (data.urls && data.urls[0])
      if (uploadedUrl) {
        setCampaignForm(c => ({ ...c, templateHeaderImageUrl: uploadedUrl }))
        toast.success('Header image uploaded successfully!')
      }
    } catch (err) {
      toast.error(err.message || 'Image upload failed')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function loadTemplates() {
    try {
      setLoading(true)
      const response = await fetch('/api/whatsapp-templates')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load templates')
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) { toast.error(error.message) }
    finally { setLoading(false) }
  }

  async function loadProducts() {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) { console.error(error) }
  }

  const selectedTemplate = templates.find((t) => t.name === campaignForm.template) || null
  const selectedTemplateSlots = useMemo(() => getTemplateParameterSlots(selectedTemplate), [selectedTemplate])
  
  function selectTemplate(template) {
    const slots = getTemplateParameterSlots(template)
    setCampaignForm((current) => ({
      ...current,
      template: template.name,
      templateLanguage: template.language || '',
      templateCategory: template.category || '',
      templateBody: getTemplateBody(template),
      variables: Array.from({ length: slots.length }, (_, index) => current.variables[index] || inferVariableFromExample(slots[index]?.example, index))
    }))
  }

  function handleVariableChange(index, value) {
    setCampaignForm((current) => {
      const nextVariables = [...current.variables]
      nextVariables[index] = value
      return { ...current, variables: nextVariables }
    })
  }

  function toggleProduct(productId) {
    setSelectedProducts((current) => {
      const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]
      const selected = products.find(p => p.id === productId)
      if (selected?.image && !campaignForm.templateHeaderImageUrl) {
        setCampaignForm(c => ({ ...c, templateHeaderImageUrl: selected.image }))
      }
      return next
    })
  }

  function toggleContactSelection(phone) {
    setSelectedContacts(prev => {
      const exists = prev.includes(phone)
      if (exists) {
        const next = prev.filter(p => p !== phone)
        updateCampaignRecipients(next)
        return next
      } else {
        const next = [...prev, phone]
        updateCampaignRecipients(next)
        return next
      }
    })
  }

  function selectAllContacts() {
    const allPhones = filteredContacts.map(c => c.phone)
    setSelectedContacts(allPhones)
    updateCampaignRecipients(allPhones)
  }

  function deselectAllContacts() {
    setSelectedContacts([])
    updateCampaignRecipients([])
  }

  function updateCampaignRecipients(phones) {
    setCampaignForm(c => ({
      ...c,
      recipientPhones: phones.join(', ')
    }))
  }

  const filteredContacts = useMemo(() => {
    if (!contactSearchTerm) return existingContacts
    const term = contactSearchTerm.toLowerCase()
    return existingContacts.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.phone.includes(term)
    )
  }, [existingContacts, contactSearchTerm])

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products
    const term = productSearchTerm.toLowerCase()
    return products.filter(p => 
      (p.title || p.name || '').toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term) ||
      (p.vendor || '').toLowerCase().includes(term)
    )
  }, [products, productSearchTerm])

  const filteredTemplates = useMemo(() => {
    if (templateCategoryFilter === 'ALL') return templates
    return templates.filter(t => (t.category || '').toUpperCase() === templateCategoryFilter)
  }, [templates, templateCategoryFilter])

  const estimatedRecipientsCount = useMemo(() => {
    if (campaignForm.audience === 'all_customers') return audienceCounts.allCustomers || 1
    if (campaignForm.audience === 'recent_buyers') return audienceCounts.recentBuyers || 1
    const raw = campaignForm.recipientPhones || ''
    const customList = raw.split(/[\n,]/).map(p => p.trim()).filter(Boolean)
    return Math.max(customList.length, selectedContacts.length)
  }, [campaignForm.audience, campaignForm.recipientPhones, audienceCounts, selectedContacts])

  const estimatedCost = useMemo(() => {
    return (estimatedRecipientsCount * 0.78).toFixed(2)
  }, [estimatedRecipientsCount])

  const dynamicAudienceOptions = useMemo(() => [
    { value: 'all_customers', label: 'All Customers', description: `${(audienceCounts.allCustomers || 0).toLocaleString()} recipients`, icon: Users },
    { value: 'recent_buyers', label: 'Recent Buyers', description: `Last 30 days • ${(audienceCounts.recentBuyers || 0).toLocaleString()} recipients`, icon: Clock3 },
    { value: 'custom', label: 'Custom List / Contacts', description: `${selectedContacts.length} selected • Or paste numbers`, icon: Wand2 }
  ], [audienceCounts, selectedContacts])

  // Direct Catalog Send Handler
  async function handleDirectCatalogSend() {
    const recipient = directCatalogRecipient || selectedContacts[0] || (campaignForm.recipientPhones ? campaignForm.recipientPhones.split(/[\n,]/)[0]?.trim() : '')
    if (!recipient) {
      toast.error('Please enter or select a recipient phone number.')
      return
    }
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product from your catalog.')
      return
    }

    try {
      setSavingCampaign(true)
      const res = await fetch('/api/send-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: recipient.replace(/\D/g, ''),
          productIds: selectedProducts,
          customMessage: customCatalogMessage || undefined,
          template: campaignForm.template || undefined,
          templateHeaderImageUrl: campaignForm.templateHeaderImageUrl || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send catalog message')
      toast.success(`Catalog sent successfully to ${recipient}!`)
      setSelectedProducts([])
      setCustomCatalogMessage('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingCampaign(false)
    }
  }

  // Bulk Broadcast Launch Handler
  async function handleSendCampaign() {
    if (!campaignForm.template) {
      toast.error('Please select an approved WhatsApp template.')
      return
    }

    const trimmedVariableValues = campaignForm.variables.map(v => typeof v === 'string' ? v.trim() : v)
    const customRecipients = Array.from(new Set([
      ...selectedContacts,
      ...(campaignForm.recipientPhones || '').split(/[\n,]/).map(p => p.trim()).filter(Boolean)
    ]))

    if (campaignForm.audience === 'custom' && customRecipients.length === 0) {
      toast.error('Please select or enter at least one recipient phone number.')
      return
    }

    try {
      setSavingCampaign(true)
      const payload = {
        name: campaignForm.name.trim() || 'WhatsApp Broadcast',
        campaignType: 'template',
        template: campaignForm.template,
        templateLanguage: campaignForm.templateLanguage,
        templateCategory: campaignForm.templateCategory,
        templateHeaderImageUrl: campaignForm.templateHeaderImageUrl,
        message: campaignForm.templateBody,
        variables: trimmedVariableValues,
        productIds: selectedProducts,
        audience: campaignForm.audience,
        recipients: campaignForm.audience === 'custom' ? customRecipients : [],
        scheduledAt: campaignForm.scheduledAt || null,
        status: 'scheduled'
      }

      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const createData = await createRes.json()
      if (!createRes.ok || !createData.id) {
        throw new Error(createData.error || 'Failed to initialize campaign record')
      }

      const campaignId = createData.id
      const sendRes = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const sendData = await sendRes.json()
      if (!sendRes.ok || sendData.success === false) {
        const failedReasons = (sendData.results || [])
          .filter(r => !r.success)
          .map(r => r.error)
          .filter(Boolean)
        const errorMessage = failedReasons.length > 0 
          ? failedReasons[0] 
          : (sendData.error || sendData.message || 'Failed to dispatch WhatsApp template')
        throw new Error(errorMessage)
      }
      
      const sentCount = sendData.results?.filter(r => r.success)?.length || 0
      toast.success(`Broadcast sent successfully to ${sentCount} recipient(s)!`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingCampaign(false)
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

      {/* Studio Header Bar */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            {activeMode === 'broadcast' ? <Megaphone className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              {activeMode === 'broadcast' ? 'Broadcast Studio' : 'Catalog Share Studio'}
            </h1>
            <p className="text-xs text-slate-500">
              {activeMode === 'broadcast' ? 'Mass marketing & utility broadcasts to target audiences' : '1-to-1 and group Shopify product sharing via WhatsApp'}
            </p>
          </div>
        </div>

        {/* Mode Selector Segmented Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveMode('broadcast')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeMode === 'broadcast' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Bulk Broadcast
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('catalog')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeMode === 'catalog' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Direct Catalog Share
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* ===================== COLUMN 1: AUDIENCE & CONTACTS ===================== */}
        <section className="w-full md:w-1/4 md:min-w-[300px] lg:min-w-[330px] bg-slate-50 p-6 flex flex-col gap-6 overflow-y-auto border-r border-slate-200 shrink-0">
          {activeMode === 'broadcast' ? (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Broadcast Identity</label>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Campaign Name</Label>
                  <Input 
                    className="w-full bg-white border-slate-200 focus:ring-2 focus:ring-blue-600 rounded-xl px-3 py-2 text-sm shadow-sm" 
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm(c => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. Festival Season Launch"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Target Audience</label>
                <div className="space-y-2.5">
                  {dynamicAudienceOptions.map((opt) => {
                    const active = campaignForm.audience === opt.value
                    const Icon = opt.icon
                    return (
                      <button 
                        key={opt.value}
                        type="button"
                        onClick={() => setCampaignForm(c => ({ ...c, audience: opt.value }))}
                        className={`w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3.5 ${
                          active 
                            ? 'bg-white border-2 border-blue-600 ring-2 ring-blue-600/10 shadow-sm' 
                            : 'bg-white border border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {campaignForm.audience === 'custom' && (
                <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">Select Existing Contacts</Label>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {selectedContacts.length} Selected
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input 
                      placeholder="Search by name or phone..."
                      value={contactSearchTerm}
                      onChange={(e) => setContactSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <button type="button" onClick={selectAllContacts} className="text-blue-600 font-semibold hover:underline">
                      Select All ({filteredContacts.length})
                    </button>
                    <button type="button" onClick={deselectAllContacts} className="hover:underline">
                      Deselect All
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {filteredContacts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No matching contacts found</p>
                    ) : (
                      filteredContacts.map((contact) => {
                        const isSelected = selectedContacts.includes(contact.phone)
                        return (
                          <div 
                            key={contact.phone}
                            onClick={() => toggleContactSelection(contact.phone)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {contact.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <p className="font-semibold text-slate-900 truncate">{contact.name}</p>
                                <p className="text-[11px] text-slate-500">+{contact.phone}</p>
                              </div>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => {}} 
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0" 
                            />
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 block mb-1.5">Or Paste Phone Numbers</Label>
                    <Textarea 
                      className="w-full bg-slate-50 border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-600"
                      rows={2}
                      placeholder="917210562014, 919876543210..."
                      value={campaignForm.recipientPhones}
                      onChange={(e) => setCampaignForm(c => ({ ...c, recipientPhones: e.target.value }))}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Include country code without + (e.g. 91...)</p>
                  </div>
                </div>
              )}

              {/* Cost Estimator */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-blue-900">Estimated Cost</span>
                  <span className="text-base font-bold text-blue-700">₹{estimatedCost}</span>
                </div>
                <p className="text-[11px] text-blue-600/80">
                  Based on Meta WhatsApp Marketing rate (₹0.78 / msg) for {estimatedRecipientsCount} recipient(s).
                </p>
              </div>
            </>
          ) : (
            /* ===================== DIRECT CATALOG MODE: RECIPIENT SELECTOR ===================== */
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Target Customer</label>
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-slate-700">Recipient Phone Number</Label>
                  <Input 
                    className="w-full bg-white border-slate-200 focus:ring-2 focus:ring-blue-600 rounded-xl px-3 py-2 text-sm shadow-sm" 
                    value={directCatalogRecipient}
                    onChange={(e) => setDirectCatalogRecipient(e.target.value)}
                    placeholder="e.g. 917210562014"
                  />
                  <p className="text-[11px] text-slate-400">Include country code without + (e.g. 91...)</p>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800">Recent WhatsApp Chats</Label>
                  <span className="text-[11px] text-slate-400">{filteredContacts.length} Available</span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search customer..."
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                    className="pl-9 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 max-h-64 pr-1">
                  {filteredContacts.map((contact) => {
                    const isSelected = directCatalogRecipient === contact.phone
                    return (
                      <div 
                        key={contact.phone}
                        onClick={() => setDirectCatalogRecipient(contact.phone)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                          isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <p className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>{contact.name}</p>
                          <p className={`text-[11px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>+{contact.phone}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1.5">Optional Custom Message</Label>
                <Textarea 
                  className="w-full bg-white border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-600 shadow-sm"
                  rows={3}
                  placeholder="Check out these trending items curated for you..."
                  value={customCatalogMessage}
                  onChange={(e) => setCustomCatalogMessage(e.target.value)}
                />
              </div>
            </>
          )}
        </section>

        {/* ===================== COLUMN 2: TEMPLATES OR SHOPIFY PRODUCTS ===================== */}
        <section className="flex-1 bg-white p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto border-r border-slate-200">
          {activeMode === 'broadcast' ? (
            /* BROADCAST MODE: META APPROVED TEMPLATES */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Approved Meta Templates</h2>
                  <p className="text-xs text-slate-500">Select an approved WhatsApp template for your broadcast</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    {['ALL', 'UTILITY', 'MARKETING'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTemplateCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-md transition-all ${
                          templateCategoryFilter === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat === 'UTILITY' ? 'Utility (Free)' : cat}
                      </button>
                    ))}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTemplates} 
                    disabled={loading}
                    className="h-8 px-2.5 text-xs rounded-lg"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No approved templates found in this category</p>
                  <p className="text-xs text-slate-500 mt-1">Create or approve message templates in Meta WhatsApp Manager.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredTemplates.map((template) => {
                    const isSelected = campaignForm.template === template.name
                    const isUtility = (template.category || '').toUpperCase() === 'UTILITY'
                    return (
                      <div
                        key={template.name}
                        onClick={() => selectTemplate(template)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-600/10 shadow-sm' 
                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-900">{template.name}</span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isUtility ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {template.category || 'MARKETING'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {template.language || 'en'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Approved
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded-lg font-mono">
                          {getTemplateBody(template)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            /* DIRECT CATALOG MODE: SHOPIFY PRODUCT SELECTOR */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Shopify Product Catalog</h2>
                  <p className="text-xs text-slate-500">Pick products to include in your direct WhatsApp catalog message</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input 
                      placeholder="Search products..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="pl-9 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg w-48"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadProducts} 
                    className="h-8 px-2.5 text-xs rounded-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Sync
                  </Button>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Shopify products found</p>
                  <p className="text-xs text-slate-500 mt-1">Connect your Shopify store in Settings or verify your catalog sync.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredProducts.map((product) => {
                    const isSelected = selectedProducts.includes(product.id)
                    const imageSrc = product.image || (product.images && product.images[0]?.src) || ''
                    return (
                      <div
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-600/10 shadow-sm' 
                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                            {imageSrc ? (
                              <img src={imageSrc} alt={product.title} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{product.title || product.name}</p>
                            <p className="text-xs font-bold text-blue-600 mt-1">
                              ₹{product.price || product.variants?.[0]?.price || '0.00'}
                            </p>
                            {product.vendor && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{product.vendor}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 font-mono">ID: {product.id}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isSelected ? <Check className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                            {isSelected ? 'Selected' : 'Select'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ===================== COLUMN 3: LIVE PREVIEW & LAUNCH ===================== */}
        <section className="w-full md:w-1/3 md:min-w-[340px] lg:min-w-[380px] bg-slate-50 p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto shrink-0">
          
          {/* Header Image Dropzone (for Templates or Catalog) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-blue-600" />
                Header Image / Banner
              </Label>
              {campaignForm.templateHeaderImageUrl && (
                <button 
                  type="button"
                  onClick={() => setCampaignForm(c => ({ ...c, templateHeaderImageUrl: '' }))}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  Clear
                </button>
              )}
            </div>

            {campaignForm.templateHeaderImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-40 flex items-center justify-center">
                <img 
                  src={campaignForm.templateHeaderImageUrl} 
                  alt="Campaign Header" 
                  className="w-full h-full object-cover max-h-40" 
                />
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="p-4 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl text-center cursor-pointer transition-colors bg-slate-50"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleHeaderImageUpload} 
                  accept="image/jpeg,image/png,image/webp" 
                  className="hidden" 
                />
                {uploadingImage ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-blue-600 font-semibold py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <div className="space-y-1">
                    <ImagePlus className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">Click to upload header image</p>
                    <p className="text-[10px] text-slate-400">JPG, PNG, or WEBP up to 10MB</p>
                  </div>
                )}
              </div>
            )}

            <Input 
              placeholder="Or paste direct image URL (https://...)" 
              value={campaignForm.templateHeaderImageUrl}
              onChange={(e) => setCampaignForm(c => ({ ...c, templateHeaderImageUrl: e.target.value }))}
              className="text-xs h-8 bg-slate-50 border-slate-200 rounded-lg"
            />
          </div>

          {/* Dynamic Template Variables (if present) */}
          {selectedTemplateSlots.length > 0 && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <Label className="text-xs font-bold text-slate-800">Template Variables</Label>
              <div className="space-y-2.5">
                {selectedTemplateSlots.map((slot, index) => (
                  <div key={slot.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">{slot.label}</span>
                      {slot.example && <span className="text-slate-400">e.g. {slot.example}</span>}
                    </div>
                    <Select
                      value={campaignForm.variables[index] || 'text'}
                      onValueChange={(val) => handleVariableChange(index, val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg">
                        <SelectValue placeholder="Select variable mapping" />
                      </SelectTrigger>
                      <SelectContent>
                        {variableOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Phone Screen Preview */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Live WhatsApp Preview</Label>
            <div className="bg-slate-900 rounded-[32px] p-3 shadow-xl border-4 border-slate-800 max-w-[300px] mx-auto">
              <div className="bg-[#EFEAE2] rounded-[24px] p-3 min-h-[320px] flex flex-col justify-end space-y-2 relative overflow-hidden">
                {/* Header Mock */}
                <div className="absolute top-0 left-0 right-0 bg-[#075E54] text-white p-2.5 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">W</div>
                  <span className="text-xs font-bold">Store Bot</span>
                </div>

                {/* Message Bubble */}
                <div className="bg-white rounded-xl p-3 shadow-sm space-y-2 max-w-[95%] self-start mt-8">
                  {campaignForm.templateHeaderImageUrl && (
                    <div className="rounded-lg overflow-hidden max-h-28 bg-slate-100">
                      <img src={campaignForm.templateHeaderImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {renderPreviewText(fillTemplatePreview(campaignForm.templateBody || customCatalogMessage || 'Your message preview will appear here...', campaignForm.variables))}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400">
                    <span>12:00 PM</span>
                    <CheckCheck className="w-3 h-3 text-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Launch Button */}
          <div className="pt-2">
            {activeMode === 'broadcast' ? (
              <Button
                onClick={handleSendCampaign}
                disabled={savingCampaign || !campaignForm.template}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                {savingCampaign ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dispatching Broadcast...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Launch Broadcast Now
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleDirectCatalogSend}
                disabled={savingCampaign || selectedProducts.length === 0}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {savingCampaign ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Catalog...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Catalog to Customer
                  </>
                )}
              </Button>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
