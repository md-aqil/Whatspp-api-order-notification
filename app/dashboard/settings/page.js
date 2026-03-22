'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState('unknown')
  const [shopifyStatus, setShopifyStatus] = useState('unknown')
  const [lastWebhook, setLastWebhook] = useState(null)
  const [checking, setChecking] = useState(false)

  // WordPress/WooCommerce config state
  const [wpUrl, setWpUrl] = useState('')
  const [woocommerceTriggers, setWoocommerceTriggers] = useState([])
  const [customTables, setCustomTables] = useState([])
  const [savingConfig, setSavingConfig] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)

  // Load existing config on mount
  // Load existing config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        // Add timestamp to prevent caching
        const res = await fetch(`/api/wa-config?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        const data = await res.json()
        if (data && data.wordpress_url !== undefined) {
          setWpUrl(data.wordpress_url || '')
          setWoocommerceTriggers(data.woocommerce?.triggers || [])
          setCustomTables(data.custom_tables?.tables || [])
          setConfigLoaded(true)
        }
      } catch (e) {
        console.log('No config loaded yet:', e)
      }
    }
    loadConfig()
  }, [])

  // Save WooCommerce configuration
  const saveWooConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/wa-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordpress_url: wpUrl,
          woocommerce_triggers: woocommerceTriggers,
          custom_tables: customTables
        })
      })
      if (res.ok) {
        toast.success('WooCommerce configuration saved!')
      } else {
        toast.error('Failed to save configuration')
      }
    } catch (e) {
      toast.error('Error saving configuration')
    }
    setSavingConfig(false)
  }

  // Add a new WooCommerce trigger
  const addWooTrigger = () => {
    setWoocommerceTriggers([...woocommerceTriggers, {
      name: 'new_trigger',
      label: 'New Trigger',
      value: '',
      description: 'Custom trigger'
    }])
  }

  // Update a trigger
  const updateTrigger = (index, field, value) => {
    const updated = [...woocommerceTriggers]
    updated[index][field] = value
    // Auto-generate value from name
    if (field === 'name') {
      updated[index].value = `woocommerce.${value.toLowerCase().replace(/\s+/g, '_')}`
    }
    setWoocommerceTriggers(updated)
  }

  // Remove a trigger
  const removeTrigger = (index) => {
    setWoocommerceTriggers(woocommerceTriggers.filter((_, i) => i !== index))
  }

  // Add a new custom table
  const addCustomTable = () => {
    setCustomTables([...customTables, {
      name: 'wp_custom_table',
      label: 'Custom Table',
      columns: []
    }])
  }

  // Update a table
  const updateTable = (index, field, value) => {
    const updated = [...customTables]
    updated[index][field] = value
    setCustomTables(updated)
  }

  // Remove a table
  const removeTable = (index) => {
    setCustomTables(customTables.filter((_, i) => i !== index))
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Check webhook connectivity
  const checkWebhookStatus = async () => {
    setChecking(true)
    try {
      // Check WhatsApp webhook
      const waResponse = await fetch(`${baseUrl}/api/webhook/whatsapp`, {
        method: 'GET',
        cache: 'no-cache'
      })
      setWhatsappStatus(waResponse.ok || waResponse.status === 200 ? 'connected' : 'error')

      // Check Shopify webhook
      const shResponse = await fetch(`${baseUrl}/api/webhook/shopify`, {
        method: 'GET',
        cache: 'no-cache'
      })
      setShopifyStatus(shResponse.ok || shResponse.status === 200 ? 'connected' : 'error')

      // Fetch last webhook log
      try {
        const logsResponse = await fetch(`${baseUrl}/api/webhook-logs?limit=1`)
        if (logsResponse.ok) {
          const data = await logsResponse.json()
          if (data.logs && data.logs.length > 0) {
            setLastWebhook(data.logs[0])
          }
        }
      } catch (e) {
        console.log('No webhook logs available')
      }
    } catch (error) {
      console.error('Error checking webhook status:', error)
      setWhatsappStatus('error')
      setShopifyStatus('error')
    }
    setChecking(false)
  }

  useEffect(() => {
    checkWebhookStatus()
    // Check every 30 seconds
    const interval = setInterval(checkWebhookStatus, 30000)
    return () => clearInterval(interval)
  }, [baseUrl])

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
          Configure your integrations and automation settings
        </p>
      </div>

      <Tabs defaultValue="webhooks" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Webhooks
          </TabsTrigger>
        </TabsList>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Webhook Status
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkWebhookStatus}
                  disabled={checking}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking...' : 'Refresh'}
                </Button>
              </CardTitle>
              <CardDescription>
                Monitor your webhook connection status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* WhatsApp Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${whatsappStatus === 'connected' ? 'bg-green-100' :
                    whatsappStatus === 'error' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                    {whatsappStatus === 'connected' ? (
                      <Wifi className="h-5 w-5 text-green-600" />
                    ) : whatsappStatus === 'error' ? (
                      <WifiOff className="h-5 w-5 text-red-600" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">WhatsApp Webhook</p>
                    <p className="text-sm text-gray-500">https://lcsw.dpdns.org/api/webhook/whatsapp</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${whatsappStatus === 'connected' ? 'bg-green-100 text-green-800' :
                  whatsappStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {whatsappStatus === 'connected' ? 'Connected' :
                    whatsappStatus === 'error' ? 'Error' : 'Checking...'}
                </div>
              </div>

              {/* Shopify Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${shopifyStatus === 'connected' ? 'bg-green-100' :
                    shopifyStatus === 'error' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                    {shopifyStatus === 'connected' ? (
                      <Wifi className="h-5 w-5 text-green-600" />
                    ) : shopifyStatus === 'error' ? (
                      <WifiOff className="h-5 w-5 text-red-600" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Shopify Webhook</p>
                    <p className="text-sm text-gray-500">https://lcsw.dpdns.org/api/webhook/shopify</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${shopifyStatus === 'connected' ? 'bg-green-100 text-green-800' :
                  shopifyStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {shopifyStatus === 'connected' ? 'Connected' :
                    shopifyStatus === 'error' ? 'Error' : 'Checking...'}
                </div>
              </div>

              {/* Last Webhook Received */}
              {lastWebhook && (
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Last Webhook Received</span>
                  </div>
                  <div className="text-sm">
                    <p><span className="font-medium">Type:</span> {lastWebhook.type}</p>
                    {lastWebhook.topic && <p><span className="font-medium">Topic:</span> {lastWebhook.topic}</p>}
                    <p><span className="font-medium">Time:</span> {new Date(lastWebhook.receivedAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook URLs */}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper function to copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
  if (typeof window !== 'undefined') {
    window.alert('Copied to clipboard!')
  }
}
