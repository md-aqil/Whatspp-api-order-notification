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
  Plus,
  ExternalLink,
  ShoppingBag,
  Users,
  Calendar,
  Eye,
  Trash,
  Edit,
  Sparkles,
  MessageSquare,
  Package,
  Send,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export default function DashboardPage() {
  const [integrations, setIntegrations] = useState({
    whatsapp: { connected: false, data: {} },
    shopify: { connected: false, data: {} },
    stripe: { connected: false, data: {} }
  })
  
  const [loading, setLoading] = useState(false)

  // Load integrations status on mount
  useEffect(() => {
    loadIntegrations()
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

  return (
    <div>
      <Toaster />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Commerce Hub Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your integrations
          </p>
        </div>

        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="integrations">
              <Settings className="w-4 h-4 mr-2" />
              Integrations
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
        </Tabs>
      </div>
    </div>
  )
}