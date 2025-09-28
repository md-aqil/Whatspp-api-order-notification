'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast, Toaster } from 'sonner'
import { 
  MessageCircle, 
  Store, 
  CreditCard, 
  Settings, 
  Send,
  Package,
  CheckCircle,
  AlertCircle,
  Plus,
  ExternalLink,
  Megaphone,
  ShoppingBag,
  Users,
  Calendar,
  Eye,
  Trash,
  Edit,
  Sparkles,
  MessageSquare
} from 'lucide-react'

export default function DashboardPage() {
  const [integrations, setIntegrations] = useState({
    whatsapp: { connected: false, data: {} },
    shopify: { connected: false, data: {} },
    stripe: { connected: false, data: {} }
  })
  
  const [products, setProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCampaignDialog, setShowCampaignDialog] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  // Load integrations status on mount
  useEffect(() => {
    loadIntegrations()
    loadCampaigns()
    loadOrders()
  }, [])

  const loadIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations')
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data)
      }
    } catch (error) {
      console.error('Failed to load integrations:', error)
    }
  }

  const loadProducts = async () => {
    if (!integrations.shopify.connected) return
    
    try {
      setLoading(true)
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns')
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data)
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    }
  }

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      } else {
        toast.error('Failed to load orders')
      }
    } catch (error) {
      console.error('Failed to load orders:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const saveIntegration = async (type, data) => {
    try {
      setLoading(true)
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      })
      
      if (response.ok) {
        await loadIntegrations()
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} integration saved successfully!`)
        if (type === 'shopify') {
          loadProducts()
          // Setup Shopify webhooks
          setupShopifyWebhooks()
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save integration')
      }
    } catch (error) {
      console.error('Failed to save integration:', error)
      toast.error('Failed to save integration')
    } finally {
      setLoading(false)
    }
  }

  const setupShopifyWebhooks = async () => {
    try {
      const response = await fetch('/api/setup-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        toast.success('Shopify webhooks configured for order confirmations!')
      }
    } catch (error) {
      console.error('Failed to setup webhooks:', error)
    }
  }

  const sendCatalog = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    const recipient = document.getElementById('recipient').value
    if (!recipient) {
      toast.error('Please enter recipient phone number')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/send-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          products: selectedProducts,
          recipient: recipient
        })
      })
      
      if (response.ok) {
        toast.success('Catalog sent successfully!')
        setSelectedProducts([])
        document.getElementById('recipient').value = ''
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send catalog')
      }
    } catch (error) {
      console.error('Failed to send catalog:', error)
      toast.error('Failed to send catalog')
    } finally {
      setLoading(false)
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
        setShowCampaignDialog(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create campaign')
      }
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
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        await loadCampaigns()
        toast.success('Campaign sent successfully!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send campaign')
      }
    } catch (error) {
      console.error('Failed to send campaign:', error)
      toast.error('Failed to send campaign')
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
      toast.error('Failed to delete campaign')
    }
  }

  const IntegrationForm = ({ type, integration }) => {
    const [formData, setFormData] = useState(integration.data || {})

    const handleSubmit = (e) => {
      e.preventDefault()
      saveIntegration(type, formData)
    }

    const getFields = () => {
      switch (type) {
        case 'whatsapp':
          return [
            { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '818391834688215' },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Your WhatsApp Access Token', type: 'password' },
            { key: 'businessAccountId', label: 'Business Account ID', placeholder: '832073532824981' },
            { key: 'catalogId', label: 'Catalog ID (Optional)', placeholder: 'Your Facebook Catalog ID' },
            { key: 'webhookVerifyToken', label: 'Webhook Verify Token', placeholder: 'your_verify_token' }
          ]
        case 'shopify':
          return [
            { key: 'shopDomain', label: 'Shop Domain', placeholder: 'your-shop.myshopify.com' },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Your Shopify Access Token', type: 'password' },
            { key: 'apiKey', label: 'API Key', placeholder: 'Your Shopify API Key' },
            { key: 'apiSecret', label: 'API Secret', placeholder: 'Your Shopify API Secret', type: 'password' }
          ]
        case 'stripe':
          return [
            { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_test_...' },
            { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_test_...', type: 'password' },
            { key: 'webhookSecret', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password' }
          ]
        default:
          return []
      }
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {getFields().map(field => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              value={formData[field.key] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
              required
            />
          </div>
        ))}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Integration'}
        </Button>
      </form>
    )
  }

  const CampaignDialog = () => {
    const [campaignForm, setCampaignForm] = useState({
      name: '',
      message: '',
      audience: 'all_customers',
      recipientPhones: '',
      scheduledAt: ''
    })

    const handleCreateCampaign = () => {
      if (!campaignForm.name || !campaignForm.message) {
        toast.error('Campaign name and message are required')
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
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Create a marketing campaign to send to your customers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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
              <Label htmlFor="campaign-message">Message</Label>
              <Textarea
                id="campaign-message"
                placeholder="🌟 Summer Sale Alert! Get 30% off all products. Shop now!"
                value={campaignForm.message}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
              />
            </div>

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

            <div className="flex gap-2">
              <Button onClick={handleCreateCampaign} disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create & Send Now'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const getStatusBadge = (connected) => (
    connected ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="w-3 h-3 mr-1" />
        Connected
      </Badge>
    ) : (
      <Badge variant="secondary">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Connected
      </Badge>
    )
  )

  const getCampaignStatusBadge = (status) => {
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

  return (
    <div>
      <Toaster />
      <div className="space-y-6">
        <CampaignDialog />
        
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Commerce Hub Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your integrations, products, campaigns, and orders all in one place
          </p>
        </div>

        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="integrations">
              <Settings className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="w-4 h-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="send">
              <Send className="w-4 h-4 mr-2" />
              Send Catalog
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Megaphone className="w-4 h-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Orders
            </TabsTrigger>
          </TabsList>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="w-5 h-5 mr-2 text-green-600" />
                    WhatsApp Business
                  </CardTitle>
                  <CardDescription>
                    Connect your WhatsApp Business API to send messages and catalogs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    {getStatusBadge(integrations.whatsapp.connected)}
                  </div>
                  <IntegrationForm type="whatsapp" integration={integrations.whatsapp} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Store className="w-5 h-5 mr-2 text-blue-600" />
                    Shopify
                  </CardTitle>
                  <CardDescription>
                    Connect your Shopify store to sync products and handle orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    {getStatusBadge(integrations.shopify.connected)}
                  </div>
                  <IntegrationForm type="shopify" integration={integrations.shopify} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
                    Stripe
                  </CardTitle>
                  <CardDescription>
                    Accept payments through Stripe checkout links
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    {getStatusBadge(integrations.stripe.connected)}
                  </div>
                  <IntegrationForm type="stripe" integration={integrations.stripe} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Shopify Products</h2>
              <Button onClick={loadProducts} disabled={loading || !integrations.shopify.connected}>
                {loading ? 'Loading...' : 'Refresh Products'}
              </Button>
            </div>

            {!integrations.shopify.connected ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Store className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg mb-2">Connect Shopify First</p>
                    <p className="text-muted-foreground">
                      Please configure your Shopify integration to load products
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium truncate">{product.title}</h3>
                        <Badge variant="outline">${product.price}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {product.description || 'No description available'}
                      </p>
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.title}
                          className="w-full h-32 object-cover rounded mb-3"
                        />
                      )}
                      <Button
                        variant={selectedProducts.includes(product.id) ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (selectedProducts.includes(product.id)) {
                            setSelectedProducts(prev => prev.filter(id => id !== product.id))
                          } else {
                            setSelectedProducts(prev => [...prev, product.id])
                          }
                        }}
                      >
                        {selectedProducts.includes(product.id) ? 'Selected' : 'Select'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Send Catalog Tab */}
          <TabsContent value="send" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Product Catalog</CardTitle>
                <CardDescription>
                  Send selected products to customers via WhatsApp with payment links
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="recipient">Recipient Phone Number</Label>
                  <Input
                    id="recipient"
                    placeholder="+1234567890"
                    className="mt-1"
                  />
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-medium mb-2">Selected Products ({selectedProducts.length})</p>
                  {selectedProducts.length === 0 ? (
                    <p className="text-muted-foreground">No products selected</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedProducts.map(productId => {
                        const product = products.find(p => p.id === productId)
                        return product ? (
                          <div key={productId} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">{product.title}</span>
                            <Badge variant="outline">${product.price}</Badge>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                </div>

                <Button 
                  onClick={sendCatalog} 
                  disabled={loading || selectedProducts.length === 0 || !integrations.whatsapp.connected}
                  className="w-full"
                >
                  {loading ? 'Sending...' : 'Send Catalog via WhatsApp'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">WhatsApp Campaigns</h2>
              <Button onClick={() => setShowCampaignDialog(true)} disabled={!integrations.whatsapp.connected}>
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </div>

            {!integrations.whatsapp.connected ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg mb-2">Connect WhatsApp First</p>
                    <p className="text-muted-foreground">
                      Please configure your WhatsApp integration to create campaigns
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        {getCampaignStatusBadge(campaign.status)}
                      </div>
                      <CardDescription>
                        {campaign.audience === 'all_customers' ? 'All Customers' : 
                         campaign.audience === 'recent_buyers' ? 'Recent Buyers' : 
                         `${campaign.recipients?.length || 0} Recipients`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                        {campaign.message}
                      </p>
                      <div className="flex gap-2">
                        {campaign.status === 'draft' && (
                          <Button 
                            size="sm" 
                            onClick={() => sendCampaign(campaign.id)}
                            disabled={loading}
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
                      {campaign.sentAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Sent: {new Date(campaign.sentAt).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {campaigns.length === 0 && (
                  <Card className="md:col-span-2 lg:col-span-3">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Megaphone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg mb-2">No Campaigns Yet</p>
                        <p className="text-muted-foreground mb-4">
                          Create your first marketing campaign to reach customers
                        </p>
                        <Button onClick={() => setShowCampaignDialog(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Campaign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Orders</h2>
              <Button onClick={loadOrders} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh Orders'}
              </Button>
            </div>

            {!integrations.shopify.connected ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg mb-2">Connect Shopify First</p>
                    <p className="text-muted-foreground">
                      Please configure your Shopify integration to view orders
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">Order #{order.orderNumber}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">${order.total}</Badge>
                          {order.whatsappSent && (
                            <Badge variant="default" className="bg-green-500">
                              <MessageCircle className="w-3 h-3 mr-1" />
                              WhatsApp Sent
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div>
                          <p><strong>Customer:</strong> {order.customerName}</p>
                          <p><strong>Phone:</strong> {order.customerPhone}</p>
                        </div>
                        <div>
                          <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
                          <p><strong>Status:</strong> {order.status}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {orders.length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg mb-2">No Orders Yet</p>
                        <p className="text-muted-foreground">
                          Orders will appear here when customers make purchases
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}