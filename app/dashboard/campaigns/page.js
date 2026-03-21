'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Filter,
  ImagePlus,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wand2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

const audienceOptions = [
  {
    value: 'all_customers',
    label: 'All customers',
    description: 'Everyone saved in chats.',
    icon: Users
  },
  {
    value: 'recent_buyers',
    label: 'Recent buyers',
    description: 'Customers with an order in the last 30 days.',
    icon: Clock3
  },
  {
    value: 'custom',
    label: 'Custom list',
    description: 'Paste phone numbers manually.',
    icon: Wand2
  }
]

const builderSteps = [
  { id: 'setup', label: 'Setup' },
  { id: 'template', label: 'Template' },
  { id: 'review', label: 'Review' }
]

const variableHints = [
  'Customer name or {{customer_name}}',
  'Link or {{catalog_link}}',
  'Offer detail or short CTA',
  'Extra supporting text'
]

function getTemplateBody(template) {
  return template?.components?.find((component) => component.type === 'BODY')?.text || 'Select an approved template to preview the message.'
}

function countTemplateVariables(template) {
  const matches = getTemplateBody(template).match(/\{\{\d+\}\}/g)
  return matches ? matches.length : 0
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
    name: '',
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

function getPreviewName(variables) {
  const value = Array.isArray(variables) ? variables[0]?.trim() : ''
  if (!value || (value.startsWith('{{') && value.endsWith('}}'))) return 'Customer'
  return value
}

function buildPreviewSubtitle(audience, recipientCount) {
  if (audience === 'custom') {
    return recipientCount === 1 ? '1 selected contact' : `${recipientCount} selected contacts`
  }
  if (audience === 'recent_buyers') return 'Recent buyers audience'
  return 'All customers audience'
}

function formatStatus(status) {
  if (status === 'draft') return { label: 'Draft', className: 'bg-slate-500' }
  if (status === 'scheduled') return { label: 'Scheduled', className: 'bg-sky-500' }
  if (status === 'sent') return { label: 'Sent', className: 'bg-emerald-500' }
  if (status === 'failed') return { label: 'Failed', className: 'bg-rose-500' }
  return { label: 'Draft', className: 'bg-slate-500' }
}

function formatAudienceLabel(audience) {
  if (audience === 'all_customers') return 'All customers'
  if (audience === 'recent_buyers') return 'Recent buyers'
  if (audience === 'custom') return 'Custom list'
  return audience
}

function formatRecipientCount(campaign) {
  if (campaign.audience === 'custom') {
    return `${Array.isArray(campaign.recipients) ? campaign.recipients.length : 0} recipients`
  }
  if (campaign.audience === 'recent_buyers') return 'Dynamic recent buyers'
  return 'Dynamic all customers'
}

export default function CampaignsPage() {
  const imageUploadRef = useRef(null)
  const [campaigns, setCampaigns] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedPreviewCampaignId, setSelectedPreviewCampaignId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [sendingCampaignId, setSendingCampaignId] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTemplate, setFilterTemplate] = useState('all')
  const [builderStep, setBuilderStep] = useState('setup')
  const [templateError, setTemplateError] = useState('')
  const [campaignForm, setCampaignForm] = useState(buildEmptyCampaign)

  useEffect(() => {
    loadCampaigns()
    loadTemplates()
  }, [])

  async function loadCampaigns() {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns')
      if (!response.ok) throw new Error('Failed to load campaigns')
      const data = await response.json()
      setCampaigns(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplates() {
    try {
      setTemplateError('')
      const response = await fetch('/api/whatsapp-templates')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load templates')
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
      setTemplateError(error.message || 'Failed to load templates')
      toast.error(error.message || 'Failed to load templates')
    }
  }

  async function createCampaign(campaignData) {
    try {
      setSavingCampaign(true)
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create campaign')

      toast.success('Campaign saved successfully')
      setCampaignForm(buildEmptyCampaign())
      setBuilderStep('setup')
      await loadCampaigns()
      setSelectedPreviewCampaignId(data.id || null)
    } catch (error) {
      console.error('Failed to create campaign:', error)
      toast.error(error.message || 'Failed to create campaign')
    } finally {
      setSavingCampaign(false)
    }
  }

  async function sendCampaign(campaignId) {
    try {
      setSendingCampaignId(campaignId)
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send campaign')
      toast.success(data.message || 'Campaign sent successfully')
      await loadCampaigns()
    } catch (error) {
      console.error('Failed to send campaign:', error)
      toast.error(error.message || 'Failed to send campaign')
    } finally {
      setSendingCampaignId(null)
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

      setCampaignForm((current) => ({ ...current, templateHeaderImageUrl: data.url || '' }))
      toast.success('Image uploaded')
    } catch (error) {
      console.error('Failed to upload campaign image:', error)
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  async function deleteCampaign(campaignId) {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
      const data = response.ok ? null : await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to delete campaign')
      toast.success('Campaign deleted successfully')
      await loadCampaigns()
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      toast.error(error.message || 'Failed to delete campaign')
    }
  }

  const selectedTemplate = templates.find((template) => template.name === campaignForm.template) || null
  const selectedTemplateHasImageHeader = !!selectedTemplate?.components?.some((component) => component.type === 'HEADER' && component.format === 'IMAGE')
  const selectedAudience = audienceOptions.find((option) => option.value === campaignForm.audience) || audienceOptions[0]
  const customRecipients = campaignForm.recipientPhones.split(',').map((phone) => phone.trim()).filter(Boolean)
  const templateVariableCount = countTemplateVariables(selectedTemplate)
  const trimmedVariableValues = campaignForm.variables.slice(0, templateVariableCount).map((value) => value.trim())
  const previewText = fillTemplatePreview(campaignForm.templateBody || getTemplateBody(selectedTemplate), trimmedVariableValues)
  const previewName = getPreviewName(trimmedVariableValues)
  const previewSubtitle = buildPreviewSubtitle(campaignForm.audience, customRecipients.length)
  const selectedPreviewCampaign = campaigns.find((campaign) => campaign.id === selectedPreviewCampaignId) || null
  const previewCampaignTemplate = selectedPreviewCampaign
    ? templates.find((template) => template.name === selectedPreviewCampaign.template) || null
    : null
  const activePreviewType = 'Template message'
  const activePreviewTemplate = selectedPreviewCampaign ? (selectedPreviewCampaign.template || 'Template') : (campaignForm.template || 'Select template')
  const activePreviewLanguage = selectedPreviewCampaign
    ? (selectedPreviewCampaign.templateLanguage || previewCampaignTemplate?.language || 'Language')
    : (campaignForm.templateLanguage || selectedTemplate?.language || 'Language')
  const activePreviewCategory = selectedPreviewCampaign
    ? (selectedPreviewCampaign.templateCategory || previewCampaignTemplate?.category || 'Template')
    : (campaignForm.templateCategory || selectedTemplate?.category || 'Template')
  const activePreviewHeaderImage = selectedPreviewCampaign
    ? (selectedPreviewCampaign.templateHeaderImageUrl || '')
    : (campaignForm.templateHeaderImageUrl || '')
  const activePreviewAudience = selectedPreviewCampaign
    ? formatAudienceLabel(selectedPreviewCampaign.audience)
    : selectedAudience.label
  const activePreviewLabel = selectedPreviewCampaign
    ? (selectedPreviewCampaign.name || 'Saved campaign')
    : 'Builder draft'
  const activePreviewText = selectedPreviewCampaign
    ? fillTemplatePreview(
        selectedPreviewCampaign.message || getTemplateBody(previewCampaignTemplate),
        Array.isArray(selectedPreviewCampaign.variables) ? selectedPreviewCampaign.variables : []
      )
    : previewText
  const activePreviewContactName = selectedPreviewCampaign
    ? getPreviewName(Array.isArray(selectedPreviewCampaign.variables) ? selectedPreviewCampaign.variables : [])
    : previewName
  const activePreviewSubtitle = selectedPreviewCampaign
    ? buildPreviewSubtitle(
        selectedPreviewCampaign.audience,
        Array.isArray(selectedPreviewCampaign.recipients) ? selectedPreviewCampaign.recipients.length : 0
      )
    : previewSubtitle
  const activePreviewVariableCount = selectedPreviewCampaign
    ? (Array.isArray(selectedPreviewCampaign.variables) ? selectedPreviewCampaign.variables.filter(Boolean).length : 0)
    : trimmedVariableValues.filter(Boolean).length

  const canAdvanceFromSetup =
    campaignForm.name.trim().length > 0 &&
    (campaignForm.audience !== 'custom' || customRecipients.length > 0)

  const hasAllVariables = templateVariableCount === 0 || (
    trimmedVariableValues.length === templateVariableCount &&
    trimmedVariableValues.every(Boolean)
  )

  const canAdvanceFromTemplate = !!campaignForm.template && hasAllVariables
  const canCreateCampaign = canAdvanceFromSetup && canAdvanceFromTemplate
  const builderCompletion = Math.round(([
    canAdvanceFromSetup,
    canAdvanceFromTemplate,
    canCreateCampaign
  ].filter(Boolean).length / builderSteps.length) * 100)

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const name = (campaign.name || '').toLowerCase()
      const template = (campaign.template || '').toLowerCase()
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || template.includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus
      const matchesTemplate = filterTemplate === 'all' || campaign.template === filterTemplate
      return matchesSearch && matchesStatus && matchesTemplate
    })
  }, [campaigns, searchTerm, filterStatus, filterTemplate])

  function resetBuilder() {
    setCampaignForm(buildEmptyCampaign())
    setBuilderStep('setup')
    setSelectedPreviewCampaignId(null)
  }

  function selectTemplate(template) {
    const variableCount = countTemplateVariables(template)
    setCampaignForm((current) => ({
      ...current,
      template: template.name,
      templateLanguage: template.language || '',
      templateCategory: template.category || '',
      templateHeaderImageUrl: template.components?.some((component) => component.type === 'HEADER' && component.format === 'IMAGE')
        ? current.templateHeaderImageUrl
        : '',
      templateBody: getTemplateBody(template),
      variables: Array.from({ length: variableCount }, (_, index) => current.variables[index] || '')
    }))
  }

  function updateVariable(index, value) {
    setCampaignForm((current) => {
      const variables = [...current.variables]
      variables[index] = value
      return { ...current, variables }
    })
  }

  function handleCreateCampaign() {
    if (!canCreateCampaign) {
      toast.error('Complete setup, template selection, and required variables first')
      return
    }

    createCampaign({
      name: campaignForm.name.trim(),
      campaignType: 'template',
      template: campaignForm.template,
      templateLanguage: campaignForm.templateLanguage,
      templateCategory: campaignForm.templateCategory,
      templateHeaderImageUrl: campaignForm.templateHeaderImageUrl,
      message: campaignForm.templateBody,
      variables: trimmedVariableValues,
      productIds: [],
      audience: campaignForm.audience,
      recipients: campaignForm.audience === 'custom' ? customRecipients : [],
      scheduledAt: campaignForm.scheduledAt || null,
      status: campaignForm.scheduledAt ? 'scheduled' : 'draft'
    })
  }

  return (
    <div className="space-y-6">
      <Toaster />

      <Card className="border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(239,246,255,0.94),_rgba(248,250,252,1))]">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.45fr_0.75fr]">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit border-sky-200 bg-white/80 text-sky-700">
              Campaign Studio
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">Create WhatsApp campaigns with a clear live preview.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Pick the audience, choose an approved template, and preview the exact WhatsApp message before saving.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Campaigns</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{campaigns.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Templates</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{templates.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-1 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-2xl">Create campaign</CardTitle>
                  <CardDescription className="mt-2">
                    Three steps, a lighter audience picker, and a full-height WhatsApp preview.
                  </CardDescription>
                </div>
                <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-medium text-slate-950">{builderCompletion}%</span>
                  </div>
                  <Progress value={builderCompletion} className="mt-3 h-2" />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6">
              <div className="grid gap-3 md:grid-cols-3">
                {builderSteps.map((step) => {
                  const active = builderStep === step.id
                  const done =
                    (step.id === 'setup' && canAdvanceFromSetup) ||
                    (step.id === 'template' && canAdvanceFromTemplate) ||
                    (step.id === 'review' && canCreateCampaign)

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setBuilderStep(step.id)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-slate-50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className={`text-xs uppercase tracking-[0.18em] ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                            {step.label}
                          </div>
                        </div>
                        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <ArrowRight className={`h-5 w-5 ${active ? 'text-slate-300' : 'text-slate-400'}`} />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {builderStep === 'setup' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Campaign name</Label>
                    <Input
                      id="campaign-name"
                      placeholder="Summer arrivals push"
                      value={campaignForm.name}
                      onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>

                  <div className="grid gap-3">
                    {audienceOptions.map((option) => {
                      const Icon = option.icon
                      const active = campaignForm.audience === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setCampaignForm((current) => ({ ...current, audience: option.value }))}
                          className={`rounded-2xl border p-3.5 text-left transition ${
                            active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-slate-50 hover:bg-white'
                          }`}
                        >
                          <div className="flex gap-3">
                            <div className={`rounded-xl border p-2.5 ${active ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-white'}`}>
                              <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-700'}`} />
                            </div>
                            <div>
                              <div className="font-medium">{option.label}</div>
                              <p className={`mt-1 text-sm leading-6 ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                                {option.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {campaignForm.audience === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="custom-recipients">Custom phone numbers</Label>
                      <Textarea
                        id="custom-recipients"
                        rows={3}
                        placeholder="+919876543210, +919123456789"
                        value={campaignForm.recipientPhones}
                        onChange={(event) => setCampaignForm((current) => ({ ...current, recipientPhones: event.target.value }))}
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={() => setBuilderStep('template')} disabled={!canAdvanceFromSetup}>
                      Continue to template
                    </Button>
                  </div>
                </div>
              )}

              {builderStep === 'template' && (
                <div className="space-y-6">
                  {templateError && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      {templateError}
                    </div>
                  )}

                  <div className="grid gap-4">
                    {templates.map((template) => {
                      const active = campaignForm.template === template.name
                      return (
                        <button
                          key={template.id || template.name}
                          type="button"
                          onClick={() => selectTemplate(template)}
                          className={`rounded-3xl border p-4 text-left transition ${
                            active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{template.name}</span>
                                <Badge variant="outline" className={active ? 'border-white/20 text-white' : ''}>
                                  {template.category}
                                </Badge>
                                <Badge variant="outline" className={active ? 'border-white/20 text-white' : ''}>
                                  {template.language}
                                </Badge>
                              </div>
                              <p className={`mt-3 text-sm leading-6 ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                                {getTemplateBody(template)}
                              </p>
                            </div>
                            <Badge className={active ? 'bg-emerald-500' : 'bg-slate-200 text-slate-700'}>
                              {countTemplateVariables(template)} vars
                            </Badge>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {!!selectedTemplate && (
                    <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-950">Template variables</div>
                          <p className="mt-1 text-sm text-slate-500">
                            Use direct values or tokens like <code>{'{{customer_name}}'}</code> and <code>{'{{catalog_link}}'}</code>.
                          </p>
                        </div>
                        <Badge variant="outline">{templateVariableCount} required</Badge>
                      </div>

                      {selectedTemplateHasImageHeader && (
                        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <div>
                            <div className="text-sm font-medium text-slate-950">Template image header</div>
                            <p className="mt-1 text-sm text-slate-600">
                              This approved template expects a header image. Add a public image URL to include it when the campaign sends.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="campaign-image-url">Image URL</Label>
                            <Input
                              id="campaign-image-url"
                              placeholder="https://example.com/campaign-banner.jpg"
                              value={campaignForm.templateHeaderImageUrl}
                              onChange={(event) => setCampaignForm((current) => ({ ...current, templateHeaderImageUrl: event.target.value }))}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              ref={imageUploadRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2"
                              onClick={() => imageUploadRef.current?.click()}
                              disabled={uploadingImage}
                            >
                              {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                              {uploadingImage ? 'Uploading...' : 'Upload image'}
                            </Button>
                            <span className="text-xs text-slate-500">JPG, PNG, or WebP up to 5MB</span>
                          </div>
                        </div>
                      )}

                      {templateVariableCount === 0 ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                          This template does not require parameters. You can continue to review.
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {Array.from({ length: templateVariableCount }, (_, index) => (
                            <div key={`${campaignForm.template}-${index}`} className="space-y-2">
                              <Label htmlFor={`template-var-${index}`}>Variable {index + 1}</Label>
                              <Input
                                id={`template-var-${index}`}
                                placeholder={variableHints[index] || `Value ${index + 1}`}
                                value={campaignForm.variables[index] || ''}
                                onChange={(event) => updateVariable(index, event.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBuilderStep('setup')}>
                      Back
                    </Button>
                    <Button onClick={() => setBuilderStep('review')} disabled={!canAdvanceFromTemplate}>
                      Continue to review
                    </Button>
                  </div>
                </div>
              )}

              {builderStep === 'review' && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Name</span>
                          <span className="font-medium text-slate-950">{campaignForm.name || 'Untitled campaign'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Type</span>
                          <span className="font-medium text-slate-950">Template message</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Audience</span>
                          <span className="font-medium text-slate-950">{selectedAudience.label}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Template</span>
                          <span className="font-medium text-slate-950">{campaignForm.template || 'Not selected'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Schedule</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="scheduled-at">Optional schedule</Label>
                          <Input
                            id="scheduled-at"
                            type="datetime-local"
                            value={campaignForm.scheduledAt}
                            onChange={(event) => setCampaignForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                          />
                        </div>
                        <p className="text-sm text-slate-500">
                          Scheduled campaigns are saved for later review. Sending is still manual from the history list.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBuilderStep('template')}>
                      Back
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetBuilder}>
                        Reset
                      </Button>
                      <Button onClick={handleCreateCampaign} disabled={!canCreateCampaign || savingCampaign}>
                        {savingCampaign ? 'Saving...' : 'Save campaign'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-10"
                placeholder="Search by campaign name or template"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTemplate} onValueChange={setFilterTemplate}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All templates</SelectItem>
                  {Array.from(new Set(campaigns.map((campaign) => campaign.template).filter(Boolean))).map((template) => (
                    <SelectItem key={template} value={template}>
                      {template}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {filteredCampaigns.map((campaign) => {
              const status = formatStatus(campaign.status)
              const previewBody = campaign.message || getTemplateBody(templates.find((template) => template.name === campaign.template))
              const preview = fillTemplatePreview(previewBody, Array.isArray(campaign.variables) ? campaign.variables : [])
              const failedCount = Array.isArray(campaign.results) ? campaign.results.filter((result) => !result.success).length : 0
              return (
                <Card
                  key={campaign.id}
                  className={`overflow-hidden border-slate-200 shadow-sm transition ${selectedPreviewCampaignId === campaign.id ? 'ring-2 ring-sky-400 ring-offset-2' : ''}`}
                >
                  <CardHeader className="space-y-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription className="mt-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {campaign.template}
                        </CardDescription>
                      </div>
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <Badge variant="outline">Template message</Badge>
                      <Badge variant="outline">{formatAudienceLabel(campaign.audience)}</Badge>
                      <Badge variant="outline">{formatRecipientCount(campaign)}</Badge>
                      {campaign.sentAt && (
                        <Badge variant="outline">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(campaign.sentAt).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <Button
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setSelectedPreviewCampaignId(campaign.id)}
                    >
                      Show this campaign in preview
                    </Button>
                    <p className="text-sm leading-6 text-slate-600">{preview}</p>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-500">Failures</span>
                      <span className="font-semibold text-slate-950">{failedCount}</span>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status !== 'sent' && (
                        <Button className="flex-1 gap-2" disabled={sendingCampaignId === campaign.id} onClick={() => sendCampaign(campaign.id)}>
                          <Send className="h-4 w-4" />
                          {sendingCampaignId === campaign.id ? 'Sending...' : 'Send now'}
                        </Button>
                      )}
                      <Button variant="outline" className="gap-2" onClick={() => deleteCampaign(campaign.id)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {filteredCampaigns.length === 0 && (
              <Card className="xl:col-span-2">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="mb-4 h-12 w-12 text-slate-300" />
                    <div className="text-lg font-medium text-slate-950">No campaigns found</div>
                    <div className="mt-2 max-w-md text-sm text-slate-500">
                      {searchTerm || filterStatus !== 'all' || filterTemplate !== 'all'
                        ? 'Adjust the search or filters to find the campaign you need.'
                        : 'Create your first campaign above.'}
                    </div>
                    <Button className="mt-5 gap-2" onClick={resetBuilder}>
                      <Plus className="h-4 w-4" />
                      Start new campaign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="order-2 flex flex-col justify-end xl:sticky xl:top-6 xl:self-start">
          <div className="flex min-h-[calc(100vh-220px)] w-full flex-col rounded-[32px] border border-slate-200 bg-slate-950 p-3 shadow-[0_32px_80px_-32px_rgba(15,23,42,0.55)]">
            <div className="flex items-center justify-between rounded-[28px] bg-slate-900 px-5 py-4 text-white">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">WhatsApp mockup</div>
                <div className="mt-1 flex items-center gap-2 text-base font-semibold">
                  <Smartphone className="h-4 w-4" />
                  Campaign preview
                </div>
                <div className="mt-2 min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{activePreviewContactName}</div>
                  <div className="truncate text-xs text-slate-300">{activePreviewSubtitle}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">
                  Live
                </Badge>
                <div className="text-[11px] text-slate-300">now</div>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-hidden rounded-[26px] bg-[#efeae2]">
              <div className="mx-auto h-4 w-20 rounded-b-2xl bg-slate-950" />
              <div className="flex h-[calc(100%-16px)] flex-col justify-between px-3.5 py-4">
                <div className="space-y-3">
                  <div className="max-w-[76%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] text-slate-600 shadow-sm">
                    Hi, show me what this campaign will look like.
                  </div>

                  <div className="ml-auto max-w-[84%] rounded-2xl rounded-br-md bg-[#dcf8c6] px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm">
                    {activePreviewHeaderImage && (
                      <div className="mb-3 overflow-hidden rounded-2xl border border-black/5 bg-white/70">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={activePreviewHeaderImage} alt="Campaign template header" className="h-36 w-full object-cover" />
                      </div>
                    )}
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="h-6 bg-white/80 px-2 text-[11px] text-slate-700">
                        {activePreviewCategory}
                      </Badge>
                      <Badge variant="outline" className="h-6 border-emerald-700/20 bg-white/60 px-2 text-[11px] text-emerald-900">
                        {activePreviewLanguage}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap leading-5">{activePreviewText}</p>
                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                      <span>3:27 PM</span>
                      <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white/90 p-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Type</span>
                    <span className="font-medium text-slate-950">{activePreviewType}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-500">Template</span>
                    <span className="font-medium text-slate-950">{activePreviewTemplate}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-500">Audience</span>
                    <span className="font-medium text-slate-950">{activePreviewAudience}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-500">Variables ready</span>
                    <span className="font-medium text-slate-950">{activePreviewVariableCount}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-500">Header image</span>
                    <span className="font-medium text-slate-950">{activePreviewHeaderImage ? 'Added' : 'None'}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-500">Source</span>
                    <span className="font-medium text-slate-950">{activePreviewLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
