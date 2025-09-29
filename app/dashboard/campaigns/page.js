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
  Calendar
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
      // In a real implementation, this would fetch from your API
      // const response = await fetch('/api/campaigns')
      // if (response.ok) {
      //   const data = await response.json()
      //   setCampaigns(data)
      // }
      
      // Mock data for demonstration
      const mockCampaigns = [
        {
          id: '1',
          name: 'Summer Sale Campaign',
          template: 'summer_sale_2025',
          message: '🌟 Summer Sale Alert! Get 30% off all products. Shop now!',
          audience: 'all_customers',
          recipients: 1250,
          status: 'sent',
          sentAt: new Date('2025-07-15'),
        },
        {
          id: '2',
          name: 'New Product Launch',
          template: 'product_launch',
          message: '🚀 Exciting news! Our new product line is now available. Check it out!',
          audience: 'recent_buyers',
          recipients: 842,
          status: 'scheduled',
          scheduledAt: new Date('2025-08-01'),
        },
        {
          id: '3',
          name: 'Customer Feedback Request',
          template: 'feedback_request',
          message: 'We value your opinion! Please share your feedback on your recent purchase.',
          audience: 'recent_buyers',
          recipients: 320,
          status: 'draft',
        }
      ]
      setCampaigns(mockCampaigns)
    } catch (error) {
      console.error('Failed to load campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      // In a real implementation, this would fetch from your API
      // const response = await fetch('/api/whatsapp-templates')
      // if (response.ok) {
      //   const data = await response.json()
      //   setTemplates(data)
      // }
      
      // Mock data for demonstration
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
        },
        {
          id: '3',
          name: 'feedback_request',
          category: 'UTILITY',
          language: 'en_US',
          status: 'APPROVED',
          components: [
            {
              type: 'BODY',
              text: 'We value your opinion! Please share your feedback on your recent purchase by clicking {feedback_link}'
            }
          ]
        },
        {
          id: '4',
          name: 'order_confirmation',
          category: 'UTILITY',
          language: 'en_US',
          status: 'APPROVED',
          components: [
            {
              type: 'BODY',
              text: 'Thank you for your order #{order_number}! Your order is confirmed and will be shipped soon.'
            }
          ]
        }
      ]
      setTemplates(mockTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
      toast.error('Failed to load templates')
    }
  }

  const createCampaign = async (campaignData) => {
    try {
      setLoading(true)
      // In a real implementation, this would POST to your API
      // const response = await fetch('/api/campaigns', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(campaignData)
      // })
      
      // if (response.ok) {
      //   await loadCampaigns()
      //   toast.success('Campaign created successfully!')
      //   setShowCreateDialog(false)
      // } else {
      //   const error = await response.json()
      //   toast.error(error.error || 'Failed to create campaign')
      // }
      
      // Mock implementation for demonstration
      toast.success('Campaign created successfully!')
      setShowCreateDialog(false)
      loadCampaigns()
    } catch (error) {
      console.error('Failed to create campaign:', error)
      toast.error('Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  const sendCampaign = async (campaignId) => {
    try {
      setLoading(true)
      // In a real implementation, this would POST to your API
      // const response = await fetch(`/api/campaigns/${campaignId}/send`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' }
      // })
      
      // if (response.ok) {
      //   await loadCampaigns()
      //   toast.success('Campaign sent successfully!')
      // } else {
      //   const error = await response.json()
      //   toast.error(error.error || 'Failed to send campaign')
      // }
      
      // Mock implementation for demonstration
      toast.success('Campaign sent successfully!')
      loadCampaigns()
    } catch (error) {
      console.error('Failed to send campaign:', error)
      toast.error('Failed to send campaign')
    } finally {
      setLoading(false)
    }
  }

  const deleteCampaign = async (campaignId) => {
    try {
      // In a real implementation, this would DELETE to your API
      // const response = await fetch(`/api/campaigns/${campaignId}`, {
      //   method: 'DELETE'
      // })
      
      // if (response.ok) {
      //   await loadCampaigns()
      //   toast.success('Campaign deleted successfully!')
      // } else {
      //   const error = await response.json()
      //   toast.error(error.error || 'Failed to delete campaign')
      // }
      
      // Mock implementation for demonstration
      toast.success('Campaign deleted successfully!')
      loadCampaigns()
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      toast.error('Failed to delete campaign')
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
      if (!campaignForm.name || !campaignForm.template) {
        toast.error('Campaign name and template are required')
        return
      }

      const recipients = campaignForm.audience === 'custom' 
        ? campaignForm.recipientPhones.split(',').map(p => p.trim()).filter(p => p)
        : []

      createCampaign({
        ...campaignForm,
        recipients: recipients,
        status: campaignForm.scheduledAt ? 'scheduled' : 'draft'
      })
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
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="Summer Sale Campaign"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="campaign-template">Select Template</Label>
              <Select 
                value={campaignForm.template} 
                onValueChange={(value) => setCampaignForm(prev => ({ ...prev, template: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.name}>
                      <div className="flex items-center justify-between w-full">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {template.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Choose from your approved Meta campaign templates
              </p>
            </div>

            {campaignForm.template && (
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
                            {template.components?.find(c => c.type === 'BODY')?.text || 'No preview available'}
                          </p>
                        </div>
                      </div>
                    ))
                  }
                </CardContent>
              </Card>
            )}

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
      draft: { color: 'bg-gray-500', label: 'Draft' },
      scheduled: { color: 'bg-blue-500', label: 'Scheduled' },
      sent: { color: 'bg-green-500', label: 'Sent' },
      failed: { color: 'bg-red-500', label: 'Failed' }
    }
    
    const config = statusConfig[status] || statusConfig.draft
    
    return (
      <Badge variant="default" className={config.color}>
        {config.label}
      </Badge>
    )
  }

  // Filter campaigns based on search and filters
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          campaign.template.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus
    const matchesTemplate = filterTemplate === 'all' || campaign.template === filterTemplate
    
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
            </SelectContent>
          </Select>
          <Select value={filterTemplate} onValueChange={setFilterTemplate}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {Array.from(new Set(campaigns.map(c => c.template))).map(template => (
                <SelectItem key={template} value={template}>{template}</SelectItem>
              ))}
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
                <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
                {getStatusBadge(campaign.status)}
              </div>
              <CardDescription className="flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                {campaign.template}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {campaign.message}
              </p>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span>
                  {campaign.audience === 'all_customers' ? 'All Customers' : 
                   campaign.audience === 'recent_buyers' ? 'Recent Buyers' : 
                   `${campaign.recipients} Recipients`}
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
                </span>
              </div>
              
              <div className="flex gap-2">
                {campaign.status === 'draft' && (
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