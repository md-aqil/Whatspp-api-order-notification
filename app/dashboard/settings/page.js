'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Clock,
  MessageCircle,
  Store,
  CreditCard,
  Settings,
  Monitor,
  ChevronDown,
  Plus,
  Trash2
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState('unknown')
  const [shopifyStatus, setShopifyStatus] = useState('unknown')
  const [lastWebhook, setLastWebhook] = useState(null)
  const [lastCustomWebhook, setLastCustomWebhook] = useState(null)
  const [checking, setChecking] = useState(false)
  const [shopifyWebhooks, setShopifyWebhooks] = useState([])
  const [expandedWebhook, setExpandedWebhook] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [baseUrl, setBaseUrl] = useState(process.env.NEXT_PUBLIC_BASE_URL || '')

  const toggleWebhook = (type) => {
    setExpandedWebhook(expandedWebhook === type ? null : type)
  }

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

  useEffect(() => {
    setMounted(true)

    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  // Registered webhooks state (user-added)
  const [registeredWebhooks, setRegisteredWebhooks] = useState([])
  const [addWebhookOpen, setAddWebhookOpen] = useState(false)
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    target_url: '',
    event_types: [],
    secret_key: ''
  })

  // Load registered webhooks
  const loadRegisteredWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks/registered')
      if (response.ok) {
        const data = await response.json()
        setRegisteredWebhooks(data)
      }
    } catch (error) {
      console.error('Failed to load registered webhooks:', error)
    }
  }

  // Save new webhook
  const handleAddWebhook = async () => {
    if (!newWebhook.name || !newWebhook.target_url) {
      toast.error('Please fill in name and target URL')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/webhooks/registered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebhook)
      })

      if (response.ok) {
        toast.success('Webhook added successfully')
        setAddWebhookOpen(false)
        setNewWebhook({ name: '', target_url: '', event_types: [], secret_key: '' })
        loadRegisteredWebhooks()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add webhook')
      }
    } catch (error) {
      console.error('Failed to add webhook:', error)
      toast.error('Failed to add webhook')
    } finally {
      setLoading(false)
    }
  }

  // Delete webhook
  const handleDeleteWebhook = async (id) => {
    try {
      const response = await fetch(`/api/webhooks/registered?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Webhook deleted')
        loadRegisteredWebhooks()
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error)
      toast.error('Failed to delete webhook')
    }
  }

  // Load registered webhooks on mount
  useEffect(() => {
    loadRegisteredWebhooks()
  }, [])

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
  const [woocommerceTriggers, setWoocommerceTriggers] = useState([])
  const [customTables, setCustomTables] = useState([])

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
          setWoocommerceTriggers(data.woocommerce?.triggers || [])
          setCustomTables(data.custom_tables?.tables || [])
        }
      } catch (e) {
        console.log('No config loaded yet:', e)
      }
    }
    loadConfig()
  }, [])

  // Check webhook connectivity
  const checkWebhookStatus = async () => {
    setChecking(true)
    try {
      // Check WhatsApp webhook
      const waResponse = await fetch(`/api/webhook/whatsapp`, {
        method: 'GET',
        cache: 'no-cache'
      })
      setWhatsappStatus(waResponse.ok || waResponse.status === 200 ? 'connected' : 'error')

      // Check Shopify webhook
      const shResponse = await fetch(`/api/webhook/shopify`, {
        method: 'GET',
        cache: 'no-cache'
      })
      setShopifyStatus(shResponse.ok || shResponse.status === 200 ? 'connected' : 'error')

      // Fetch registered Shopify webhooks
      try {
        const webhooksRes = await fetch(`/api/webhooks?type=shopify`)
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
        const customRes = await fetch(`/api/webhook/custom`)
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
        const waConfigRes = await fetch(`/api/wa-config`, { cache: 'no-store' })
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

      // Fetch last webhook logs
      try {
        const logsResponse = await fetch(`/api/webhook-logs?limit=50`)
        if (logsResponse.ok) {
          const data = await logsResponse.json()
          if (data.logs && data.logs.length > 0) {
            // Find latest for each type
            const shopifyLog = data.logs.find(l => l.type === 'shopify')
            const whatsappLog = data.logs.find(l => l.type === 'whatsapp')
            const customLog = data.logs.find(l => l.type === 'custom')

            if (shopifyLog || whatsappLog) {
              setLastWebhook(shopifyLog || whatsappLog)
            }
            if (customLog) {
              setLastCustomWebhook(customLog)
            }
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

  const isDarkMode = mounted && theme === 'dark'
  const activeWebhookCount =
    registeredWebhooks.filter((webhook) => webhook.is_active).length +
    (whatsappStatus === 'connected' ? 1 : 0) +
    (shopifyStatus === 'connected' ? 1 : 0) +
    (customWebhookStatus?.status === 'ready' ? 1 : 0)

  const latestWordPressPayload = lastCustomWebhook?.payload || null
  const latestWordPressRows = useMemo(() => {
    if (!latestWordPressPayload || !lastCustomWebhook) return []

    const formatCurrencyValue = () => {
      if (!latestWordPressPayload.order_total) return ''
      const currency = latestWordPressPayload.currency || ''
      return `${currency}${latestWordPressPayload.order_total}`
    }

    return [
      { label: 'Event Type', value: lastCustomWebhook.topic || latestWordPressPayload.event || 'Unknown', tone: 'badge' },
      { label: 'Source', value: latestWordPressPayload?._site_info?.site_name || latestWordPressPayload.site_name || 'WordPress Plugin' },
      { label: 'Site ID', value: latestWordPressPayload?._site_info?.site_id || latestWordPressPayload.site_id || 'Not provided', monospace: true },
      { label: 'Site URL', value: latestWordPressPayload?._site_info?.site_url || latestWordPressPayload.site_url || 'Not provided', monospace: true },
      { label: 'Received At', value: lastCustomWebhook.receivedAt ? new Date(lastCustomWebhook.receivedAt).toLocaleString() : 'Unknown' },
      { label: 'Webhook Created At', value: latestWordPressPayload.created_at || 'Not provided' },
      { label: 'Order ID', value: latestWordPressPayload.order_id || 'Not provided', monospace: true },
      { label: 'Order Number', value: latestWordPressPayload.order_number || 'Not provided', monospace: true },
      { label: 'Order Status', value: latestWordPressPayload.order_status || 'Not provided' },
      { label: 'Customer', value: latestWordPressPayload.customer_name || 'Not provided' },
      { label: 'Phone', value: latestWordPressPayload.customer_phone || 'Not provided', monospace: true, missing: !latestWordPressPayload.customer_phone },
      { label: 'Email', value: latestWordPressPayload.customer_email || 'Not provided', monospace: true, missing: !latestWordPressPayload.customer_email },
      { label: 'Total', value: formatCurrencyValue() || 'Not provided', tone: 'success' },
      { label: 'Currency', value: latestWordPressPayload.currency || 'Not provided', monospace: true }
    ]
  }, [lastCustomWebhook, latestWordPressPayload])

  const latestWordPressRawPayload = useMemo(() => {
    if (!latestWordPressPayload) return ''
    return JSON.stringify(latestWordPressPayload, null, 2)
  }, [latestWordPressPayload])

  const buildWebhookUrl = (path) => {
    if (!baseUrl) return path
    return `${baseUrl}${path}`
  }

  const toggleDarkMode = () => {
    if (!mounted) return
    setTheme(isDarkMode ? 'light' : 'dark')
  }

  useEffect(() => {
    checkWebhookStatus()
    // Check every 30 seconds
    const interval = setInterval(checkWebhookStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="settings-scene p-8 mx-auto space-y-12 bg-[#f8f9ff] text-[#05345c] min-h-screen">
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
                  <div className="text-2xl font-black">{activeWebhookCount}</div>
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
                <button
                  type="button"
                  aria-pressed={isDarkMode}
                  onClick={toggleDarkMode}
                  className={`w-10 h-6 rounded-full relative p-1 transition-colors ${isDarkMode ? 'bg-[#005cc0] flex justify-end' : 'bg-[#d2e4ff]'}`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Instant Notifications</span>
                <button
                  type="button"
                  aria-pressed={notificationsEnabled}
                  onClick={() => setNotificationsEnabled((current) => !current)}
                  className={`w-10 h-6 rounded-full relative p-1 transition-colors ${notificationsEnabled ? 'bg-[#005cc0] flex justify-end' : 'bg-[#d2e4ff]'}`}
                >
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
              <div className="text-[#3d618c] text-sm font-semibold">{activeWebhookCount} active endpoints</div>
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
                  <IntegrationForm type="whatsapp" integration={integrations.whatsapp} onSave={saveIntegration} />
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
                  <IntegrationForm type="shopify" integration={integrations.shopify} onSave={saveIntegration} />
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
                  <IntegrationForm type="stripe" integration={integrations.stripe} onSave={saveIntegration} />
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
                <Dialog open={addWebhookOpen} onOpenChange={setAddWebhookOpen}>
                  <DialogTrigger asChild>
                    <button className="bg-[#eff4ff] hover:bg-[#dce9ff] px-4 py-2 rounded-lg text-sm font-bold text-[#005cc0] transition-colors flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add Webhook
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Webhook</DialogTitle>
                      <DialogDescription>
                        Configure a new webhook endpoint to receive notifications from external services.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="webhook-name">Webhook Name</Label>
                        <Input
                          id="webhook-name"
                          placeholder="My WooCommerce Store"
                          value={newWebhook.name}
                          onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="webhook-url">Target URL</Label>
                        <Input
                          id="webhook-url"
                          placeholder="https://your-site.com/webhook"
                          value={newWebhook.target_url}
                          onChange={(e) => setNewWebhook({ ...newWebhook, target_url: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="webhook-secret">Secret Key (Optional)</Label>
                        <Input
                          id="webhook-secret"
                          placeholder="Your webhook secret for verification"
                          value={newWebhook.secret_key}
                          onChange={(e) => setNewWebhook({ ...newWebhook, secret_key: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setAddWebhookOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddWebhook} disabled={loading}>
                        {loading ? 'Adding...' : 'Add Webhook'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
                      <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{buildWebhookUrl('/api/webhook/whatsapp')}</code>
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
                          <Input readOnly value={buildWebhookUrl('/api/webhook/whatsapp')} className="w-[300px] bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/whatsapp'))}>
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
                      <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{buildWebhookUrl('/api/webhook/shopify')}</code>
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
                          <Input readOnly value={buildWebhookUrl('/api/webhook/shopify')} className="w-[300px] bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/shopify'))}>
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
                      <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{buildWebhookUrl('/api/webhook/custom')}</code>
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
                          <Input readOnly value={buildWebhookUrl('/api/webhook/custom')} className="w-[350px] bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/custom'))}>
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

                    {lastCustomWebhook ? (
                      <div className="mt-6 pt-4 border-t border-[#e5eeff]">
                        <p className="font-semibold text-xs text-[#3d618c] uppercase mb-3 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> Latest activity from WordPress
                        </p>
                        <div className="bg-white p-4 rounded-xl border border-[#e5eeff] space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {latestWordPressRows.map((row) => (
                              <div key={row.label} className="flex justify-between items-center gap-4 text-xs bg-[#f8f9ff] rounded-lg px-3 py-2">
                                <span className="text-gray-500">{row.label}:</span>
                                {row.tone === 'badge' ? (
                                  <span className="font-bold text-[#005cc0] bg-[#eff4ff] px-2 py-0.5 rounded">{row.value}</span>
                                ) : (
                                  <span
                                    className={[
                                      'font-medium text-right',
                                      row.monospace ? 'font-mono text-[11px]' : '',
                                      row.tone === 'success' ? 'font-bold text-green-600' : '',
                                      row.missing ? 'text-amber-600' : ''
                                    ].join(' ')}
                                  >
                                    {row.value}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="rounded-xl border border-[#e5eeff] overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 bg-[#f8f9ff] border-b border-[#e5eeff]">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[#3d618c]">Raw Webhook Payload</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(latestWordPressRawPayload)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy JSON
                              </Button>
                            </div>
                            <pre className="max-h-72 overflow-auto p-3 text-[11px] leading-5 bg-[#05345c] text-[#dff3ff] whitespace-pre-wrap break-words">
                              {latestWordPressRawPayload}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 pt-4 border-t border-[#e5eeff]">
                        <p className="font-semibold text-xs text-[#3d618c] uppercase mb-3 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> Activity Log
                        </p>
                        <div className="bg-white/50 p-4 rounded-xl border border-dashed border-[#e5eeff] text-center">
                          <p className="text-xs text-gray-500">Waiting for your first WordPress activity...</p>
                          <p className="text-[10px] text-gray-400 mt-1">Place a test order in WooCommerce to see it here.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User-Registered Webhooks */}
              {registeredWebhooks && registeredWebhooks.length > 0 && (
                <>
                  {registeredWebhooks.map((webhook) => (
                    <div key={webhook.id} className="border border-[#e5eeff] rounded-xl overflow-hidden transition-all duration-200">
                      <div className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${webhook.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold">{webhook.name}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#d2e4ff] text-[#005cc0] uppercase">Custom</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-[#3d618c] truncate bg-[#eff4ff] px-2 py-0.5 rounded">{webhook.target_url}</code>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-[10px] font-bold text-[#3d618c] uppercase">Status</div>
                            <div className="text-xs font-semibold capitalize">{webhook.is_active ? 'Active' : 'Inactive'}</div>
                          </div>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete webhook"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {registeredWebhooks.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500 border border-dashed border-[#e5eeff] rounded-xl">
                  No custom webhooks added yet. Click "Add Webhook" to connect additional sites.
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div >
  )
}

// Integration Form Component
function IntegrationForm({ type, integration, loading, onSave }) {
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
      await onSave(type, formData)
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
async function copyToClipboard(text) {
  if (!text) {
    toast.error('Nothing to copy')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    toast.error('Failed to copy to clipboard')
  }
}
