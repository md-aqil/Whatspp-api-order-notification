'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  AlertCircle, 
  CheckCircle, 
  Copy, 
  Eye, 
  EyeOff,
  Save
} from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState({
    whatsapp: {
      connected: false,
      phoneNumberId: '',
      accessToken: '',
      businessAccountId: ''
    },
    shopify: {
      connected: false,
      shopDomain: '',
      accessToken: ''
    },
    stripe: {
      connected: false,
      secretKey: '',
      publishableKey: ''
    }
  })
  
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/integrations')
        if (response.ok) {
          const data = await response.json()
          setIntegrations({
            whatsapp: {
              connected: data.whatsapp.connected,
              phoneNumberId: data.whatsapp.data.phoneNumberId || '',
              accessToken: '', // Don't load sensitive data
              businessAccountId: data.whatsapp.data.businessAccountId || ''
            },
            shopify: {
              connected: data.shopify.connected,
              shopDomain: data.shopify.data.shopDomain || '',
              accessToken: '' // Don't load sensitive data
            },
            stripe: {
              connected: data.stripe.connected,
              secretKey: '', // Don't load sensitive data
              publishableKey: data.stripe.data.publishableKey || ''
            }
          })
        }
      } catch (error) {
        console.error('Failed to load integrations:', error)
      } finally {
        setLoading(false)
      }
    }

    loadIntegrations()
  }, [])

  const handleSaveIntegration = async (type) => {
    try {
      setLoading(true)
      const integrationData = integrations[type]
      
      // Remove empty fields
      const dataToSave = Object.fromEntries(
        Object.entries(integrationData).filter(([_, value]) => value !== '')
      )
      
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: dataToSave })
      })
      
      if (response.ok) {
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} integration saved successfully!`)
        // Update the connected status
        setIntegrations(prev => ({
          ...prev,
          [type]: {
            ...prev[type],
            connected: true
          }
        }))
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const updateIntegrationField = (type, field, value) => {
    setIntegrations(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your integrations and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WhatsApp Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${integrations.whatsapp.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              WhatsApp Business
            </CardTitle>
            <CardDescription>
              Connect your WhatsApp Business account to send and receive messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input
                id="phoneNumberId"
                value={integrations.whatsapp.phoneNumberId}
                onChange={(e) => updateIntegrationField('whatsapp', 'phoneNumberId', e.target.value)}
                placeholder="Your WhatsApp Phone Number ID"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showAccessToken ? "text" : "password"}
                  value={integrations.whatsapp.accessToken}
                  onChange={(e) => updateIntegrationField('whatsapp', 'accessToken', e.target.value)}
                  placeholder="Your WhatsApp Access Token"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                >
                  {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessAccountId">Business Account ID</Label>
              <Input
                id="businessAccountId"
                value={integrations.whatsapp.businessAccountId}
                onChange={(e) => updateIntegrationField('whatsapp', 'businessAccountId', e.target.value)}
                placeholder="Your WhatsApp Business Account ID"
              />
            </div>
            
            <Button 
              onClick={() => handleSaveIntegration('whatsapp')}
              disabled={loading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {integrations.whatsapp.connected ? 'Update Connection' : 'Connect WhatsApp'}
            </Button>
          </CardContent>
        </Card>

        {/* Shopify Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${integrations.shopify.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              Shopify
            </CardTitle>
            <CardDescription>
              Connect your Shopify store to sync products and orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopDomain">Shop Domain</Label>
              <Input
                id="shopDomain"
                value={integrations.shopify.shopDomain}
                onChange={(e) => updateIntegrationField('shopify', 'shopDomain', e.target.value)}
                placeholder="your-shop.myshopify.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="shopifyAccessToken">Access Token</Label>
              <div className="relative">
                <Input
                  id="shopifyAccessToken"
                  type="password"
                  value={integrations.shopify.accessToken}
                  onChange={(e) => updateIntegrationField('shopify', 'accessToken', e.target.value)}
                  placeholder="Your Shopify Access Token"
                />
              </div>
            </div>
            
            <Button 
              onClick={() => handleSaveIntegration('shopify')}
              disabled={loading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {integrations.shopify.connected ? 'Update Connection' : 'Connect Shopify'}
            </Button>
          </CardContent>
        </Card>

        {/* Stripe Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${integrations.stripe.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              Stripe
            </CardTitle>
            <CardDescription>
              Connect your Stripe account to process payments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="publishableKey">Publishable Key</Label>
              <Input
                id="publishableKey"
                value={integrations.stripe.publishableKey}
                onChange={(e) => updateIntegrationField('stripe', 'publishableKey', e.target.value)}
                placeholder="pk_test_..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <div className="relative">
                <Input
                  id="secretKey"
                  type={showSecretKey ? "text" : "password"}
                  value={integrations.stripe.secretKey}
                  onChange={(e) => updateIntegrationField('stripe', 'secretKey', e.target.value)}
                  placeholder="sk_test_..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button 
              onClick={() => handleSaveIntegration('stripe')}
              disabled={loading}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {integrations.stripe.connected ? 'Update Connection' : 'Connect Stripe'}
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Information */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook URLs</CardTitle>
            <CardDescription>
              Configure these URLs in your service providers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>WhatsApp Webhook URL</Label>
              <div className="flex">
                <Input
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/whatsapp`}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="ml-2"
                  onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/whatsapp`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Shopify Webhook URL</Label>
              <div className="flex">
                <Input
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/shopify`}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="ml-2"
                  onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/shopify`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Important</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Make sure to configure webhooks in your service providers with the URLs above.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}