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
  { value: '{{catalog_link}}', label: 'Catalog link', hint: 'Store-wide catalog URL.' },
  { value: '{{product_name}}', label: 'First selected product name', hint: 'Uses the first selected product.' },
  { value: '{{product_price}}', label: 'First selected product price', hint: 'Uses the first selected product.' },
  { value: '{{product_link}}', label: 'First selected product link', hint: 'Uses the first selected product.' },
  { value: '{{product_names}}', label: 'Selected product names', hint: 'Combines up to the first 3 selected products.' }
]

const productDependentValues = new Set(['{{product_name}}', '{{product_price}}', '{{product_link}}', '{{product_names}}'])

export function TemplatePanel({ selectedProducts, recipient, onSendWithTemplate, embedded = false }) {
  const uploadRef = useRef(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [manualTemplateName, setManualTemplateName] = useState('')
  const [templateVariables, setTemplateVariables] = useState([])
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  const [apiError, setApiError] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const placeholderMatches = useMemo(() => (
    selectedTemplate?.components?.find((component) => component.type === 'BODY')?.text?.match(/\{\{\d+\}\}/g) || []
  ), [selectedTemplate])
  const placeholderKey = placeholderMatches.join('|')
  const hasImageHeader = !!selectedTemplate?.components?.some((component) => component.type === 'HEADER' && component.format === 'IMAGE')
  const needsProducts = useMemo(
    () => templateVariables.some((item) => productDependentValues.has(item.mode === 'token' ? item.value : '')),
    [templateVariables]
  )

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateVariables((current) => (current.length === 0 ? current : []))
      setHeaderImageUrl((current) => (current ? '' : current))
      return
    }

    const defaults = ['{{catalog_link}}', '{{product_names}}', '{{product_link}}']
    setTemplateVariables((current) => {
      const next = placeholderMatches.map((_, index) => {
        const existing = current[index]
        if (existing) return existing
        const defaultValue = defaults[index] || 'text'
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
  }, [selectedTemplate, placeholderKey])

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
      toast.error('Select at least one product for the chosen template mapping')
      return
    }

    if (hasImageHeader && !headerImageUrl.trim()) {
      toast.error('Add an image URL or upload an image for this template')
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
                  </div>
                </div>
              ))}
            </div>

            {selectedTemplate && placeholderMatches.length > 0 && (
              <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">Template variable mapping</div>
                  <p className="mt-1 text-xs text-slate-600">
                    Choose what each placeholder should use. Product tokens use the first selected product or the whole selection.
                  </p>
                </div>
                <div className="space-y-4">
                  {placeholderMatches.map((placeholder, index) => {
                    const current = templateVariables[index] || { mode: 'token', value: '{{catalog_link}}' }
                    const selectedOption = variableOptions.find((option) => option.value === current.value)
                    return (
                      <div key={`${placeholder}-${index}`} className="space-y-2 rounded-lg border border-white/70 bg-white/80 p-3">
                        <Label className="text-xs font-medium text-slate-700">{placeholder} in template</Label>
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
                {needsProducts ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    This mapping needs product data. Select one or more products in the left column.
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    This mapping does not require product selection.
                  </div>
                )}
              </div>
            )}

            {selectedTemplate && hasImageHeader && (
              <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">Template image header</div>
                  <p className="mt-1 text-xs text-slate-600">
                    Paste a public image URL or upload one for this image-header template.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-700">Image URL</Label>
                  <Input
                    value={headerImageUrl}
                    onChange={(event) => setHeaderImageUrl(event.target.value)}
                    placeholder="https://example.com/catalog-banner.jpg"
                    className="bg-white"
                  />
                </div>
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
                {headerImageUrl && (
                  <div className="overflow-hidden rounded-lg border border-emerald-100 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headerImageUrl} alt="Template header preview" className="h-40 w-full object-cover" />
                  </div>
                )}
              </div>
            )}

            <Separator />

            <Button
              onClick={handleSendWithTemplate}
              disabled={loading || !selectedTemplate || !recipient || (hasImageHeader && !headerImageUrl.trim())}
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
