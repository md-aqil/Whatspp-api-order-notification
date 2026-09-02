'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { CheckCircle2, CheckCheck, Loader2, ImagePlus, RefreshCw, Send, Users, Clock3, Wand2, HelpCircle, X, Search, PlusCircle, Check, Package, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const audienceOptions = [
  { value: 'all_customers', label: 'All Customers', description: '12,482 recipients', icon: Users },
  { value: 'recent_buyers', label: 'Recent Buyers', description: 'Last 30 days • 843 recipients', icon: Clock3 },
  { value: 'custom', label: 'Custom List', description: 'Upload CSV or select segments', icon: Wand2 }
]


const variableOptions = [
  { value: 'text', label: 'Custom text', hint: 'Type any value manually.' },
  { value: '{{customer_name}}', label: 'Customer name', hint: 'Uses the recipient name when available.' },
  { value: '{{customer_phone}}', label: 'Customer phone', hint: 'Uses the recipient phone number.' },
  { value: '{{order_number}}', label: 'Order number', hint: 'Uses the latest known order number for the recipient.' },
  { value: '{{catalog_link}}', label: 'Catalog link', hint: 'Uses your WhatsApp or store catalog link.' }
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
    name: 'Summer Collection Launch 2024',
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

export default function CampaignsPage() {
  const [templates, setTemplates] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [campaignForm, setCampaignForm] = useState(buildEmptyCampaign)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [sendingCampaignId, setSendingCampaignId] = useState(null)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [audienceCounts, setAudienceCounts] = useState({ allCustomers: 0, recentBuyers: 0 })
  const [existingContacts, setExistingContacts] = useState([])
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactPicker, setShowContactPicker] = useState(false)
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

  function updateVariable(index, value) {
    setCampaignForm((current) => {
      const variables = [...current.variables]
      variables[index] = value
      return { ...current, variables }
    })
  }

  function toggleProduct(id) {
    setSelectedProducts(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      if (next.length > 0 && selectedTemplate?.components?.some(c => c.format === 'IMAGE')) {
        const prod = products.find(p => p.id === next[0])
        if (prod?.image && !campaignForm.templateHeaderImageUrl) {
          setCampaignForm(c => ({ ...c, templateHeaderImageUrl: prod.image }))
        }
      }
      return next
    })
  }

  const customRecipients = useMemo(() => {
    return campaignForm.recipientPhones.split(/[\n,]/).map((p) => p.trim()).filter(Boolean)
  }, [campaignForm.recipientPhones])

  const filteredExistingContacts = useMemo(() => {
    if (!contactSearchTerm.trim()) return existingContacts
    const term = contactSearchTerm.toLowerCase()
    return existingContacts.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term))
  }, [existingContacts, contactSearchTerm])

  function toggleContactSelection(phone) {
    const raw = String(phone).replace(/\D/g, '')
    const currentList = campaignForm.recipientPhones.split(/[\n,]/).map(p => p.trim()).filter(Boolean)
    let nextList
    if (currentList.includes(raw)) {
      nextList = currentList.filter(p => p !== raw)
    } else {
      nextList = [...currentList, raw]
    }
    setCampaignForm(c => ({ ...c, recipientPhones: nextList.join(', ') }))
  }

  function selectAllFilteredContacts() {
    const allPhones = filteredExistingContacts.map(c => c.phone)
    const currentList = new Set(campaignForm.recipientPhones.split(/[\n,]/).map(p => p.trim()).filter(Boolean))
    allPhones.forEach(p => currentList.add(p))
    setCampaignForm(c => ({ ...c, recipientPhones: Array.from(currentList).join(', ') }))
    toast.success(`Selected ${allPhones.length} contacts`)
  }

  function deselectAllFilteredContacts() {
    const filteredPhones = new Set(filteredExistingContacts.map(c => c.phone))
    const currentList = campaignForm.recipientPhones.split(/[\n,]/).map(p => p.trim()).filter(Boolean)
    const nextList = currentList.filter(p => !filteredPhones.has(p))
    setCampaignForm(c => ({ ...c, recipientPhones: nextList.join(', ') }))
  }

  const dynamicAudienceOptions = useMemo(() => [
    {
      value: 'all_customers',
      label: 'All Customers',
      description: `${audienceCounts.allCustomers.toLocaleString()} recipients in chat & store`,
      count: audienceCounts.allCustomers,
      icon: Users
    },
    {
      value: 'recent_buyers',
      label: 'Recent Buyers',
      description: `Last 30 days • ${audienceCounts.recentBuyers.toLocaleString()} buyers`,
      count: audienceCounts.recentBuyers,
      icon: Clock3
    },
    {
      value: 'custom',
      label: 'Custom List',
      description: customRecipients.length > 0 ? `${customRecipients.length.toLocaleString()} phone numbers loaded` : 'Select contacts, upload CSV, or type numbers',
      count: customRecipients.length,
      icon: Wand2
    }
  ], [audienceCounts, customRecipients.length])

  const selectedAudienceObj = dynamicAudienceOptions.find(o => o.value === campaignForm.audience) || dynamicAudienceOptions[0]
  const recipientCount = selectedAudienceObj.count || 0
  const estimatedCostInr = (recipientCount * 0.78).toFixed(2)

  const templateVariableCount = selectedTemplateSlots.length
  const trimmedVariableValues = campaignForm.variables.slice(0, templateVariableCount).map((v) => v.trim())
  const previewText = fillTemplatePreview(campaignForm.templateBody || getTemplateBody(selectedTemplate), trimmedVariableValues)

  async function handleSendCampaign() {
    if (!campaignForm.template) return toast.error('Select a template')
    if (campaignForm.audience === 'custom' && customRecipients.length === 0) return toast.error('Enter custom recipients')
    try {
      setSavingCampaign(true)
      const payload = {
        name: campaignForm.name.trim(),
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
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save campaign')
      toast.success('Campaign saved and scheduled!')
      
      // Auto-send immediately for this demo logic if we wanted, but API is standard.
      const sendResp = await fetch(`/api/campaigns/${data.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if(sendResp.ok) {
         toast.success('Campaign sent successfully')
      }
    } catch (error) { toast.error(error.message) }
    finally { setSavingCampaign(false) }
  }

  // Preview text renderer to style actual text
  const renderPreviewText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\{\{\d+\}\})/g);
    return parts.map((part, i) => {
      if (part.match(/\{\{\d+\}\}/)) {
        return <span key={i} className="font-bold text-blue-600 mx-1">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="campaigns-scene flex flex-col h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 overflow-hidden relative rounded-lg border border-slate-200">
      <Toaster />


      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Column 1: Setup */}
        <section className="w-full md:w-1/4 md:min-w-[280px] lg:min-w-[320px] bg-slate-50 p-6 lg:p-8 flex flex-col gap-6 lg:gap-10 overflow-y-auto border-r border-slate-200 shrink-0">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4">Identity</label>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900">Campaign Name</label>
              <Input 
                className="w-full bg-white border-slate-200 focus:ring-2 focus:ring-blue-600 rounded-xl px-4 py-6 text-sm shadow-sm transition-all" 
                value={campaignForm.name}
                onChange={(e) => setCampaignForm(current => ({ ...current, name: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4">Target Audience</label>
            <div className="space-y-3">
              {dynamicAudienceOptions.map((opt) => {
                const active = campaignForm.audience === opt.value
                const Icon = opt.icon
                return (
                  <button 
                    key={opt.value}
                    onClick={() => setCampaignForm(c => ({ ...c, audience: opt.value }))}
                    className={`w-full text-left p-4 rounded-xl transition-all flex items-start gap-4 ${active ? 'bg-white border-2 border-blue-600 ring-2 ring-blue-600/10' : 'bg-white border-2 border-transparent hover:border-slate-200 shadow-sm'}`}
                  >
                    <Icon className={active ? 'text-blue-600' : 'text-slate-500'} />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-1">{opt.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {campaignForm.audience === 'custom' && (
              <div className="mt-4 space-y-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Select Existing Contacts
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {customRecipients.length} Selected
                  </span>
                </div>

                {/* Search Contacts */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <Input
                    placeholder="Search contact name or phone..."
                    value={contactSearchTerm}
                    onChange={e => setContactSearchTerm(e.target.value)}
                    className="pl-8 bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg text-xs h-8"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <button
                    type="button"
                    onClick={selectAllFilteredContacts}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Select All ({filteredExistingContacts.length})
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFilteredContacts}
                    className="text-slate-400 font-medium hover:text-slate-600"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Scrollable contacts list */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {filteredExistingContacts.length === 0 ? (
                    <div className="text-xs text-slate-400 py-3 text-center">No matching contacts found</div>
                  ) : filteredExistingContacts.map((contact) => {
                    const isSelected = customRecipients.includes(contact.phone)
                    return (
                      <div
                        key={contact.id || contact.phone}
                        onClick={() => toggleContactSelection(contact.phone)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors pt-2 ${isSelected ? 'bg-blue-50/70 border border-blue-200' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {contact.name?.substring(0, 2).toUpperCase() || 'CU'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{contact.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">+{contact.phone}</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* CSV & Direct Input Section */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Or Upload CSV / Type</label>
                    <button 
                      onClick={() => document.getElementById('csv-upload').click()}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" /> Upload CSV
                    </button>
                    <input 
                      id="csv-upload" 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const text = event.target.result
                            const phones = text.split(/[\n,]/).map(p => p.trim()).filter(p => /^\d+$/.test(p))
                            if (phones.length > 0) {
                              setCampaignForm(c => ({...c, recipientPhones: phones.join(', ')}))
                              toast.success(`Loaded ${phones.length} phone numbers from CSV`)
                            } else {
                              toast.error('No valid phone numbers found in CSV')
                            }
                          }
                          reader.readAsText(file)
                        }
                      }}
                    />
                  </div>
                  <Textarea 
                    placeholder="e.g. 919876543210, 919876543211"
                    value={campaignForm.recipientPhones}
                    onChange={e => setCampaignForm(c => ({...c, recipientPhones: e.target.value}))}
                    className="bg-slate-50 rounded-xl resize-none text-[11px] font-mono border-none"
                    rows={3}
                  />
                  <p className="text-[10px] text-slate-400">Include country code without + (e.g. 91...)</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto p-4 rounded-xl bg-slate-100/50 border border-slate-200 mt-6 lg:mt-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold">Estimated Cost</span>
              <span className="text-xs font-bold text-blue-600">₹{estimatedCostInr}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1">
              <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${Math.min(100, Math.max(5, recipientCount > 0 ? 100 : 0))}%` }}></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              Based on current WhatsApp Marketing rate (₹0.78 / msg) for {recipientCount.toLocaleString()} {recipientCount === 1 ? 'recipient' : 'recipients'}.
            </p>
          </div>
        </section>

        {/* Column 2: Template & Preview */}
        <section className="flex-1 bg-white p-6 lg:p-8 flex flex-col gap-6 lg:gap-8 overflow-y-auto w-full">
          <div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Approved Templates</h2>
                <p className="text-sm text-slate-500">Select a pre-approved Meta template to start</p>
              </div>
              <button disabled={loading} onClick={loadTemplates} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {templates.length === 0 && !loading && <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl">No templates found</div>}
              {templates.map(template => {
                const active = campaignForm.template === template.name
                return (
                  <div 
                    key={template.id || template.name}
                    onClick={() => selectTemplate(template)}
                    className={`group relative p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all ${active ? 'bg-white border-2 border-blue-600 shadow-sm' : 'bg-slate-50 hover:bg-white border-2 border-transparent hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                        {template.category === 'MARKETING' ? <Search className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{template.name}</p>
                        <p className="text-xs text-slate-500">{template.category} • {template.language}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">Approved</span>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-[400px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-6">Live Preview</label>
            <div className="flex-1 rounded-3xl bg-slate-50 p-6 lg:p-10 flex items-center justify-center relative overflow-hidden border border-slate-200/50">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#005cc0 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
              
              <div className="w-full max-w-sm shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 border border-slate-200">
                {campaignForm.templateHeaderImageUrl && (
                  <div className="bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="w-full h-48 object-cover rounded-t-xl rounded-b-sm" src={campaignForm.templateHeaderImageUrl} alt="Header" />
                  </div>
                )}
                {!campaignForm.templateHeaderImageUrl && selectedTemplate?.components?.some(c => c.format==='IMAGE') && (
                  <div className="bg-slate-100 h-32 flex items-center justify-center text-slate-400 p-1">
                    <span className="text-xs">Image Header Placeholder</span>
                  </div>
                )}
                
                <div className="bg-white px-4 py-3 relative">
                  <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {renderPreviewText(previewText)}
                  </p>
                  <div className="flex justify-end items-center gap-1 mt-1">
                    <span className="text-[11px] text-slate-500">10:42 AM</span>
                    <CheckCheck className="text-blue-400 w-4 h-4" />
                  </div>
                </div>
                
                {selectedTemplate?.components?.find(c => c.type === 'BUTTONS') && (
                  <div className="bg-white border-t border-slate-100 p-2 space-y-2">
                    {selectedTemplate.components.find(c => c.type === 'BUTTONS').buttons.map((btn, i) => (
                      <button key={i} className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
                        {btn.text || 'Action Button'}
                      </button>
                    ))}
                  </div>
                )}
                {!selectedTemplate?.components?.find(c => c.type === 'BUTTONS') && selectedTemplate && (
                  <div className="bg-white border-t border-slate-100 p-2 space-y-2">
                      <button className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
                          View Catalog
                      </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Column 3: Mappings & Actions */}
        <section className="w-full md:w-1/4 md:min-w-[300px] lg:min-w-[340px] bg-slate-50 p-6 lg:p-8 flex flex-col gap-6 lg:gap-10 overflow-y-auto border-l border-slate-200 shrink-0">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4">Variable Mapping</label>
            <div className="space-y-4">
              {selectedTemplateSlots.length === 0 ? (
                <div className="text-xs text-slate-500">No variables required.</div>
              ) : selectedTemplateSlots.map((slot, index) => {
                const currentValue = campaignForm.variables[index] || ''
                const selectedOption = variableOptions.find((o) => o.value === currentValue)
                const selectValue = selectedOption ? currentValue : 'text'

                return (
                  <div key={slot.id} className="p-4 rounded-xl bg-white shadow-sm border border-transparent hover:border-blue-600/20 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">{index + 1}</span>
                      <span className="text-xs font-semibold text-slate-500">{slot.placeholder} Placeholder</span>
                    </div>
                    
                    <Select value={selectValue} onValueChange={(val) => updateVariable(index, val === 'text' ? '' : val)}>
                      <SelectTrigger className="w-full bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg px-3 py-2 text-sm font-medium">
                        <SelectValue placeholder="Map to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {variableOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    {selectValue === 'text' && (
                      <Input
                        className="mt-2 w-full bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg"
                        placeholder="Custom value"
                        value={currentValue}
                        onChange={(e) => updateVariable(index, e.target.value)}
                      />
                    )}
                  </div>
                )
              })}
              
              {selectedTemplate?.components?.some(c => c.format === 'IMAGE') && (
                <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ImagePlus className="w-4 h-4 text-blue-600" />
                      Header Image
                    </span>
                    {campaignForm.templateHeaderImageUrl && (
                      <button
                        onClick={() => setCampaignForm(c => ({ ...c, templateHeaderImageUrl: '' }))}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleHeaderImageUpload}
                  />

                  {/* Image Thumbnail Preview or Upload Dropzone */}
                  {campaignForm.templateHeaderImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={campaignForm.templateHeaderImageUrl}
                        alt="Header Banner"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg text-xs font-bold shadow"
                        >
                          Change Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-600 transition-colors bg-slate-50/50 hover:bg-blue-50/20"
                    >
                      {uploadingImage ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading photo...
                        </div>
                      ) : (
                        <>
                          <ImagePlus className="w-6 h-6 text-blue-500" />
                          <div className="text-center">
                            <span className="text-xs font-bold text-slate-800">Upload Header Image</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG or WEBP (up to 10MB)</p>
                          </div>
                        </>
                      )}
                    </button>
                  )}

                  {/* Fallback Direct URL Input */}
                  <div className="pt-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Or paste direct image URL
                    </label>
                    <Input
                      className="w-full bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg text-xs"
                      placeholder="https://.../image.jpg"
                      value={campaignForm.templateHeaderImageUrl}
                      onChange={(e) => setCampaignForm(c => ({ ...c, templateHeaderImageUrl: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Catalog Integration</label>
              <button disabled={loading} onClick={loadProducts} className="text-[10px] font-bold bg-blue-600 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:opacity-90 transition-opacity">
                <RefreshCw className="w-3.5 h-3.5" /> Fetch Meta
              </button>
            </div>
            <div className="space-y-3">
              {products.length === 0 ? (
                <div className="text-xs text-slate-500">No products available.</div>
              ) : products.map(product => {
                const isSelected = selectedProducts.includes(product.id)
                return (
                  <div key={product.id} onClick={() => toggleProduct(product.id)} className={`flex items-center gap-3 p-2 rounded-xl bg-white/50 border transition-colors cursor-pointer ${isSelected ? 'border-blue-600 bg-white shadow-sm' : 'border-slate-200/50 hover:bg-white'}`}>
                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                      ) : <Package className="w-full h-full p-3 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{product.title}</p>
                      <p className="text-[10px] text-slate-500">ID: {product.id} • ${product.price}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="h-20 bg-white shadow-[0_-8px_30px_rgb(0,0,0,0.04)] px-4 md:px-10 flex items-center justify-between z-20 shrink-0 border-t border-slate-200">
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
               <User className="w-4 h-4 text-slate-500"/>
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden text-[10px] font-bold text-slate-500">
              +4
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 hidden sm:block">Viewing as <span className="text-slate-900 font-bold">Marketing Team</span></p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto justify-end">
          <Button variant="ghost" className="px-6 py-3 rounded-xl text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors h-auto">
             Save Draft
          </Button>
          <Button disabled={savingCampaign} onClick={handleSendCampaign} className="px-8 py-3 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 h-auto hidden sm:flex">
             {savingCampaign ? 'Saving...' : 'Send Campaign'}
             <Send className="w-4 h-4 ml-1" />
          </Button>
          <Button disabled={savingCampaign} onClick={handleSendCampaign} size="icon" className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/20 rounded-xl sm:hidden flex-shrink-0">
             <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
