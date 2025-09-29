'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast, Toaster } from 'sonner'
import { 
  Plus,
  Search,
  Filter,
  Eye,
  Trash,
  Edit,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  Calendar,
  AlertTriangle
} from 'lucide-react'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTemplate, setFilterTemplate] = useState('all')

  // Load campaigns and templates on mount
  useEffect(() => {
    loadCampaigns()
    loadTemplates()
  }, [])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns')
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data)
      } else {
        throw new Error('Failed to load campaigns')
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/whatsapp-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
      } else {
        // Fallback to mock data if API fails
        const mockTemplates = [
          {
            id: '1',
            name: 'summer_sale_2025',
            category: 'MARKETING',
            language: 'en_US',
            status: 'APPROVED',
            components: [
              {
                type: 'BODY',
                text: '🌟 Summer Sale Alert! Get {discount}% off all products. Shop now at {shop_url}'
              }
            ]
          },
          {
            id: '2',
            name: 'product_launch',
            category: 'MARKETING',
            language: 'en_US',
            status: 'APPROVED',
            components: [
              {
                type: 'BODY',
                text: '🚀 Exciting news! Our new {product_line} is now available. Check it out at {shop_url}'
              }
            ]
          }
        ]
        setTemplates(mockTemplates)
        toast.warning('Using mock templates. Connect WhatsApp to see actual templates.')
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      toast.error('Failed to load templates')
    }
  }

  const createCampaign = async (campaignData) => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      })
      
      if (response.ok) {
        await loadCampaigns()
        toast.success('Campaign created successfully!')
        setShowCreateDialog(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create campaign')
      }
    } catch (error) {
      console.error('Failed to create campaign:', error)
      toast.error('Failed to create campaign: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const sendCampaign = async (campaignId) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const result = await response.json()
        await loadCampaigns()
        if (result.success) {
          toast.success(result.message || 'Campaign sent successfully!')
        } else {
          toast.warning(result.message || 'Campaign completed with some issues')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send campaign')
      }
    } catch (error) {
      console.error('Failed to send campaign:', error)
      toast.error('Failed to send campaign: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCampaign = async (campaignId) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await loadCampaigns()
        toast.success('Campaign deleted successfully!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete campaign')
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      toast.error('Failed to delete campaign: ' + error.message)
    }
  }

  const CreateCampaignDialog = () => {
    const [campaignForm, setCampaignForm] = useState({
      name: '',
      template: '',
      message: '',
      audience: 'all_customers',
      recipientPhones: '',
      scheduledAt: ''
    })

    const handleCreateCampaign = () => {
      if (!campaignForm.name) {
        toast.error('Campaign name is required')
        return
      }

      if (!campaignForm.template && !campaignForm.message.trim()) {
        toast.error('Message content is required when not using a template')
        return
      }

      const recipients = campaignForm.audience === 'custom' 
        ? campaignForm.recipientPhones.split(',').map(p => p.trim()).filter(p => p)
        : []

      createCampaign({
        ...campaignForm,
        template: campaignForm.template === 'no-template' ? '' : campaignForm.template,
        recipients: recipients,
        status: campaignForm.scheduledAt ? 'scheduled' : 'draft'
      })
    }

    // Get template body text for preview
    const getTemplateBody = (templateName) => {
      const template = templates.find(t => t.name === templateName)
      if (!template) return ''
      
      const bodyComponent = template.components?.find(c => c.type === 'BODY')
      return bodyComponent?.text || 'No preview available'
    }

    return (
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Create a marketing campaign to send to your customers using Meta templates
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label htmlFor="campaign-name">Campaign Name *</Label>
              <Input
                id="campaign-name"
                placeholder="Summer Sale Campaign"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="campaign-template">Select Template (Optional)</Label>
              <Select 
                value={campaignForm.template || 'no-template'} 
                onValueChange={(value) => setCampaignForm(prev => ({ ...prev, template: value === 'no-template' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-template">No Template (Text Message)</SelectItem>
                  {templates
                    .filter(template => template.status === 'APPROVED')
                    .map((template) => (
                      <SelectItem key={template.id} value={template.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {template.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Choose from your approved Meta campaign templates or send as a regular text message
              </p>
            </div>

            {campaignForm.template && campaignForm.template !== 'no-template' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                    Template Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {templates
                    .filter(t => t.name === campaignForm.template)
                    .map(template => (
                      <div key={template.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{template.category}</Badge>
                          <Badge variant="outline">{template.language}</Badge>
                          <Badge variant="default" className="bg-green-500">
                            {template.status}
                          </Badge>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm">
                            {getTemplateBody(template.name)}
                          </p>
                        </div>
                      </div>
                    ))
                  }
                </CardContent>
              </Card>
            )}

            {!campaignForm.template || campaignForm.template === 'no-template' ? (
              <div>
                <Label htmlFor="campaign-message">Message *</Label>
                <Textarea
                  id="campaign-message"
                  placeholder="Enter your campaign message here..."
                  value={campaignForm.message}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  This message will be sent as a regular text message
                </p>
              </div>
            ) : null}

            <div>
              <Label htmlFor="audience">Audience</Label>
              <Select 
                value={campaignForm.audience} 
                onValueChange={(value) => setCampaignForm(prev => ({ ...prev, audience: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_customers">All Customers</SelectItem>
                  <SelectItem value="recent_buyers">Recent Buyers</SelectItem>
                  <SelectItem value="custom">Custom Phone Numbers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {campaignForm.audience === 'custom' && (
              <div>
                <Label htmlFor="recipient-phones">Phone Numbers</Label>
                <Textarea
                  id="recipient-phones"
                  placeholder="+1234567890, +1987654321"
                  value={campaignForm.recipientPhones}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, recipientPhones: e.target.value }))}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter phone numbers separated by commas
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="scheduled-at">Schedule (Optional)</Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={campaignForm.scheduledAt}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Leave blank to send immediately
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateCampaign} disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: 'bg-gray-500', label: 'Draft', icon: null },
      scheduled: { color: 'bg-blue-500', label: 'Scheduled', icon: <Calendar className="w-3 h-3 mr-1" /> },
      sent: { color: 'bg-green-500', label: 'Sent', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
      partially_sent: { color: 'bg-yellow-500', label: 'Partially Sent', icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
      failed: { color: 'bg-red-500', label: 'Failed', icon: <AlertCircle className="w-3 h-3 mr-1" /> }
    }
    
    const config = statusConfig[status] || statusConfig.draft
    
    return (
      <Badge variant="default" className={config.color}>
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  // Filter campaigns based on search and filters
  const filteredCampaigns = campaigns.filter(campaign => {
    const safeSearchTerm = searchTerm || '';
    const matchesSearch = 
      (campaign.name && campaign.name.toLowerCase().includes(safeSearchTerm.toLowerCase())) || 
      (campaign.template && campaign.template.toLowerCase().includes(safeSearchTerm.toLowerCase()))
    
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus
    const matchesTemplate = filterTemplate === 'all' || 
                           (filterTemplate === 'no-template' && (!campaign.template || campaign.template === '' || campaign.template.trim() === '')) || 
                           campaign.template === filterTemplate
    
    return matchesSearch && matchesStatus && matchesTemplate
  })

  return (
    <div className="space-y-6">
      <Toaster />
      <CreateCampaignDialog />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your WhatsApp marketing campaigns
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search campaigns..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partially_sent">Partially Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTemplate} onValueChange={setFilterTemplate}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {Array.from(new Set(
                campaigns
                  .map(c => (c.template && c.template.trim() !== '') ? c.template : 'no-template')
                  .filter(t => t && t !== '')
              )).map(template => (
                <SelectItem key={template} value={template}>
                  {template === 'no-template' ? 'No Template' : template}
                </SelectItem>
              ))}
              <SelectItem value="no-template">No Template</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCampaigns.map((campaign) => (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg truncate">{campaign.name || 'Untitled Campaign'}</CardTitle>
                {getStatusBadge(campaign.status)}
              </div>
              <CardDescription className="flex items-center">
                {campaign.template ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    {campaign.template}
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Text Message
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {campaign.message || getTemplateBody(campaign.template) || 'No message content'}
              </p>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span>
                  {campaign.audience === 'all_customers' ? 'All Customers' : 
                   campaign.audience === 'recent_buyers' ? 'Recent Buyers' : 
                   `${(campaign.recipients && campaign.recipients.length) || campaign.sentCount || campaign.failedCount || 0} Recipients`}
                </span>
                <span>
                  {campaign.status === 'scheduled' && campaign.scheduledAt && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(campaign.scheduledAt).toLocaleDateString()}
                    </div>
                  )}
                  {campaign.status === 'sent' && campaign.sentAt && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(campaign.sentAt).toLocaleDateString()}
                    </div>
                  )}
                  {(campaign.status === 'partially_sent' || campaign.status === 'failed') && campaign.sentAt && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(campaign.sentAt).toLocaleDateString()}
                    </div>
                  )}
                </span>

              </div>
              
              {(campaign.sentCount > 0 || campaign.failedCount > 0) && (
                <div className="flex items-center text-sm mb-4">
                  <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                  <span className="mr-3">{campaign.sentCount || 0} sent</span>
                  {campaign.failedCount > 0 && (
                    <>
                      <AlertCircle className="w-4 h-4 mr-1 text-red-500" />
                      <span>{campaign.failedCount} failed</span>
                    </>
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                  <Button 
                    size="sm" 
                    onClick={() => sendCampaign(campaign.id)}
                    disabled={loading}
                    className="flex-1"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Send
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => deleteCampaign(campaign.id)}
                  disabled={loading}
                >
                  <Trash className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredCampaigns.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg mb-2">No Campaigns Found</p>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || filterStatus !== 'all' || filterTemplate !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Create your first marketing campaign to reach customers'}
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}