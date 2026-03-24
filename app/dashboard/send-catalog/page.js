'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, CheckCircle2, ChevronRight, ChevronDown, RefreshCw, Send, User, BadgeCheck, Check, Info, Package, HelpCircle, X, CheckCheck } from 'lucide-react'

// Existing constants for Send Catalog
const variableOptions = [
  { value: 'text', label: 'Custom text', hint: 'Type any value manually.' },
  { value: '{{customer_name}}', label: 'Customer name', hint: 'Uses the selected contact name when available.' },
  { value: '{{customer_phone}}', label: 'Customer phone', hint: 'Uses the recipient phone number.' },
  { value: '{{order_number}}', label: 'Latest order number', hint: 'Uses the recipient’s most recent saved order.' },
  { value: '{{tracking_number}}', label: 'Tracking number', hint: 'Uses the latest saved tracking number when available.' },
  { value: '{{tracking_url}}', label: 'Tracking link', hint: 'Uses the latest saved tracking URL when available.' },
  { value: '{{order_product_name}}', label: 'Purchased product name', hint: 'Uses the first item from the recipient’s latest order.' },
  { value: '{{order_product_names}}', label: 'Purchased product names', hint: 'Combines up to the first 3 items from the recipient’s latest order.' },
  { value: '{{catalog_link}}', label: 'Catalog link', hint: 'Store-wide catalog URL.' },
  { value: '{{product_name}}', label: 'First product name', hint: 'Uses the first selected product name.' },
  { value: '{{product_price}}', label: 'First product price', hint: 'Uses the first selected product price.' },
  { value: '{{product_link}}', label: 'First product link', hint: 'Uses the first selected product URL.' },
  { value: '{{product_names}}', label: 'Selected product names', hint: 'Combines up to first 3 products.' }
]

const productDependentValues = new Set(['{{product_name}}', '{{product_price}}', '{{product_link}}', '{{product_names}}'])

function inferVariableFromExample(exampleText, index = 0, templateName = '') {
  const sample = String(exampleText || '').trim().toLowerCase()
  const templateLabel = String(templateName || '').trim().toLowerCase()
  const prefersOrderProductContext = /tracking|shipment|shipping|fulfill|delivery|order/i.test(templateLabel)
  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('order') && sample.includes('number')) return '{{order_number}}'
  if (sample.includes('tracking') && sample.includes('number')) return '{{tracking_number}}'
  if (sample.includes('tracking') && (sample.includes('link') || sample.includes('url'))) return '{{tracking_url}}'
  if (sample.includes('catalog') || sample.includes('collection')) return '{{catalog_link}}'
  if (sample.includes('product') && sample.includes('name')) return prefersOrderProductContext ? '{{order_product_name}}' : '{{product_name}}'
  if (sample.includes('product') && sample.includes('price')) return '{{product_price}}'
  if (sample.includes('product') && (sample.includes('link') || sample.includes('url'))) return '{{product_link}}'
  if (sample.includes('browse') || sample.includes('link') || sample.includes('url')) return '{{product_link}}'
  const fallbacks = prefersOrderProductContext
    ? ['{{customer_name}}', '{{order_number}}', '{{order_product_name}}', '{{tracking_url}}']
    : ['{{customer_name}}', '{{catalog_link}}', '{{product_name}}', '{{product_link}}']
  return fallbacks[index] || 'text' // returning 'text' if not matched
}

function getTemplateBody(template) {
  return template?.components?.find((component) => component.type === 'BODY')?.text || 'Select an approved template to preview the message.'
}

function getComponentExamples(component, key) {
  const examples = component?.example?.[key]
  if (Array.isArray(examples) && Array.isArray(examples[0])) return examples[0]
  return []
}

function getTemplateParameterSlots(template) {
  const slots = []
  for (const component of template?.components || []) {
    if (component?.type === 'HEADER' && component.format === 'TEXT') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getComponentExamples(component, 'header_text')
      matches.forEach((placeholder, index) => {
        slots.push({ id: `header-${index}`, componentType: 'HEADER', parameterType: 'text', placeholder, example: examples[index] || '', label: `Header ${placeholder}` })
      })
    }
    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getComponentExamples(component, 'body_text')
      matches.forEach((placeholder, index) => {
        slots.push({ id: `body-${index}`, componentType: 'BODY', parameterType: 'text', placeholder, example: examples[index] || '', label: `Body ${placeholder}` })
      })
    }
    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase()
        if (buttonType === 'MPM' || buttonType === 'CATALOG') {
          slots.push({ id: `button-action-${buttonIndex}`, componentType: 'BUTTON', parameterType: 'action', buttonType, label: `${buttonType} button`, example: button?.text || '' })
          return
        }
        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((placeholder, index) => {
          slots.push({ id: `button-${buttonIndex}-${index}`, componentType: 'BUTTON', parameterType: 'text', buttonType, placeholder, example: button?.example?.[index] || '', label: `${buttonType || 'Button'} ${placeholder}` })
        })
      })
    }
  }
  return slots
}

