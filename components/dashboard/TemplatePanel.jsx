'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertCircle, ExternalLink, ImagePlus, Info, Loader2, RefreshCw, Sparkles } from 'lucide-react'

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
        slots.push({
          id: `header-${index}`,
          componentType: 'HEADER',
          parameterType: 'text',
          placeholder,
          example: examples[index] || '',
          label: `Header ${placeholder}`
        })
      })
    }

    if (component?.type === 'BODY') {
      const matches = component.text?.match(/\{\{\d+\}\}/g) || []
      const examples = getComponentExamples(component, 'body_text')
      matches.forEach((placeholder, index) => {
        slots.push({
          id: `body-${index}`,
          componentType: 'BODY',
          parameterType: 'text',
          placeholder,
          example: examples[index] || '',
          label: `Body ${placeholder}`
        })
      })
    }

    if (component?.type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, buttonIndex) => {
        const buttonType = String(button?.type || '').toUpperCase()

        if (buttonType === 'MPM' || buttonType === 'CATALOG') {
          slots.push({
            id: `button-action-${buttonIndex}`,
            componentType: 'BUTTON',
            parameterType: 'action',
            buttonType,
            label: `${buttonType} button`,
            example: button?.text || ''
          })
          return
        }

        const matches = button?.url?.match(/\{\{\d+\}\}/g) || []
        matches.forEach((placeholder, index) => {
          slots.push({
            id: `button-${buttonIndex}-${index}`,
            componentType: 'BUTTON',
            parameterType: 'text',
            buttonType,
            placeholder,
            example: button?.example?.[index] || '',
            label: `${buttonType || 'Button'} ${placeholder}`
          })
        })
      })
    }
  }

  return slots
}

