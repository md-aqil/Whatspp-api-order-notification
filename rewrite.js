'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, CheckCircle2, ChevronRight, ChevronDown, RefreshCw, Send, User, BadgeCheck, Check, Info } from 'lucide-react'

const variableOptions = [
  { value: 'text', label: 'Custom text', hint: 'Type any value manually.' },
  { value: '{{customer_name}}', label: 'Customer name', hint: 'Uses the selected contact name when available.' },
  { value: '{{customer_phone}}', label: 'Customer phone', hint: 'Uses the recipient phone number.' },
  { value: '{{catalog_link}}', label: 'Catalog link', hint: 'Store-wide catalog URL.' },
  { value: '{{product_name}}', label: 'First selected product name', hint: 'Uses the first selected product.' },
  { value: '{{product_price}}', label: 'First selected product price', hint: 'Uses the first selected product.' },
  { value: '{{product_link}}', label: 'First selected product link', hint: 'Uses the first selected product.' },
  { value: '{{product_names}}', label: 'Selected product names', hint: 'Combines up to the first 3 selected products.' }
]

const productDependentValues = new Set(['{{product_name}}', '{{product_price}}', '{{product_link}}', '{{product_names}}'])

function inferVariableFromExample(exampleText, index = 0) {
  const sample = String(exampleText || '').trim().toLowerCase()
  if (sample.includes('customer') && sample.includes('name')) return '{{customer_name}}'
  if (sample.includes('customer') && sample.includes('phone')) return '{{customer_phone}}'
  if (sample.includes('catalog') || sample.includes('collection')) return '{{catalog_link}}'
  if (sample.includes('product') && sample.includes('name')) return '{{product_name}}'
  if (sample.includes('product') && sample.includes('price')) return '{{product_price}}'
  if (sample.includes('product') && (sample.includes('link') || sample.includes('url'))) return '{{product_link}}'
  if (sample.includes('browse') || sample.includes('link') || sample.includes('url')) return '{{product_link}}'
  const fallbacks = ['{{customer_name}}', '{{catalog_link}}', '{{product_name}}', '{{product_link}}']
  return fallbacks[index] || '{{catalog_link}}'
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

function formatBodyText(text, variables) {
  if (!text) return ''
  let result = text
  const matches = text.match(/\{\{\d+\}\}/g) || []
  matches.forEach((placeholder, index) => {
    // If not mapped, keep the placeholder styled
    const varData = variables[index]
    const content = varData?.mode === 'text' ? varData.value : (varData?.value || placeholder)
    
    // Instead of raw replacment, we map to HTML for preview
    // In React we can't do this easily with string replace to JSX. 
    // We'll leave it as string for now.
  })
  return result
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
  const [loading, setLoading] = useState({
    contacts: false,
    products: false,
    templates: false,
    send: false
  })

  // Template States
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
        const defaultValue = inferVariableFromExample(slot.example, index)
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
      setContacts((Array.isArray(data) ? data : []).map(c => ({
        id: c.id, name: c.name || `Customer ${c.phone}`, phone: c.phone
      })))
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
    
    if (needsProducts && selectedProducts.length === 0) {
      return toast.error('This template uses product variables or buttons. Select at least one Meta catalog product.')
    }

    if ((hasImageHeader || hasVideoHeader) && !headerImageUrl.trim()) {
      return toast.error(`Add a public ${hasVideoHeader ? 'video' : 'image'} URL for this template`)
    }

    try {
      setLoading(c => ({ ...c, send: true }))
      const results = []

      // Generate the template payload
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
          } else {
            results.push({ success: true, phoneNumber })
          }
        } catch (error) { results.push({ success: false, phoneNumber, error: 'Failed to send catalog' }) }
      }

      const successfulSends = results.filter((item) => item.success).length
      const failedSends = results.filter((item) => !item.success).length

      if (successfulSends > 0) toast.success(`Catalog sent to ${successfulSends} recipient(s)`)
      if (failedSends > 0) toast.error(`Failed to send to ${failedSends} recipient(s)`)
      
      // Clear recipients upon successful send
      if (successfulSends > 0 && failedSends === 0) {
        setSelectedRecipients([])
      }
    } catch (error) { toast.error('Failed to send catalog process') } 
    finally { setLoading(c => ({ ...c, send: false })) }
  }

  const filteredContacts = contacts.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))

  // Render text for preview with styling
  const renderPreviewText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\{\{\d+\}\})/g);
    return parts.map((part, i) => {
      if (part.match(/\{\{\d+\}\}/)) {
        return <span key={i} className="bg-blue-600/10 text-blue-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold mx-1">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] relative bg-slate-50 text-slate-900 rounded-lg">
      <Toaster />

      <main className="flex-1 flex overflow-hidden lg:flex-row flex-col gap-4 pb-24">
        {/* Column 1: Contacts */}
        <section className="w-full lg:w-[340px] bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col p-6 overflow-hidden flex-shrink-0">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Select Contacts</h2>
              <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-600 hover:text-blue-600 hover:bg-blue-50">
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
                className="w-full pl-10 pr-4 py-5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none" 
                placeholder="Search by name or number..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
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
                    className={`p-4 rounded-xl flex items-center gap-3 transition-all cursor-pointer border ${isChecked ? 'bg-slate-50 border-blue-600/30 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50 hover:shadow-sm'}`}
                  >
                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
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

        {/* Column 2: Templates */}
        <section className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 lg:p-10 overflow-y-auto min-w-[300px]">
          <div className="max-w-xl mx-auto">
            <header className="mb-8 lg:mb-12 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-slate-900">Message Template</h2>
                <p className="text-slate-500 text-sm font-medium">Choose an approved conversational structure to start the campaign.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={loadTemplates} disabled={loading.templates} className="text-slate-400 hover:text-blue-600">
                <RefreshCw className={`h-4 w-4 ${loading.templates ? 'animate-spin' : ''}`} />
              </Button>
            </header>

            <div className="space-y-6">
              {loading.templates ? (
                <div className="py-12 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>
              ) : templates.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl">
                  No templates found. Please create them in Meta Business Manager.
                </div>
              ) : (
                templates.map((template) => {
                  const isActive = selectedTemplate?.id === template.id
                  const bodyText = template.components?.find((c) => c.type === 'BODY')?.text || ''
                  
                  return (
                    <div 
                      key={template.id} 
                      onClick={() => setSelectedTemplate(template)}
                      className={`relative p-6 lg:p-8 rounded-2xl transition-all cursor-pointer ${isActive ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-600/5 ring-4 ring-blue-600/5' : 'bg-slate-50 border border-slate-100 group hover:bg-white hover:border-slate-200 hover:shadow-lg'}`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <span className={`text-[11px] font-extrabold uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                          {isActive ? 'Selected Template' : template.name}
                        </span>
                        <span className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full border ${template.status.toLowerCase() === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                          <BadgeCheck className="w-3.5 h-3.5" /> {template.status.toUpperCase()}
                        </span>
                      </div>

                      <div className={`${isActive ? 'bg-slate-50 border-slate-100 shadow-inner opacity-100' : 'bg-white/50 border-slate-200/50 opacity-60 group-hover:opacity-100'} border p-5 lg:p-6 rounded-2xl rounded-tl-none relative max-w-[95%] lg:max-w-[90%] transition-opacity`}>
                        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                          {renderPreviewText(bodyText)}
                        </p>
                        
                        {isActive && template.components?.some(c => c.type === 'BUTTONS') && (
                          <div className="mt-5 w-full py-2.5 px-4 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-blue-600">
                            <span className="text-xs font-bold tracking-wide">VIEW CATALOG / ACTION</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

        {/* Column 3: Configuration */}
        <section className="w-full lg:w-[400px] bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col p-6 overflow-hidden flex-shrink-0">
          <h2 className="text-xl font-extrabold tracking-tight mb-8 text-slate-900">Configuration</h2>
          
          <div className="flex-1 overflow-y-auto space-y-10 pr-1 pb-4">
            {/* Meta Fetch Section */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Products from Meta</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={loadProducts} disabled={loading.products} className="h-7 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg">
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading.products ? 'animate-spin' : ''}`} /> SYNC
                </Button>
              </div>

              <div className="space-y-3">
                {products.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    No products found. 
                  </div>
                ) : (
                  products.map((product) => {
                    const isSelected = selectedProducts.includes(product.id)
                    return (
                      <div 
                        key={product.id}
                        onClick={() => handleSelectProduct(product.id)}
                        className={`p-3 lg:p-4 rounded-xl flex items-center gap-4 transition-all cursor-pointer group border ${isSelected ? 'bg-white border-2 border-blue-600 shadow-lg shadow-blue-600/5' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-md'}`}
                      >
                        <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-lg flex-shrink-0 overflow-hidden border ${isSelected ? 'border-slate-100 bg-slate-100' : 'bg-slate-200 border-slate-200 group-hover:border-slate-300'}`}>
                          {product.image ? (
                             // eslint-disable-next-line @next/next/no-img-element
                             <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-400"><Package className="h-5 w-5" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-700 group-hover:text-slate-900'}`}>{product.title}</p>
                          <p className={`text-sm font-black mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-500 font-bold'}`}>${product.price}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="text-blue-600 w-5 h-5 flex-shrink-0" />}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Variable Mapping */}
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-5">Variable Mapping</h3>
              {!selectedTemplate ? (
                 <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    Select a template to configure variables
                 </div>
              ) : textParameterSlots.length === 0 ? (
                 <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    This template requires no variables.
                 </div>
              ) : (
                <div className="space-y-5">
                  {textParameterSlots.map((slot, index) => {
                    const current = templateVariables[index] || { mode: 'token', value: '{{catalog_link}}' }
                    return (
                      <div key={slot.id} className="space-y-2.5">
                        <Label className="text-[11px] font-extrabold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                          <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 font-mono text-[11px]">{slot.placeholder}</span>
                          {slot.label}
                        </Label>
                        
                        <div className="relative group flex gap-2 w-full">
                          <Select 
                            value={current.mode === 'token' ? current.value : 'text'}
                            onValueChange={(val) => {
                              setTemplateVariables(prev => {
                                const next = [...prev]
                                next[index] = val === 'text' ? { mode: 'text', value: current.mode === 'text' ? current.value : '' } : { mode: 'token', value: val }
                                return next
                              })
                            }}
                          >
                            <SelectTrigger className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium h-auto">
                              <SelectValue placeholder="Map to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {variableOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {current.mode === 'text' && (
                          <Input 
                            value={current.value} 
                            onChange={(e) => setTemplateVariables(prev => {
                              const next = [...prev]
                              next[index] = { mode: 'text', value: e.target.value }
                              return next
                            })}
                            placeholder="Enter custom text..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedTemplate && (hasImageHeader || hasVideoHeader) && (
                <div className="mt-8 space-y-2.5">
                  <Label className="text-[11px] font-extrabold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                    {hasVideoHeader ? 'Video Head URL' : 'Image Head URL'}
                  </Label>
                  <Input 
                    value={headerImageUrl}
                    onChange={(e) => setHeaderImageUrl(e.target.value)}
                    placeholder={`https://example.com/media.${hasVideoHeader?'mp4':'jpg'}`}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer Action Bar */}
      <footer className="fixed bottom-0 left-0 w-full z-40 px-6 lg:px-12 bg-white/80 backdrop-blur-xl h-20 flex items-center border-t border-slate-200/50 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] justify-between md:ml-[16rem] w-[calc(100%-0rem)] md:w-[calc(100%-16rem)] right-0">
        <div className="hidden lg:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="font-sans text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Meta Verified Service Active</span>
        </div>
        <div className="flex items-center gap-4 lg:gap-6 flex-1 lg:flex-none justify-end">
          <div className="text-xs text-slate-500 font-medium mr-4 hidden sm:block">
            {selectedRecipients.length} Recipient{selectedRecipients.length !== 1 ? 's' : ''} Selected
          </div>
          <Button variant="ghost" className="text-slate-500 px-4 lg:px-6 py-3 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-colors rounded-xl h-auto">
              Save Draft
          </Button>
          <Button 
            disabled={loading.send || selectedRecipients.length === 0 || !selectedTemplate}
            onClick={handleSendCatalog}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 lg:px-10 py-3 lg:py-3.5 h-auto font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all flex items-center gap-3"
          >
            <span>{loading.send ? 'Sending...' : 'Send Catalog'}</span>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
