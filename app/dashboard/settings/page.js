'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  MessageCircle,
  Store,
  CreditCard,
  Settings,
  Monitor,
  ChevronDown,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState('unknown')
  const [shopifyStatus, setShopifyStatus] = useState('unknown')
  const [lastWebhook, setLastWebhook] = useState(null)
  const [checking, setChecking] = useState(false)
  const [shopifyWebhooks, setShopifyWebhooks] = useState([])
  const [expandedWebhook, setExpandedWebhook] = useState(null)
  const [expandedIntegration, setExpandedIntegration] = useState(null)

  const toggleWebhook = (type) => {
    setExpandedWebhook(expandedWebhook === type ? null : type);
  };

  const toggleIntegration = (type) => {
    setExpandedIntegration(expandedIntegration === type ? null : type);
  };

  // Available Shopify webhook topics
  const shopifyWebhookTopics = [
    { topic: 'orders/create', label: 'Order Created' },
    { topic: 'orders/updated', label: 'Order Updated' },
    { topic: 'orders/paid', label: 'Order Paid' },
    { topic: 'orders/fulfilled', label: 'Order Fulfilled' },
    { topic: 'orders/cancelled', label: 'Order Cancelled' },
    { topic: 'orders/delivered', label: 'Order Delivered' },
    { topic: 'customers/create', label: 'Customer Created' },
    { topic: 'customers/update', label: 'Customer Updated' },
  ]

  const [customWebhookStatus, setCustomWebhookStatus] = useState(null)

  // Integration state
  const [integrations, setIntegrations] = useState({
    whatsapp: { connected: false, data: {} },
    shopify: { connected: false, data: {} },
    stripe: { connected: false, data: {} }
  })

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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lcsw.dpdns.org'

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

      // Fetch registered Shopify webhooks
      try {
        const webhooksRes = await fetch(`${baseUrl}/api/webhooks?type=shopify`)
        if (webhooksRes.ok) {
          const webhooksData = await webhooksRes.json()
          setShopifyWebhooks(webhooksData.webhooks || [])
        }
      } catch (e) {
        console.log('No webhooks found')
        setShopifyWebhooks([])
      }

      // Fetch custom webhook status
      try {
        const customRes = await fetch(`${baseUrl}/api/webhook/custom`)
        if (customRes.ok) {
          const customData = await customRes.json()
          setCustomWebhookStatus(customData)
        }
      } catch (e) {
        console.log('Custom webhook fetch error:', e)
        setCustomWebhookStatus(null)
      }

      // Fetch WordPress plugin config (woocommerce triggers & custom tables)
      try {
        const waConfigRes = await fetch(`${baseUrl}/api/wa-config`, { cache: 'no-store' })
        if (waConfigRes.ok) {
          const waConfig = await waConfigRes.json()
          // Set WooCommerce triggers from plugin
          if (waConfig?.woocommerce?.triggers) {
            setWoocommerceTriggers(waConfig.woocommerce.triggers)
          }
          // Set custom tables from plugin
          if (waConfig?.custom_tables?.tables) {
            setCustomTables(waConfig.custom_tables.tables)
          }
        }
      } catch (e) {
        console.log('wa-config fetch error:', e)
      }

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
    <div className="p-8 mx-auto space-y-12 bg-[#f8f9ff] text-[#05345c] min-h-screen">
      {/* Bento Layout Content */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* Health Dashboard */}
          <div className="bg-white p-6 rounded-xl shadow-sm border-none ring-1 ring-black/[0.03]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#3d618c] mb-6 flex items-center gap-2">
              <Monitor className="text-[#005cc0] w-4 h-4" />
              Workspace Health
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>API Request Limit</span>
                  <span className="text-[#005cc0]">12.4K / 50K</span>
                </div>
                <div className="h-2 w-full bg-[#e5eeff] rounded-full overflow-hidden">
                  <div className="h-full bg-[#005cc0] rounded-full" style={{ width: '24.8%' }}></div>
                </div>
                <p className="text-[10px] text-[#3d618c]">Resets in 12 days</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-[#eff4ff] rounded-lg text-center">
                  <div className="text-2xl font-black">18</div>
                  <div className="text-[10px] uppercase font-bold text-[#3d618c] mt-1">Active Hooks</div>
                </div>
                <div className="p-4 bg-[#eff4ff] rounded-lg text-center">
                  <div className="text-2xl font-black">99.9%</div>
                  <div className="text-[10px] uppercase font-bold text-[#3d618c] mt-1">Uptime</div>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-[#eff4ff] p-6 rounded-xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#3d618c] flex items-center gap-2">
              <Settings className="text-[#005cc0] w-4 h-4" />
              App Preferences
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Dark Mode</span>
                <button className="w-10 h-6 bg-[#d2e4ff] rounded-full relative p-1 transition-colors">
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Instant Notifications</span>
                <button className="w-10 h-6 bg-[#005cc0] rounded-full relative p-1 flex justify-end transition-colors">
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </button>
              </div>
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold text-[#3d618c] uppercase">Language</label>
                <div className="w-full bg-white px-3 py-2 rounded-lg border-none flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium">English (US)</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Integrations */}
          <div className="bg-white p-8 rounded-xl shadow-sm border-none ring-1 ring-black/[0.03]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold font-headline">Service Integrations</h3>
              <button className="text-[#005cc0] text-sm font-bold hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* WhatsApp */}
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex flex-col gap-4 cursor-pointer">
                    <div className={`p-5 rounded-xl transition-colors group bg-[#f8f9ff] hover:bg-[#eff4ff]`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                          <MessageCircle className="text-green-600 w-5 h-5" />
                        </div>
                        {integrations.whatsapp.connected ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase">Connected</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">Inactive</span>
                        )}
                      </div>
                      <h4 className="font-bold mb-1">WhatsApp</h4>
                      <p className="text-[11px] text-[#3d618c] mb-4">Business API</p>
                      <div className="w-full py-2 rounded-lg bg-[#e5eeff] text-[#005cc0] font-bold text-xs hover:bg-[#005cc0] hover:text-white transition-all text-center">Configure</div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>WhatsApp Configuration</DialogTitle>
                    <DialogDescription>Configure your WhatsApp Business API integration</DialogDescription>
                  </DialogHeader>
                  <IntegrationForm type="whatsapp" integration={integrations.whatsapp} />
                </DialogContent>
              </Dialog>

              {/* Shopify */}
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex flex-col gap-4 cursor-pointer">
                    <div className={`p-5 rounded-xl transition-colors group ${integrations.shopify.connected ? 'border-2 border-dashed border-[#005cc0]/20 bg-[#f8f9ff]' : 'bg-[#f8f9ff] hover:bg-[#eff4ff]'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Store className="text-[#005cc0] w-5 h-5" />
                        </div>
                        {integrations.shopify.connected ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase">Connected</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">Inactive</span>
                        )}
                      </div>
                      <h4 className="font-bold mb-1">Shopify</h4>
                      <p className="text-[11px] text-[#3d618c] mb-4">eCommerce Sync</p>
                      <div className="w-full py-2 rounded-lg bg-[#e5eeff] text-[#005cc0] font-bold text-xs hover:bg-[#005cc0] hover:text-white transition-all text-center">Manage</div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Shopify Configuration</DialogTitle>
                    <DialogDescription>Manage your Shopify eCommerce integration</DialogDescription>
                  </DialogHeader>
                  <IntegrationForm type="shopify" integration={integrations.shopify} />
                </DialogContent>
              </Dialog>

              {/* Stripe */}
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex flex-col gap-4 cursor-pointer">
                    <div className={`p-5 rounded-xl transition-colors group bg-[#f8f9ff] hover:bg-[#eff4ff]`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                          <CreditCard className="text-[#3d618c] w-5 h-5" />
                        </div>
                        {integrations.stripe.connected ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase">Connected</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">Inactive</span>
                        )}
                      </div>
                      <h4 className="font-bold mb-1">Stripe</h4>
                      <p className="text-[11px] text-[#3d618c] mb-4">Payment Processing</p>
                      <div className="w-full py-2 rounded-lg bg-[#e5eeff] text-[#005cc0] font-bold text-xs hover:bg-[#005cc0] hover:text-white transition-all text-center">Connect</div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Stripe Configuration</DialogTitle>
                    <DialogDescription>Connect your Stripe payment processing account</DialogDescription>
                  </DialogHeader>
                  <IntegrationForm type="stripe" integration={integrations.stripe} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Webhooks */}
          <div className="bg-white p-8 rounded-xl shadow-sm border-none ring-1 ring-black/[0.03]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold font-headline">Registered Webhooks</h3>
              <div className="flex gap-2">
                <button onClick={checkWebhookStatus} disabled={checking} className="bg-[#eff4ff] hover:bg-[#dce9ff] px-3 py-2 rounded-lg text-sm font-bold transition-colors">
                  <RefreshCw className={`w-4 h-4 text-[#005cc0] ${checking ? 'animate-spin' : ''}`} />
                </button>
                <button className="bg-[#eff4ff] hover:bg-[#dce9ff] px-4 py-2 rounded-lg text-sm font-bold text-[#005cc0] transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Webhook
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {/* WhatsApp Webhook */}
              <div className="border border-[#e5eeff] rounded-xl overflow-hidden transition-all duration-200">
                <div onClick={() => toggleWebhook('whatsapp')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${whatsappStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : whatsappStatus === 'error' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold">WhatsApp Webhook</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#e4ceff] text-[#53436c] uppercase">System</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{`${baseUrl}/api/webhook/whatsapp`}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] font-bold text-[#3d618c] uppercase">Status</div>
                      <div className="text-xs font-semibold capitalize">{whatsappStatus}</div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'whatsapp' ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {expandedWebhook === 'whatsapp' && (
                  <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold mb-2">Configure URL in Meta App</p>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={`${baseUrl}/api/webhook/whatsapp`} className="w-[300px] bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/webhook/whatsapp`)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                    {lastWebhook && lastWebhook.type === 'whatsapp' && (
                      <div className="mt-4 p-3 bg-white border border-[#e5eeff] rounded-lg text-xs">
                        <p className="font-semibold mb-1 flex items-center gap-2"><Clock className="w-3 h-3" /> Last Received</p>
                        <p className="text-[#3d618c]">{new Date(lastWebhook.receivedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shopify Webhook */}
              <div className="border border-[#e5eeff] rounded-xl overflow-hidden transition-all duration-200">
                <div onClick={() => toggleWebhook('shopify')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${shopifyStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : shopifyStatus === 'error' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold">Shopify Webhook</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#d2e4ff] text-[#005cc0] uppercase">eCommerce</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{`${baseUrl}/api/webhook/shopify`}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] font-bold text-[#3d618c] uppercase">Status</div>
                      <div className="text-xs font-semibold capitalize">{shopifyStatus}</div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'shopify' ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {expandedWebhook === 'shopify' && (
                  <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-semibold mb-2">Configure URL in Shopify App</p>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={`${baseUrl}/api/webhook/shopify`} className="w-[300px] bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/webhook/shopify`)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-xs text-[#3d618c] uppercase">Registered Topics</p>
                      <div className="grid grid-cols-2 gap-2">
                        {shopifyWebhookTopics.map((wh) => {
                          const isRegistered = shopifyWebhooks.some(sw => sw.topic === wh.topic)
                          return (
                            <div key={wh.topic} className="flex justify-between p-2 bg-white rounded border border-[#e5eeff]">
                              <span className="text-xs font-medium">{wh.label}</span>
                              <span className={`text-[10px] flex items-center font-semibold ${isRegistered ? 'text-green-600' : 'text-gray-400'}`}>
                                {isRegistered ? <><CheckCircle className="w-3 h-3 mr-1" /> Active</> : <><AlertCircle className="w-3 h-3 mr-1" /> Not set</>}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {lastWebhook && lastWebhook.type === 'shopify' && (
                      <div className="mt-4 p-3 bg-white border border-[#e5eeff] rounded-lg text-xs">
                        <p className="font-semibold mb-1 flex items-center gap-2"><Clock className="w-3 h-3" /> Last Received</p>
                        <p className="text-[#3d618c]">{new Date(lastWebhook.receivedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Webhook */}
              <div className="border border-[#e5eeff] rounded-xl overflow-hidden transition-all duration-200">
                <div onClick={() => toggleWebhook('custom')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${customWebhookStatus?.status === 'ready' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold">Custom Webhook</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#e4ceff] text-[#53436c] uppercase">WordPress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/custom`}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] font-bold text-[#3d618c] uppercase">Status</div>
                      <div className="text-xs font-semibold capitalize">{customWebhookStatus?.status === 'ready' ? 'Active' : 'Inactive'}</div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'custom' ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {expandedWebhook === 'custom' && (
                  <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-semibold mb-2">Configure in WordPress Plugin</p>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/custom`} className="w-[350px] bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/custom`)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* WooCommerce Triggers from Plugin */}
                    {woocommerceTriggers && woocommerceTriggers.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="font-semibold text-xs text-[#3d618c] uppercase">WooCommerce Triggers (from Plugin)</p>
                        <div className="grid grid-cols-2 gap-2">
                          {woocommerceTriggers.map((trigger, idx) => (
                            <div key={idx} className="flex justify-between p-2 bg-white rounded border border-[#e5eeff]">
                              <span className="text-xs font-medium">{trigger.label}</span>
                              <span className="text-[10px] flex items-center font-semibold text-green-600">
                                <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Tables from Plugin */}
                    {customTables && customTables.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-semibold text-xs text-[#3d618c] uppercase">Custom Tables (from Plugin)</p>
                        <div className="grid grid-cols-2 gap-2">
                          {customTables.map((table, idx) => (
                            <div key={idx} className="flex justify-between p-2 bg-white rounded border border-[#e5eeff]">
                              <span className="text-xs font-medium">{table.name}</span>
                              {table.label && <span className="text-[10px] text-gray-500">{table.label}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!woocommerceTriggers || woocommerceTriggers.length === 0) && (!customTables || customTables.length === 0) && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                        <p className="font-semibold flex items-center gap-2"><AlertCircle className="w-3 h-3" /> No triggers configured</p>
                        <p className="mt-1">Configure triggers in the WordPress plugin to receive webhooks.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div >
  )
}

// Integration Form Component
function IntegrationForm({ type, integration, loading }) {
  const [formData, setFormData] = useState(integration.data || {})
  const [copiedField, setCopiedField] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFormData(integration.data || {})
  }, [integration])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveIntegration(type, formData)
    } finally {
      setSaving(false)
    }
  }

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
        </div>
      ))}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving...' : 'Save Integration'}
      </Button>
    </form>
  )
}

// Helper function to copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
  if (typeof window !== 'undefined') {
    window.alert('Copied to clipboard!')
  }
}