export function TemplatePanel({ selectedProducts, recipient, onSendWithTemplate, embedded = false }) {
  const uploadRef = useRef(null)
  const previousTemplateKeyRef = useRef('')
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [manualTemplateName, setManualTemplateName] = useState('')
  const [templateVariables, setTemplateVariables] = useState([])
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  const [apiError, setApiError] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const parameterSlots = useMemo(() => getTemplateParameterSlots(selectedTemplate), [selectedTemplate])
  const textParameterSlots = useMemo(
    () => parameterSlots.filter((slot) => slot.parameterType === 'text'),
    [parameterSlots]
  )
  const actionParameterSlots = useMemo(
    () => parameterSlots.filter((slot) => slot.parameterType === 'action'),
    [parameterSlots]
  )
  const placeholderKey = textParameterSlots.map((slot) => `${slot.componentType}:${slot.placeholder}`).join('|')
  const selectedTemplateKey = selectedTemplate ? `${selectedTemplate.id || selectedTemplate.name}:${placeholderKey}` : ''
  const hasImageHeader = !!selectedTemplate?.components?.some((component) => component.type === 'HEADER' && component.format === 'IMAGE')
  const hasVideoHeader = !!selectedTemplate?.components?.some((component) => component.type === 'HEADER' && component.format === 'VIDEO')
  const needsProducts = useMemo(
    () => (
      actionParameterSlots.some((slot) => slot.buttonType === 'MPM' || slot.buttonType === 'CATALOG') ||
      templateVariables.some((item) => productDependentValues.has(item.mode === 'token' ? item.value : ''))
    ),
    [actionParameterSlots, templateVariables]
  )

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateVariables((current) => (current.length === 0 ? current : []))
      setHeaderImageUrl((current) => (current ? '' : current))
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

    if (!isSameTemplate) {
      setHeaderImageUrl('')
    }

    previousTemplateKeyRef.current = selectedTemplateKey
  }, [selectedTemplate, selectedTemplateKey, textParameterSlots])

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      setLoading(true)
      setApiError(null)
      const response = await fetch('/api/whatsapp-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(Array.isArray(data) ? data : [])
      } else {
        const error = await response.json()
        setTemplates([])
        setApiError(error)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
      setApiError({ error: 'Connection error', guidance: 'Unable to connect to the templates service.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      const body = new FormData()
      body.append('file', file)

      const response = await fetch('/api/uploads/campaign-image', {
        method: 'POST',
        body
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload image')
      setHeaderImageUrl(data.url || '')
      toast.success('Image uploaded')
    } catch (error) {
      console.error('Failed to upload catalog image:', error)
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  function handleSendWithTemplate() {
    const templatePayload = selectedTemplate
      ? {
          name: selectedTemplate.name,
          language: selectedTemplate.language,
          components: selectedTemplate.components || [],
          variables: templateVariables.map((item) => item.mode === 'token' ? item.value : item.value.trim()),
          headerImageUrl: headerImageUrl.trim()
        }
      : {
          name: manualTemplateName,
          language: 'en_US'
        }

    if (!templatePayload.name) {
      toast.error('Please select a template or enter a template name')
      return
    }

    if (!recipient) {
      toast.error('Please enter recipient phone number(s)')
      return
    }

    if (needsProducts && selectedProducts.length === 0) {
      const hasProductAction = actionParameterSlots.some((slot) => slot.buttonType === 'MPM' || slot.buttonType === 'CATALOG')
      toast.error(
        hasProductAction
          ? 'This template includes a catalog product button. Select at least one Meta catalog product or use a template without product actions.'
          : 'This template uses product variables. Select at least one Meta catalog product or switch those placeholders to non-product values.'
      )
      return
    }

    if ((hasImageHeader || hasVideoHeader) && !headerImageUrl.trim()) {
      toast.error(`Add a public ${hasVideoHeader ? 'video' : 'image'} URL or upload media for this template`)
      return
    }

    if (/^http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1)/i.test(headerImageUrl.trim())) {
      toast.error('Media header URL must be public. Localhost and 0.0.0.0 URLs will fail in WhatsApp.')
      return
    }

    onSendWithTemplate(templatePayload)
  }

  const content = (
    <>
      <CardHeader className={embedded ? 'px-0 pt-0' : undefined}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-yellow-500" />
              Approved Templates
            </CardTitle>
            <CardDescription>
              Pick an approved template and map placeholders only when needed.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTemplates} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className={`space-y-4 ${embedded ? 'px-0 pb-0' : ''}`}>
        {(!Array.isArray(templates) || templates.length === 0) ? (
          <div className="space-y-4">
            <div className="py-4 text-center">
              <Sparkles className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-muted-foreground">
                {loading ? 'Loading templates...' : 'No approved templates found'}
              </p>
              <div className="mt-2 flex items-center justify-center text-sm text-muted-foreground">
                <Info className="mr-1 h-4 w-4" />
                <span>Templates must be created in your Meta Business account</span>
              </div>
            </div>

            {apiError && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start">
                  <AlertCircle className="mt-0.5 mr-2 h-5 w-5 flex-shrink-0 text-yellow-600" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Template API Issue</h4>
                    <p className="mt-1 text-sm text-yellow-700">{apiError.error || 'Unable to fetch templates from WhatsApp API'}</p>
                    {apiError.guidance && <p className="mt-1 text-sm text-yellow-700">{apiError.guidance}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Template Name</Label>
              <Input
                placeholder="Enter template name"
                value={manualTemplateName}
                onChange={(event) => setManualTemplateName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact name of your approved WhatsApp template.
              </p>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p><strong>Need to create a template?</strong></p>
              <p>1. Go to Facebook Business Manager</p>
              <p>2. Navigate to WhatsApp &gt; Templates</p>
              <p>3. Create and approve your template</p>
              <p className="mt-2">
                <a
                  href="https://business.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:underline"
                >
                  Go to Business Manager <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </p>
            </div>

            <Separator />

            <Button
              onClick={handleSendWithTemplate}
              disabled={loading || (!selectedTemplate && !manualTemplateName) || !recipient}
              className="w-full"
            >
              {loading ? 'Sending...' : 'Send with Template'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3">
              {templates.map((template) => (
                <div
                  key={template.id || template.name}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {template.components?.find((component) => component.type === 'BODY')?.text || 'No preview available'}
                  </p>
                  <div className="mt-2 flex items-center">
                    <Badge variant="outline" className="text-xs">{template.language}</Badge>
                    <Badge variant="default" className="ml-2 bg-green-500 text-xs">{template.status}</Badge>
                    {template.components?.some((component) => component.type === 'HEADER' && component.format === 'IMAGE') && (
                      <Badge variant="outline" className="ml-2 text-xs">Image header</Badge>
                    )}
                    {template.components?.some((component) => component.type === 'HEADER' && component.format === 'VIDEO') && (
                      <Badge variant="outline" className="ml-2 text-xs">Video header</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedTemplate && (textParameterSlots.length > 0 || actionParameterSlots.length > 0) && (
              <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">Template variable mapping</div>
                  <p className="mt-1 text-xs text-slate-600">
                    Map every text placeholder exactly as Meta expects. Product tokens use the first selected product or the whole selection.
                  </p>
                </div>
                {textParameterSlots.length > 0 && (
                  <div className="space-y-4">
                    {textParameterSlots.map((slot, index) => {
                    const current = templateVariables[index] || { mode: 'token', value: '{{catalog_link}}' }
                    const selectedOption = variableOptions.find((option) => option.value === current.value)
                    return (
                      <div key={slot.id} className="space-y-2 rounded-lg border border-white/70 bg-white/80 p-3">
                        <Label className="text-xs font-medium text-slate-700">{slot.label}</Label>
                        {slot.example && (
                          <p className="text-[11px] text-slate-500">Required example: {slot.example}</p>
                        )}
                        <Select
                          value={current.mode === 'token' ? current.value : 'text'}
                          onValueChange={(value) => {
                            setTemplateVariables((existing) => {
                              const next = [...existing]
                              next[index] = value === 'text'
                                ? { mode: 'text', value: current.mode === 'text' ? current.value : '' }
                                : { mode: 'token', value }
                              return next
                            })
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {variableOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {current.mode === 'text' ? (
                          <Input
                            value={current.value}
                            onChange={(event) => {
                              const value = event.target.value
                              setTemplateVariables((existing) => {
                                const next = [...existing]
                                next[index] = { mode: 'text', value }
                                return next
                              })
                            }}
                            placeholder="Enter custom text"
                            className="bg-white"
                          />
                        ) : (
                          <p className="text-xs text-slate-500">{selectedOption?.hint || 'Maps this placeholder automatically.'}</p>
                        )}
                      </div>
                    )
                    })}
                  </div>
                )}
                {actionParameterSlots.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900">
                    <div className="font-medium">Template action requirements</div>
                    {actionParameterSlots.map((slot) => (
                      <p key={slot.id}>
                        {slot.label}: {slot.buttonType === 'MPM'
                          ? 'requires WhatsApp-ready products with Meta retailer IDs so WhatsApp can build the multi-product message.'
                          : 'requires a WhatsApp-ready product with a Meta retailer ID so WhatsApp can render the catalog button.'}
                      </p>
                    ))}
                  </div>
                )}
                {needsProducts ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    This mapping needs product data. Select one or more WhatsApp-ready products in the left column when available.
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    This mapping does not require product selection.
                  </div>
                )}
              </div>
            )}

            {selectedTemplate && (hasImageHeader || hasVideoHeader) && (
              <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">Template media header</div>
                  <p className="mt-1 text-xs text-slate-600">
                    {hasVideoHeader
                      ? 'Paste a direct public video URL for this template.'
                      : 'Paste a public image URL or upload one for this template.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-700">{hasVideoHeader ? 'Video URL' : 'Image URL'}</Label>
                  <Input
                    value={headerImageUrl}
                    onChange={(event) => setHeaderImageUrl(event.target.value)}
                    placeholder={hasVideoHeader ? 'https://example.com/catalog-video.mp4' : 'https://example.com/catalog-banner.jpg'}
                    className="bg-white"
                  />
                </div>
                {hasImageHeader ? (
                  <div className="flex items-center gap-3">
                    <input
                      ref={uploadRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => uploadRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {uploadingImage ? 'Uploading...' : 'Upload image'}
                    </Button>
                    <span className="text-xs text-slate-500">JPG, PNG, or WebP up to 5MB</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Video headers need a direct public video URL. Upload is not supported here.
                  </div>
                )}
                {headerImageUrl && (
                  <div className="overflow-hidden rounded-lg border border-emerald-100 bg-white">
                    {hasVideoHeader ? (
                      <div className="p-3 text-xs text-slate-600">
                        Video header URL set: {headerImageUrl}
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={headerImageUrl} alt="Template header preview" className="h-40 w-full object-cover" />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            <Button
              onClick={handleSendWithTemplate}
              disabled={loading || !selectedTemplate || !recipient || ((hasImageHeader || hasVideoHeader) && !headerImageUrl.trim())}
              className="w-full"
            >
              {loading ? 'Sending...' : `Send with "${selectedTemplate?.name || 'Template'}"`}
            </Button>
          </div>
        )}
      </CardContent>
    </>
  )

  if (embedded) {
    return <div className="space-y-4">{content}</div>
  }

  return <Card>{content}</Card>
}