function hasCatalogButton(template) {
  return Array.isArray(template?.components) && template.components.some((component) => (
    component?.type === 'BUTTONS' &&
    Array.isArray(component.buttons) &&
    component.buttons.some((button) => {
      const buttonType = String(button?.type || '').toUpperCase()
      return buttonType === 'MPM' || buttonType === 'CATALOG'
    })
  ))
}

function fillTemplatePreview(body, variables) {
  if (!body) return 'Select an approved template to preview the message.'
  return body.replace(/\{\{(\d+)\}\}/g, (_match, rawIndex) => {
    const index = Number(rawIndex) - 1
    const value = Array.isArray(variables) ? variables[index] : ''
    return value?.trim() || `[value ${rawIndex}]`
  })
}

export default function SendCatalogPage() {
  const previousTemplateKeyRef = useRef('')
  const [contacts, setContacts] = useState([])
  const [products, setProducts] = useState([])
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [newContact, setNewContact] = useState({ name: '', phone: '' })
  const [showNewContactDialog, setShowNewContactDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState({ contacts: false, products: false, templates: false, send: false })

  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateVariables, setTemplateVariables] = useState([])
  const [headerImageUrl, setHeaderImageUrl] = useState('')

  const parameterSlots = useMemo(() => getTemplateParameterSlots(selectedTemplate), [selectedTemplate])
  const textParameterSlots = useMemo(() => parameterSlots.filter(s => s.parameterType === 'text'), [parameterSlots])
  const actionParameterSlots = useMemo(() => parameterSlots.filter(s => s.parameterType === 'action'), [parameterSlots])
  
  const placeholderKey = textParameterSlots.map(s => `${s.componentType}:${s.placeholder}`).join('|')
  const selectedTemplateKey = selectedTemplate ? `${selectedTemplate.id || selectedTemplate.name}:${placeholderKey}` : ''
  const hasImageHeader = !!selectedTemplate?.components?.some((c) => c.type === 'HEADER' && c.format === 'IMAGE')
  const hasVideoHeader = !!selectedTemplate?.components?.some((c) => c.type === 'HEADER' && c.format === 'VIDEO')
  const needsProducts = useMemo(() => (
    actionParameterSlots.some((slot) => slot.buttonType === 'MPM' || slot.buttonType === 'CATALOG') ||
    templateVariables.some((item) => productDependentValues.has(item.mode === 'token' ? item.value : ''))
  ), [actionParameterSlots, templateVariables])

  useEffect(() => {
    loadContacts()
    loadProducts()
    loadTemplates()
  }, [])

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateVariables([])
      setHeaderImageUrl('')
      previousTemplateKeyRef.current = ''
      return
    }

    const isSameTemplate = previousTemplateKeyRef.current === selectedTemplateKey
    setTemplateVariables((current) => {
      const next = textParameterSlots.map((slot, index) => {
        const existing = isSameTemplate ? current[index] : null
        if (existing) return existing
        const defaultValue = inferVariableFromExample(slot.example, index, selectedTemplate?.name)
        return {
          mode: defaultValue === 'text' ? 'text' : 'token',
          value: defaultValue === 'text' ? '' : defaultValue
        }
      })

      const isSameLength = current.length === next.length
      const isSameValues = isSameLength && current.every((item, index) => (
        item?.mode === next[index]?.mode && item?.value === next[index]?.value
      ))
      return isSameValues ? current : next
    })

    if (!isSameTemplate) setHeaderImageUrl('')
    previousTemplateKeyRef.current = selectedTemplateKey
  }, [selectedTemplate, selectedTemplateKey, textParameterSlots])

  async function loadContacts() {
    try {
      setLoading(c => ({ ...c, contacts: true }))
      const response = await fetch('/api/chats')
      if (!response.ok) throw new Error('Failed to load contacts')
      const data = await response.json()
      setContacts((Array.isArray(data) ? data : []).map(c => ({ id: c.id, name: c.name || `Customer ${c.phone}`, phone: c.phone })))
    } catch (error) { toast.error('Failed to load contacts') } 
    finally { setLoading(c => ({ ...c, contacts: false })) }
  }

  async function loadProducts() {
    try {
      setLoading(c => ({ ...c, products: true }))
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to load products')
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) { toast.error('Failed to load products') } 
    finally { setLoading(c => ({ ...c, products: false })) }
  }

  async function loadTemplates() {
    try {
      setLoading(c => ({ ...c, templates: true }))
      const response = await fetch('/api/whatsapp-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(Array.isArray(data) ? data : [])
      } else {
        setTemplates([])
      }
    } catch (error) { toast.error('Failed to load templates') } 
    finally { setLoading(c => ({ ...c, templates: false })) }
  }

  async function handleCreateContact() {
    if (!newContact.name || !newContact.phone) return toast.error('Please enter both name and phone number')
    try {
      const response = await fetch('/api/chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newContact) })
      if (!response.ok) throw new Error('Failed to create contact')
      const contact = await response.json()
      setContacts(c => [{ id: contact.id, name: contact.name, phone: contact.phone }, ...c])
      setNewContact({ name: '', phone: '' })
      setShowNewContactDialog(false)
      toast.success('Contact created successfully')
    } catch (error) { toast.error('Failed to create contact') }
  }

  function toggleContactSelection(phone) {
    if (selectedRecipients.includes(phone)) {
      setSelectedRecipients(selectedRecipients.filter(p => p !== phone))
    } else {
      setSelectedRecipients([...selectedRecipients, phone])
    }
  }

  function handleSelectProduct(productId) {
    setSelectedProducts(c => c.includes(productId) ? c.filter((id) => id !== productId) : [...c, productId])
  }

  async function handleSendCatalog() {
    if (selectedRecipients.length === 0) return toast.error('Please select at least one recipient')
    if (!selectedTemplate) return toast.error('Please select a template')
    if (needsProducts && selectedProducts.length === 0) return toast.error('This template uses product variables or buttons. Select at least one Meta catalog product.')
    if ((hasImageHeader || hasVideoHeader) && !headerImageUrl.trim()) return toast.error(`Add a public ${hasVideoHeader ? 'video' : 'image'} URL for this template`)

    try {
      setLoading(c => ({ ...c, send: true }))
      const results = []
      const templatePayload = {
        name: selectedTemplate.name,
        language: selectedTemplate.language,
        components: selectedTemplate.components || [],
        variables: templateVariables.map((item) => item.mode === 'token' ? item.value : item.value.trim()),
        headerImageUrl: headerImageUrl.trim()
      }

      for (const phoneNumber of selectedRecipients) {
        try {
          const response = await fetch('/api/send-catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              products: selectedProducts,
              recipient: phoneNumber,
              templateName: templatePayload.name,
              templateLanguage: templatePayload.language,
              templateComponents: templatePayload.components,
              templateVariables: templatePayload.variables,
              templateHeaderImageUrl: templatePayload.headerImageUrl
            })
          })
          if (!response.ok) {
            const error = await response.json()
            results.push({ success: false, phoneNumber, error: error.error || 'Failed to send catalog' })
          } else { results.push({ success: true, phoneNumber }) }
        } catch (error) { results.push({ success: false, phoneNumber, error: 'Failed to send catalog' }) }
      }

      const successfulSends = results.filter((item) => item.success).length
      const failedSends = results.filter((item) => !item.success).length
      if (successfulSends > 0) toast.success(`Catalog sent to ${successfulSends} recipient(s)`)
      if (failedSends > 0) toast.error(`Failed to send to ${failedSends} recipient(s)`)
      if (successfulSends > 0 && failedSends === 0) setSelectedRecipients([])
    } catch (error) { toast.error('Failed to send catalog process') } 
    finally { setLoading(c => ({ ...c, send: false })) }
  }

  const filteredContacts = contacts.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
  const trimmedVariableValues = templateVariables.map((v) => v.mode === 'token' ? v.value : v.value.trim())
  const previewText = fillTemplatePreview(getTemplateBody(selectedTemplate), trimmedVariableValues)

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
    <div className="catalog-scene flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] bg-slate-50 text-slate-900 overflow-hidden relative rounded-lg border border-slate-200 shadow-sm">
      <Toaster />


      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pb-20">
        {/* Column 1: Contacts */}
        <section className="w-full md:w-1/4 md:min-w-[280px] lg:min-w-[320px] bg-slate-50 p-6 lg:p-8 flex flex-col gap-6 lg:gap-10 overflow-y-auto border-r border-slate-200 shrink-0">
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Select Contacts</label>
              <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-slate-600 hover:text-blue-600 hover:bg-blue-50">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                    <DialogDescription>Add a new contact to send catalogs to</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="contact-name">Name</Label>
                      <Input
                        id="contact-name"
                        placeholder="John Doe"
                        value={newContact.name}
                        onChange={(event) => setNewContact((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-phone">Phone Number</Label>
                      <Input
                        id="contact-phone"
                        placeholder="+1234567890"
                        value={newContact.phone}
                        onChange={(event) => setNewContact((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </div>
                    <Button onClick={handleCreateContact} disabled={!newContact.name || !newContact.phone} className="w-full">
                      Create Contact
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-blue-600 transition-colors h-4 w-4" />
              <Input 
                className="w-full pl-10 pr-4 py-5 bg-white border-none focus:ring-2 focus:ring-blue-600 rounded-xl text-sm shadow-sm transition-all text-slate-900 font-medium outline-none" 
                placeholder="Search name or number..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4 border-t border-slate-200/50 pt-4">
            {loading.contacts ? (
               <div className="py-8 text-center"><RefreshCw className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
            ) : filteredContacts.length === 0 ? (
               <div className="py-8 text-center text-slate-500 text-sm">No contacts found</div>
            ) : (
               filteredContacts.map((contact) => {
                 const isChecked = selectedRecipients.includes(contact.phone)
                 return (
                  <div 
                    key={contact.id} 
                    onClick={() => toggleContactSelection(contact.phone)}
                    className={`p-4 rounded-xl flex items-center gap-3 transition-all cursor-pointer border ${isChecked ? 'bg-white border-2 border-blue-600 ring-2 ring-blue-600/10 shadow-sm' : 'bg-white border-2 border-transparent hover:border-slate-200 shadow-sm'}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-slate-50'}`}>
                       {isChecked && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${isChecked ? 'text-slate-900' : 'text-slate-800'}`}>{contact.name}</p>
                      <p className="text-xs font-medium text-slate-500 tracking-wide">{contact.phone}</p>
                    </div>
                  </div>
                 )
               })
            )}
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
              <button disabled={loading.templates} onClick={loadTemplates} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
                <RefreshCw className={`w-4 h-4 ${loading.templates ? 'animate-spin' : ''}`} />
                Fetch New
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {templates.length === 0 && !loading.templates && <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl">No templates found</div>}
              {templates.map(template => {
                const active = selectedTemplate?.id === template.id
                const usesCatalogButtons = hasCatalogButton(template)
                return (
                  <div 
                    key={template.id || template.name}
                    onClick={() => setSelectedTemplate(template)}
                    className={`group relative p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all ${active ? 'bg-white border-2 border-blue-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-blue-100 text-blue-600' : 'bg-slate-200/70 text-slate-500'}`}>
                        {template.category === 'MARKETING' ? <Search className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[150px] sm:max-w-full">{template.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-slate-500">{template.category} • {template.language}</p>
                          {usesCatalogButtons && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide">
                              Catalog button
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-emerald-100/60 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">Approved</span>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-[400px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-6">Live Preview</label>
            <div className="flex-1 rounded-3xl bg-slate-50 p-6 lg:p-10 flex items-center justify-center relative overflow-hidden border border-slate-200/50">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#005cc0 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
              
              <div className="w-full max-w-sm shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 border border-slate-200/40 relative z-10">
                {headerImageUrl && (
                  <div className="bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="w-full h-48 object-cover rounded-t-xl rounded-b-sm" src={headerImageUrl} alt="Header" />
                  </div>
                )}
                {!headerImageUrl && (hasImageHeader || hasVideoHeader) && (
                  <div className="bg-slate-100 h-40 flex items-center justify-center text-slate-400 p-1 rounded-t-xl">
                    <span className="text-xs font-medium">Image Header Placeholder</span>
                  </div>
                )}
                
                <div className="bg-white px-4 py-4 relative">
                  <p className="text-[15px] leading-[1.6] text-slate-800 whitespace-pre-wrap font-medium">
                    {renderPreviewText(previewText)}
                  </p>
                  <div className="flex justify-end items-center gap-1 mt-2">
                    <span className="text-[11px] text-slate-400 font-medium">10:42 AM</span>
                    <CheckCheck className="text-blue-400 w-4 h-4 ml-0.5" />
                  </div>
                </div>
                
                {selectedTemplate?.components?.find(c => c.type === 'BUTTONS') && (
                  <div className="bg-white border-t border-slate-100 p-2 space-y-2">
                    {selectedTemplate.components.find(c => c.type === 'BUTTONS').buttons.map((btn, i) => (
                      <button key={i} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
                        {btn.text || 'Action Button'}
                      </button>
                    ))}
                  </div>
                )}
                {!selectedTemplate?.components?.find(c => c.type === 'BUTTONS') && selectedTemplate && (
                  <div className="bg-white border-t border-slate-100 p-2 space-y-2">
                      <button className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
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
              {selectedTemplate && !needsProducts && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
                  This template can send without Meta product selection if you map variables to customer or latest-order fields.
                </div>
              )}
              {textParameterSlots.length === 0 ? (
                <div className="text-xs text-slate-500">No variables required.</div>
              ) : textParameterSlots.map((slot, index) => {
                const current = templateVariables[index] || { mode: 'token', value: '{{catalog_link}}' }

                return (
                  <div key={slot.id} className="p-4 rounded-xl bg-white shadow-sm border border-transparent hover:border-blue-600/20 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">{index + 1}</span>
                      <span className="text-xs font-semibold text-slate-500">{slot.placeholder} Placeholder</span>
                    </div>
                    
                    <Select value={current.mode === 'token' ? current.value : 'text'} onValueChange={(val) => {
                         setTemplateVariables(prev => {
                           const next = [...prev]
                           next[index] = val === 'text' ? { mode: 'text', value: current.mode === 'text' ? current.value : '' } : { mode: 'token', value: val }
                           return next
                         })
                    }}>
                      <SelectTrigger className="w-full bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg px-3 py-2 text-sm font-medium">
                        <SelectValue placeholder="Map to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {variableOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    {current.mode === 'text' && (
                      <Input
                        className="mt-2 w-full bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg shadow-inner"
                        placeholder="Custom value"
                        value={current.value}
                        onChange={(e) => setTemplateVariables(prev => {
                           const next = [...prev]
                           next[index] = { mode: 'text', value: e.target.value }
                           return next
                        })}
                      />
                    )}
                  </div>
                )
              })}
              
              {(hasImageHeader || hasVideoHeader) && (
                 <div className="p-4 rounded-xl bg-white shadow-sm border border-transparent transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-slate-500">{hasVideoHeader ? 'Video Header URL' : 'Image Header URL'}</span>
                      </div>
                      <Input
                        className="w-full bg-slate-50 border-none focus:ring-1 focus:ring-blue-600 rounded-lg text-sm shadow-inner"
                        placeholder={`https://example.com/media.${hasVideoHeader?'mp4':'jpg'}`}
                        value={headerImageUrl}
                        onChange={(e) => setHeaderImageUrl(e.target.value)}
                      />
                 </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Meta Catalog Products</label>
              <button disabled={loading.products} onClick={loadProducts} className="text-[10px] font-bold bg-blue-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:opacity-90 transition-opacity">
                <RefreshCw className="w-3.5 h-3.5" /> Fetch Meta
              </button>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Select products here only for Meta catalog buttons or Meta product placeholders. Tracking and order-update templates can use purchased items from the recipient&apos;s latest order instead.
            </p>
            
            <div className="space-y-3">
              {products.length === 0 ? (
                <div className="text-xs text-slate-500">No products available.</div>
              ) : products.map(product => {
                const isSelected = selectedProducts.includes(product.id)
                return (
                  <div key={product.id} onClick={() => handleSelectProduct(product.id)} className={`flex items-center gap-3 p-2 rounded-xl bg-white/60 border transition-all cursor-pointer ${isSelected ? 'border-blue-600 bg-white shadow-sm' : 'border-slate-200/50 hover:bg-white'}`}>
                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shadow-sm">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                      ) : <Package className="w-full h-full p-3 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">{product.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">ID: {product.id} • ${product.price}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 w-full z-40 px-6 lg:px-10 bg-white shadow-[0_-8px_30px_rgb(0,0,0,0.04)] h-20 flex items-center justify-between border-t border-slate-200 md:ml-[16rem] w-[calc(100%-0rem)] md:w-[calc(100%-16rem)] right-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="hidden lg:flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
               <User className="w-4 h-4 text-slate-500"/>
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden text-[10px] font-bold text-slate-500">
              +{selectedRecipients.length > 0 ? selectedRecipients.length : '0'}
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 hidden sm:block">Viewing as <span className="text-slate-900 font-bold">Marketing Team</span></p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto justify-end">
          <Button variant="ghost" className="px-4 lg:px-6 py-3 rounded-xl text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors h-auto">
             Save Draft
          </Button>
          <Button disabled={loading.send || selectedRecipients.length === 0 || !selectedTemplate} onClick={handleSendCatalog} className="px-6 lg:px-8 py-3 lg:py-3.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 h-auto">
             {loading.send ? 'Sending...' : 'Send Template'}
             <Send className="w-4 h-4 ml-1 hidden sm:block" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
