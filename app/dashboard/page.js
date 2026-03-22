'use client'

import { useEffect, useMemo, useState } from 'react'
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
  AlertCircle,
  BookOpen,
  HelpCircle
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
      const payload = await response.json()
      
      if (response.ok) {
        await loadIntegrations()
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} integration saved successfully!`)
        if (payload.warning) {
          toast.warning(payload.warning)
        }
        if (type === 'shopify') {
          // Setup Shopify webhooks
          setupShopifyWebhooks()
        }
      } else {
        toast.error(payload.error || 'Failed to save integration')
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
    const [copiedField, setCopiedField] = useState('')

    useEffect(() => {
      setFormData(integration.data || {})
    }, [integration])

    const webhookUrl = useMemo(() => {
      if (typeof window === 'undefined') return ''
      return `${window.location.origin}/api/webhook/whatsapp`
    }, [])

    const generateVerifyToken = () => {
      const token = `wa_verify_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      setFormData((prev) => ({ ...prev, webhookVerifyToken: token }))
    }

    const copyValue = async (value, fieldKey) => {
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        setCopiedField(fieldKey)
        setTimeout(() => setCopiedField((current) => (current === fieldKey ? '' : current)), 1500)
      } catch (error) {
        console.error(`Failed to copy ${fieldKey}:`, error)
        toast.error('Failed to copy value')
      }
    }

    const handleSubmit = (e) => {
      e.preventDefault()
      saveIntegration(type, formData)
    }

    const getFields = () => {
      switch (type) {
        case 'whatsapp':
          return [
            { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '818391834688215' },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Paste the raw Meta access token', type: 'password' },
            { key: 'businessAccountId', label: 'Business Account ID', placeholder: '832073532824981' },
            { key: 'catalogId', label: 'Meta Catalog ID', placeholder: 'Your Commerce Manager catalog ID' },
            { key: 'webhookVerifyToken', label: 'Webhook Verify Token', placeholder: 'your_verify_token' }
          ]
        case 'shopify':
          return [
            { key: 'shopDomain', label: 'Shop Domain', placeholder: 'your-shop.myshopify.com' },
            { key: 'clientId', label: 'Client ID', placeholder: 'Shopify app client ID' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'Shopify app client secret', type: 'password' }
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
        {type === 'whatsapp' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Webhook Endpoint</div>
                <p className="mt-1 break-all text-xs text-slate-600">{webhookUrl || 'Open this page in the browser to see the webhook URL.'}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => copyValue(webhookUrl, 'webhookUrl')} disabled={!webhookUrl}>
                {copiedField === 'webhookUrl' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {getFields().map(field => (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {type === 'whatsapp' && field.key === 'webhookVerifyToken' && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={generateVerifyToken}>
                    Generate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyValue(formData[field.key] || '', field.key)}
                    disabled={!formData[field.key]}
                  >
                    {copiedField === field.key ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
              {type === 'whatsapp' && field.key === 'catalogId' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyValue(formData[field.key] || '', field.key)}
                  disabled={!formData[field.key]}
                >
                  {copiedField === field.key ? 'Copied' : 'Copy'}
                </Button>
              )}
            </div>
            <Input
              id={field.key}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              value={formData[field.key] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
              required={!(type === 'whatsapp' && (field.key === 'catalogId' || field.key === 'webhookVerifyToken'))}
            />
            {type === 'shopify' && field.key === 'shopDomain' && (
              <p className="text-xs text-gray-500">
                Find this in your Shopify Admin URL or store settings. Example:
                <span className="ml-1 font-medium text-gray-700">your-store.myshopify.com</span>
              </p>
            )}
            {type === 'shopify' && field.key === 'clientId' && (
              <p className="text-xs text-gray-500">
                Shopify Dev Dashboard → your app → Settings → Credentials → Client ID.
              </p>
            )}
            {type === 'shopify' && field.key === 'clientSecret' && (
              <p className="text-xs text-gray-500">
                Shopify Dev Dashboard → your app → Settings → Credentials → Secret.
                Do not share this or paste it into frontend code.
              </p>
            )}
            {type === 'whatsapp' && field.key === 'catalogId' && (
              <p className="text-xs text-gray-500">
                Use the actual product Catalog ID from Commerce Manager. Do not paste your Phone Number ID or Business Account ID here.
              </p>
            )}
            {type === 'whatsapp' && field.key === 'accessToken' && (
              <p className="text-xs text-gray-500">
                Paste only the raw Meta access token. Do not include the <span className="font-medium text-gray-700">Bearer</span> prefix or surrounding quotes.
              </p>
            )}
            {type === 'whatsapp' && field.key === 'webhookVerifyToken' && (
              <p className="text-xs text-gray-500">
                This is your own verification secret for Meta webhook setup. Generate one here, save it, then paste the same value into Meta webhook configuration. If a token already exists in your environment, it is shown here automatically.
              </p>
            )}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Commerce Hub Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your integrations
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="https://developers.facebook.com/docs/whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              WhatsApp Docs
            </a>
          </div>
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
            {/* Quick Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-blue-800">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Getting Started - Complete Setup Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 text-sm">
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-gray-700 flex items-center mb-2">
                      <Settings className="w-4 h-4 mr-1" /> Database
                    </h4>
                    <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
                      <li>Install PostgreSQL</li>
                      <li>Create database: <code className="bg-gray-100 px-1">whatsapp_api</code></li>
                      <li>Update .env with credentials</li>
                      <li>Run: <code className="bg-gray-100 px-1">node setup-postgres-tables.js</code></li>
                    </ol>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-green-700 flex items-center mb-2">
                      <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                    </h4>
                    <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 hover:underline">developers.facebook.com</a></li>
                      <li>Create App → WhatsApp product</li>
                      <li>Get Phone Number ID & Business Account ID</li>
                      <li>Generate Access Token</li>
                    </ol>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-blue-700 flex items-center mb-2">
                      <Store className="w-4 h-4 mr-1" /> Shopify
                    </h4>
                    <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
                      <li>Go to Shopify Admin → Settings → Apps</li>
                      <li>Create Private App</li>
                      <li>Configure Admin API scopes</li>
                      <li>Copy Access Token & API Keys</li>
                    </ol>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <h4 className="font-semibold text-purple-700 flex items-center mb-2">
                      <CreditCard className="w-4 h-4 mr-1" /> Stripe
                    </h4>
                    <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://dashboard.stripe.com" target="_blank" className="text-blue-600 hover:underline">dashboard.stripe.com</a></li>
                      <li>Get API Keys (Test mode)</li>
                      <li>Create Webhook endpoint</li>
                      <li>Copy Webhook Secret</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <strong>Where to get:</strong><br/>
                    <a href="https://developers.facebook.com/apps" target="_blank" className="text-blue-600 hover:underline">Meta Developer Portal</a> → Your App → WhatsApp
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
                    Connect your Shopify store using Shopify&apos;s client credentials grant flow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    {getStatusBadge(integrations.shopify.connected)}
                  </div>
                  <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <strong>Where to get:</strong><br/>
                    Shopify Dev Dashboard → your app → Settings → Credentials
                  </div>
                  <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                    This app uses Shopify&apos;s client credentials flow:
                    <br />
                    1. Your shop domain, like <code className="bg-white px-1">your-store.myshopify.com</code>
                    <br />
                    2. Your app Client ID
                    <br />
                    3. Your app Client Secret
                    <br />
                    Where to find them:
                    <br />
                    Domain: copy the <code className="bg-white px-1">*.myshopify.com</code> part from your Shopify admin URL.
                    <br />
                    Client credentials: Shopify Dev Dashboard → open app → Settings → Credentials.
                    <br />
                    The server exchanges these credentials for a 24-hour Shopify Admin API token automatically.
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
                  <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <strong>Where to get:</strong><br/>
                    <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" className="text-blue-600 hover:underline">Stripe Dashboard</a> → Developers → API Keys & Webhooks
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
