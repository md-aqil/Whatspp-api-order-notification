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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  Trash2,
  Workflow,
  Database,
  Image as ImageIcon,
  Palette,
  Bot as BotIcon,
  Loader2,
  Save
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState('unknown')
  const [shopifyStatus, setShopifyStatus] = useState('unknown')
  const [lastWebhook, setLastWebhook] = useState(null)
  const [lastWhatsappWebhook, setLastWhatsappWebhook] = useState(null)
  const [lastCustomWebhook, setLastCustomWebhook] = useState(null)
  const [lastZohoWebhook, setLastZohoWebhook] = useState(null)
  const [zohoWebhooks, setZohoWebhooks] = useState([])
  const [checking, setChecking] = useState(false)
  const [shopifyWebhooks, setShopifyWebhooks] = useState([])
  const [expandedWebhook, setExpandedWebhook] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
   const [baseUrl, setBaseUrl] = useState(process.env.NEXT_PUBLIC_BASE_URL || '')
 
const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false)
    const [shopifyDialogOpen, setShopifyDialogOpen] = useState(false)
    const [stripeDialogOpen, setStripeDialogOpen] = useState(false)
    const [user, setUser] = useState(null)

    // Branding state
    const [branding, setBranding] = useState({
      businessName: 'Our Business',
      logoUrl: '',
      welcomeMessage: 'Hello! How can I help you today?',
      primaryColor: '#005cc0',
      fontFamily: 'Inter',
      position: 'bottom-right',
      botName: 'Support Bot',
      enabled: true
    })
    const [brandingLoading, setBrandingLoading] = useState(false)
    const [logoPreview, setLogoPreview] = useState(null)
    const [logoFile, setLogoFile] = useState(null)

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
    { topic: 'checkouts/create', label: 'Checkout Created' },
    { topic: 'checkouts/update', label: 'Checkout Updated' },
    { topic: 'customers/create', label: 'Customer Created' },
    { topic: 'customers/update', label: 'Customer Updated' },
  ]

  const [customWebhookStatus, setCustomWebhookStatus] = useState(null)
  const [wordpressConnections, setWordpressConnections] = useState([])
  const [loadingWordPressConnections, setLoadingWordPressConnections] = useState(false)
  const [addWordPressOpen, setAddWordPressOpen] = useState(false)
  const [selectedWordPressConnectionId, setSelectedWordPressConnectionId] = useState(null)
  const [connectLinks, setConnectLinks] = useState({})
  const [refreshingConnectionId, setRefreshingConnectionId] = useState(null)
  const [newWordPressConnection, setNewWordPressConnection] = useState({
    site_name: '',
    site_url: '',
    site_id: '',
  })

    useEffect(() => {
      setMounted(true)
  
      if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_BASE_URL) {
        setBaseUrl(window.location.origin)
      }

      // Fetch user info
      fetch('/api/auth/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) setUser(data.user)
        })
        .catch(err => console.error('Failed to fetch user:', err))
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

  // Load branding configuration
  const loadBranding = async () => {
    try {
      const response = await fetch('/api/branding')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.branding) {
          setBranding({
            businessName: data.branding.businessName || '',
            logoUrl: data.branding.logoUrl || '',
            welcomeMessage: data.branding.welcomeMessage || '',
            primaryColor: data.branding.primaryColor || '#005cc0',
            fontFamily: data.branding.fontFamily || 'Inter',
            position: data.branding.position || 'bottom-right',
            botName: data.branding.botName || '',
            enabled: data.branding.enabled ?? true
          })
          if (data.branding.logoUrl) {
            setLogoPreview(data.branding.logoUrl)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load branding:', error)
    }
  }

  // Save branding configuration
  const handleSaveBranding = async () => {
    setBrandingLoading(true)
    try {
      const response = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding)
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('Branding saved successfully!')
      } else {
        toast.error(data.error || 'Failed to save branding')
      }
    } catch (error) {
      console.error('Failed to save branding:', error)
      toast.error('Failed to save branding')
    } finally {
      setBrandingLoading(false)
    }
  }

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('Only JPG, PNG, WebP, and SVG images are supported')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2MB or smaller')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/branding/logo', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (response.ok) {
        setBranding(prev => ({ ...prev, logoUrl: data.url }))
        setLogoPreview(data.url)
        toast.success('Logo uploaded successfully!')
      } else {
        toast.error(data.error || 'Failed to upload logo')
      }
    } catch (error) {
      console.error('Logo upload error:', error)
      toast.error('Failed to upload logo')
    }
  }

  const loadWordPressConnections = async () => {
    try {
      setLoadingWordPressConnections(true)
      const response = await fetch('/api/wordpress-connections', {
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setWordpressConnections(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to load WordPress connections:', error)
    } finally {
      setLoadingWordPressConnections(false)
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

  const handleAddWordPressConnection = async () => {
    if (!newWordPressConnection.site_url) {
      toast.error('Please enter the WordPress site URL')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/wordpress-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWordPressConnection)
      })

      const payload = await response.json()

      if (response.ok) {
        toast.success('WordPress site connected')
        setAddWordPressOpen(false)
        setNewWordPressConnection({ site_name: '', site_url: '', site_id: '' })
        setSelectedWordPressConnectionId(payload.id)
        await savePreferredWordPressConnection(payload.id, false)
        loadWordPressConnections()
      } else {
        toast.error(payload.error || 'Failed to connect WordPress site')
      }
    } catch (error) {
      console.error('Failed to add WordPress connection:', error)
      toast.error('Failed to connect WordPress site')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWordPressConnection = async (id) => {
    try {
      const response = await fetch(`/api/wordpress-connections?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('WordPress site removed')
        if (selectedWordPressConnectionId === id) {
          setSelectedWordPressConnectionId(null)
        }
        loadWordPressConnections()
      } else {
        const payload = await response.json()
        toast.error(payload.error || 'Failed to remove WordPress site')
      }
    } catch (error) {
      console.error('Failed to delete WordPress connection:', error)
      toast.error('Failed to remove WordPress site')
    }
  }

  const savePreferredWordPressConnection = async (connectionId, showToast = true) => {
    try {
      setLoading(true)
      const response = await fetch('/api/wa-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId })
      })

      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Failed to select WordPress site')
        return false
      }

      setSelectedWordPressConnectionId(payload.selected_wordpress_connection_id || null)
      setWoocommerceTriggers(payload.woocommerce?.triggers || [])
      setCustomTables(payload.custom_tables?.tables || [])

      if (showToast) {
        toast.success('WordPress site selected for plugin config')
      }

      return true
    } catch (error) {
      console.error('Failed to save preferred WordPress connection:', error)
      toast.error('Failed to select WordPress site')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateConnectLink = async (connectionId) => {
    try {
      setLoading(true)
      const response = await fetch('/api/wordpress-connections/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId })
      })

      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Failed to generate connect link')
        return
      }

      setConnectLinks((current) => ({
        ...current,
        [connectionId]: payload
      }))
      toast.success('Connect link generated')
    } catch (error) {
      console.error('Failed to generate connect link:', error)
      toast.error('Failed to generate connect link')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshConnectionConfig = async (connectionId) => {
    try {
      setRefreshingConnectionId(connectionId)
      const response = await fetch(`/api/wa-config?connectionId=${encodeURIComponent(connectionId)}&_=${Date.now()}`, {
        cache: 'no-store'
      })
      const payload = await response.json()

      if (!response.ok) {
        toast.error(payload.error || 'Failed to refresh plugin config')
        return
      }

      if (selectedWordPressConnectionId === connectionId) {
        setWoocommerceTriggers(payload.woocommerce?.triggers || [])
        setCustomTables(payload.custom_tables?.tables || [])
      }

      await loadWordPressConnections()
      toast.success('Plugin config refreshed')
    } catch (error) {
      console.error('Failed to refresh plugin config:', error)
      toast.error('Failed to refresh plugin config')
    } finally {
      setRefreshingConnectionId(null)
    }
  }

  const getHealthBadgeClass = (tone) => {
    switch (tone) {
      case 'success':
        return 'bg-green-100 text-green-700'
      case 'warning':
        return 'bg-amber-100 text-amber-700'
      case 'info':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-[#eff4ff] text-[#005cc0]'
    }
  }

  const formatTimestamp = (value) => {
    if (!value) return 'Not yet'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleString()
  }

  // Load registered webhooks on mount
useEffect(() => {
     loadBranding()
     loadRegisteredWebhooks()
     loadWordPressConnections()
   }, [])

  // Integration state
  const [integrations, setIntegrations] = useState({
    whatsapp: { connected: false, data: {} },
    shopify: { connected: false, data: {} },
    stripe: { connected: false, data: {} },
    zoho: { connected: false, data: {} }
  })

  // Load integrations status on mount
  useEffect(() => {
    loadIntegrations()
    
    // Handle Zoho OAuth status from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('zoho') === 'connected') {
        toast.success('Zoho CRM connected successfully!')
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
        loadIntegrations()
        checkWebhookStatus()
      } else if (urlParams.get('error')) {
        const error = urlParams.get('error')
        const detail = urlParams.get('detail')
        toast.error(`Failed to connect Zoho: ${detail ? `${error} - ${detail}` : error}`)
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
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
          
          // Close the corresponding dialog
          if (type === 'whatsapp') setWhatsappDialogOpen(false)
          if (type === 'shopify') setShopifyDialogOpen(false)
          if (type === 'stripe') setStripeDialogOpen(false)

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
          setSelectedWordPressConnectionId(data.selected_wordpress_connection_id || null)
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
          setSelectedWordPressConnectionId(waConfig?.selected_wordpress_connection_id || null)
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
            const shopifyLog = data.logs.find(l => l.type === 'shopify')
            const whatsappLog = data.logs.find(l => l.type === 'whatsapp')
            const customLog = data.logs.find(l => l.type === 'custom')
            const zohoLogs = data.logs.filter(l => l.type === 'zoho')
            const zohoLog = zohoLogs[0]

            if (shopifyLog) setShopifyStatus('connected')
            if (whatsappLog) {
              setWhatsappStatus('connected')
              setLastWhatsappWebhook(whatsappLog)
            }
            if (customLog) setLastCustomWebhook(customLog)
            if (zohoLog) {
              setLastZohoWebhook(zohoLog)
              setZohoWebhooks(zohoLogs.slice(0, 2))
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
    if (!lastCustomWebhook?.payload) return ''
    return JSON.stringify(lastCustomWebhook.payload, null, 2)
  }, [lastCustomWebhook])

  const formatZohoWebhookTopic = (topic) => {
    if (topic === 'crm_get') return 'CRM GET'
    if (topic === 'crm_post') return 'CRM POST'
    return topic || 'CRM Update'
  }

  const buildWebhookUrl = (path) => {
    if (!baseUrl) return path
    const url = `${baseUrl}${path}`
    if (user?.id) {
      return `${url}${url.includes('?') ? '&' : '?'}userId=${user.id}`
    }
    return url
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#05345c] font-headline">Settings</h1>
          <p className="text-[#3d618c] mt-1 font-medium">Configure your platform integrations, webhooks, and preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={checkWebhookStatus} disabled={checking} className="bg-white border-[#e5eeff] text-[#3d618c] font-bold">
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="space-y-8">
        <TabsList className="bg-[#e5eeff] p-1 rounded-xl">
          <TabsTrigger value="integrations" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-[#005cc0]">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="wordpress" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-[#005cc0]">
            WordPress
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-[#005cc0]">
            Webhooks & API
          </TabsTrigger>
<TabsTrigger value="preferences" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-[#005cc0]">
             Preferences
           </TabsTrigger>
           <TabsTrigger value="branding" className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-[#005cc0]">
             Branding
           </TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-8 mt-0 focus-visible:outline-none">
          <div className="bg-white p-8 rounded-2xl shadow-sm border-none ring-1 ring-black/[0.03]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold font-headline">Service Connections</h3>
              <div className="text-[#3d618c] text-sm font-semibold">{activeWebhookCount} active endpoints</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* WhatsApp */}
              <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
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
              <Dialog open={shopifyDialogOpen} onOpenChange={setShopifyDialogOpen}>
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
              <Dialog open={stripeDialogOpen} onOpenChange={setStripeDialogOpen}>
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

              {/* Zoho CRM */}
              <div 
                className="flex flex-col gap-4 cursor-pointer"
                onClick={() => {
                  if (integrations.zoho.connected) {
                    toast.info('Zoho CRM is already connected. To reconnect, please disconnect first.')
                  } else {
                    window.location.href = '/api/integrations/zoho/auth'
                  }
                }}
              >
                <div className={`p-5 rounded-xl transition-colors group ${integrations.zoho.connected ? 'border-2 border-dashed border-orange-500/20 bg-orange-50/10' : 'bg-[#f8f9ff] hover:bg-[#eff4ff]'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Database className="text-orange-600 w-5 h-5" />
                    </div>
                    {integrations.zoho.connected ? (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black uppercase">Connected</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">Inactive</span>
                    )}
                  </div>
                  <h4 className="font-bold mb-1">Zoho CRM</h4>
                  <p className="text-[11px] text-[#3d618c] mb-4">Two-Way CRM Sync</p>
                  {!integrations.zoho.connected && (
                    <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] leading-4 text-orange-900">
                      <p className="font-bold">Before connecting, make sure this Zoho login has a Zoho CRM organization at crm.zoho.in.</p>
                      <p className="mt-1">If Zoho shows a broken app logo, fix or remove the app logo in api-console.zoho.in.</p>
                    </div>
                  )}
                  <div className={`w-full py-2 rounded-lg ${integrations.zoho.connected ? 'bg-orange-100 text-orange-700' : 'bg-[#e5eeff] text-[#005cc0]'} font-bold text-xs hover:bg-orange-600 hover:text-white transition-all text-center`}>
                    {integrations.zoho.connected ? 'Connected' : 'Connect Zoho'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* WordPress Tab */}
        <TabsContent value="wordpress" className="space-y-8 mt-0 focus-visible:outline-none">
          <div className="bg-white p-8 rounded-2xl shadow-sm border-none ring-1 ring-black/[0.03]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold font-headline">WordPress Sites</h3>
                <p className="text-sm text-[#3d618c] mt-1">Manage the WordPress connection and the latest activity from the connected plugin.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadWordPressConnections}
                  disabled={loadingWordPressConnections}
                  className="bg-[#eff4ff] hover:bg-[#dce9ff] px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-[#005cc0] ${loadingWordPressConnections ? 'animate-spin' : ''}`} />
                </button>
                <Dialog open={addWordPressOpen} onOpenChange={setAddWordPressOpen}>
                  <DialogTrigger asChild>
                    <button className="bg-[#eff4ff] hover:bg-[#dce9ff] px-4 py-2 rounded-lg text-sm font-bold text-[#005cc0] transition-colors flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Connect WordPress
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Connect WordPress Site</DialogTitle>
                      <DialogDescription>
                        Save this site in the platform database. Site ID is optional and will be generated from the URL if blank.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="wp-site-name">Site Name</Label>
                        <Input
                          id="wp-site-name"
                          placeholder="My Store"
                          value={newWordPressConnection.site_name}
                          onChange={(e) => setNewWordPressConnection({ ...newWordPressConnection, site_name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wp-site-url">Site URL</Label>
                        <Input
                          id="wp-site-url"
                          placeholder="https://store.example.com"
                          value={newWordPressConnection.site_url}
                          onChange={(e) => setNewWordPressConnection({ ...newWordPressConnection, site_url: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wp-site-id">Site ID (Optional)</Label>
                        <Input
                          id="wp-site-id"
                          placeholder="my-shop-1"
                          value={newWordPressConnection.site_id}
                          onChange={(e) => setNewWordPressConnection({ ...newWordPressConnection, site_id: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setAddWordPressOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddWordPressConnection} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Site'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-3">
              {wordpressConnections.map((connection) => (
                <div key={connection.id} className="border border-[#e5eeff] rounded-xl p-4 bg-[#f8f9ff]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{connection.site_name || connection.site_id}</span>
                        {selectedWordPressConnectionId === connection.id && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[#05345c] text-white">
                            Selected
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getHealthBadgeClass(connection.health?.tone)}`}>
                          {connection.health?.label || connection.status}
                        </span>
                      </div>
                      {connection.health?.reason && (
                        <div className="rounded-lg border border-[#e5eeff] bg-white px-3 py-2 text-[11px] text-[#3d618c]">
                          {connection.health.reason}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff]">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Site URL</div>
                          <code className="text-[#05345c] break-all">{connection.site_url}</code>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff]">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Site ID</div>
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[#05345c] break-all">{connection.site_id}</code>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(connection.site_id)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff] md:col-span-2">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Webhook Secret</div>
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[#05345c] break-all">{connection.webhook_secret || 'Not generated'}</code>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(connection.webhook_secret)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff]">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Last Handshake</div>
                          <div className="text-[#05345c]">{formatTimestamp(connection.health?.last_handshake_at)}</div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff]">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Last Webhook</div>
                          <div className="text-[#05345c]">{formatTimestamp(connection.health?.last_webhook_at)}</div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff]">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Plugin Version</div>
                          <div className="text-[#05345c]">{connection.plugin_version || 'Unknown'}</div>
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff]">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Config Cache</div>
                          <div className="text-[#05345c]">{formatTimestamp(connection.health?.cached_plugin_config_at)}</div>
                        </div>
                        {connection.health?.last_webhook_topic && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff] md:col-span-2">
                            <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Last Webhook Topic</div>
                            <code className="text-[#05345c] break-all">{connection.health.last_webhook_topic}</code>
                          </div>
                        )}
                        {connection.health?.connect_token_expires_at && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-[#e5eeff] md:col-span-2">
                            <div className="text-[10px] font-bold uppercase text-[#3d618c] mb-1">Connect Link Expires</div>
                            <div className="text-[#05345c]">{formatTimestamp(connection.health.connect_token_expires_at)}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={selectedWordPressConnectionId === connection.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => savePreferredWordPressConnection(connection.id)}
                          disabled={loading}
                        >
                          {selectedWordPressConnectionId === connection.id ? 'Using for Plugin Config' : 'Use for Plugin Config'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateConnectLink(connection.id)}
                          disabled={loading}
                        >
                          Generate Connect Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshConnectionConfig(connection.id)}
                          disabled={refreshingConnectionId === connection.id}
                        >
                          {refreshingConnectionId === connection.id ? 'Refreshing...' : 'Refresh Plugin Config'}
                        </Button>
                      </div>
                      {connectLinks[connection.id]?.connect_url && (
                        <div className="rounded-lg border border-[#e5eeff] bg-white px-3 py-3 space-y-2">
                          <div className="text-[10px] font-bold uppercase text-[#3d618c]">WordPress Plugin Connect Link</div>
                          <div className="flex items-center gap-2">
                            <Input readOnly value={connectLinks[connection.id].connect_url} className="bg-[#f8f9ff] border-[#e5eeff]" />
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(connectLinks[connection.id].connect_url)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-[11px] text-[#3d618c]">
                            Paste this into the WordPress plugin Connection URL field, then click "Connect to Platform". Expires at{' '}
                            {new Date(connectLinks[connection.id].expires_at).toLocaleString()}.
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteWordPressConnection(connection.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete WordPress site"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {wordpressConnections.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500 border border-dashed border-[#e5eeff] rounded-xl">
                  No WordPress sites connected yet.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-8 mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-7 space-y-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border-none ring-1 ring-black/[0.03]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold font-headline">Webhook Endpoints</h3>
                  <Dialog open={addWebhookOpen} onOpenChange={setAddWebhookOpen}>
                    <DialogTrigger asChild>
                      <button className="bg-[#eff4ff] hover:bg-[#dce9ff] px-4 py-2 rounded-lg text-sm font-bold text-[#005cc0] transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Custom
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add New Webhook</DialogTitle>
                        <DialogDescription>Configure a new webhook endpoint.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="webhook-name">Webhook Name</Label>
                          <Input id="webhook-name" placeholder="My App" value={newWebhook.name} onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="webhook-url">Target URL</Label>
                          <Input id="webhook-url" placeholder="https://your-site.com/webhook" value={newWebhook.target_url} onChange={(e) => setNewWebhook({ ...newWebhook, target_url: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setAddWebhookOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddWebhook} disabled={loading}>{loading ? 'Adding...' : 'Add Webhook'}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {/* WhatsApp Webhook */}
                  <div className="border border-[#e5eeff] rounded-xl overflow-hidden">
                    <div onClick={() => toggleWebhook('whatsapp')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                      <div className="flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full ${whatsappStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold">WhatsApp Webhook</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#e4ceff] text-[#53436c] uppercase">System</span>
                        </div>
                        <code className="text-[10px] text-[#3d618c] bg-[#eff4ff] px-2 py-0.5 rounded truncate">{buildWebhookUrl('/api/webhook/whatsapp')}</code>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'whatsapp' ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedWebhook === 'whatsapp' && (
                      <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-xs">
                        <p className="font-semibold mb-2 text-[#3d618c] uppercase">Meta Developer Setup</p>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={buildWebhookUrl('/api/webhook/whatsapp')} className="bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/whatsapp'))}><Copy className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shopify Webhook */}
                  {integrations.shopify.connected && (
                    <div className="border border-[#e5eeff] rounded-xl overflow-hidden">
                      <div onClick={() => toggleWebhook('shopify')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${shopifyStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold">Shopify Webhook</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#d2e4ff] text-[#005cc0] uppercase">eCommerce</span>
                          </div>
                          <code className="text-[10px] text-[#3d618c] bg-[#eff4ff] px-2 py-0.5 rounded truncate">{buildWebhookUrl('/api/webhook/shopify')}</code>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'shopify' ? 'rotate-180' : ''}`} />
                      </div>
                      {expandedWebhook === 'shopify' && (
                        <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-xs">
                          <p className="font-semibold mb-2 text-[#3d618c] uppercase">Shopify Admin Setup</p>
                          <div className="flex items-center gap-2">
                            <Input readOnly value={buildWebhookUrl('/api/webhook/shopify')} className="bg-white border-[#e5eeff]" />
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/shopify'))}><Copy className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Zoho Webhook */}
                  <div className="border border-[#e5eeff] rounded-xl overflow-hidden">
                    <div onClick={() => toggleWebhook('zoho')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                      <div className="flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full ${lastZohoWebhook ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold">Zoho CRM Webhook</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#fff3d2] text-[#8c6d3d] uppercase">CRM</span>
                        </div>
                        <code className="text-[10px] text-[#3d618c] bg-[#eff4ff] px-2 py-0.5 rounded truncate">{buildWebhookUrl('/api/webhook/zoho')}</code>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'zoho' ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedWebhook === 'zoho' && (
                      <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-xs">
                        <p className="font-semibold mb-2 text-[#3d618c] uppercase">Zoho CRM Workflow Setup</p>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={buildWebhookUrl('/api/webhook/zoho')} className="bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/zoho'))}><Copy className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Webhook URL */}
                  <div className="border border-[#e5eeff] rounded-xl overflow-hidden">
                    <div onClick={() => toggleWebhook('custom')} className="flex items-center gap-4 py-4 px-4 hover:bg-[#eff4ff] cursor-pointer transition-colors">
                      <div className="flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full ${customWebhookStatus?.status === 'ready' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold">WordPress/Custom Hook</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#dcfce7] text-[#166534] uppercase">Plugin</span>
                        </div>
                        <code className="text-[10px] text-[#3d618c] bg-[#eff4ff] px-2 py-0.5 rounded truncate">{buildWebhookUrl('/api/webhook/custom')}</code>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-[#3d618c] transition-transform ${expandedWebhook === 'custom' ? 'rotate-180' : ''}`} />
                    </div>
                    {expandedWebhook === 'custom' && (
                      <div className="px-11 py-4 bg-[#f8f9ff] border-t border-[#e5eeff] text-xs">
                        <p className="font-semibold mb-2 text-[#3d618c] uppercase">Generic/WordPress Plugin URL</p>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={buildWebhookUrl('/api/webhook/custom')} className="bg-white border-[#e5eeff]" />
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(buildWebhookUrl('/api/webhook/custom'))}><Copy className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 space-y-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border-none ring-1 ring-black/[0.03]">
                <h3 className="text-xl font-bold font-headline mb-6 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-[#005cc0]" /> Live Feed
                </h3>
                
                <div className="space-y-8">
                  {/* WhatsApp Activity */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#3d618c] mb-3 flex items-center gap-2">
                      <MessageCircle className="w-3 h-3" /> Latest WhatsApp
                    </p>
                    {lastWhatsappWebhook ? (
                      <div className="bg-[#f8f9ff] p-3 rounded-xl border border-[#e5eeff] space-y-3">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500">{lastWhatsappWebhook.topic || 'Message'}</span>
                          <span className="font-mono text-white bg-[#05345c] px-1.5 py-0.5 rounded">{new Date(lastWhatsappWebhook.receivedAt).toLocaleTimeString()}</span>
                        </div>
                        <pre className="max-h-32 overflow-auto p-2 text-[9px] bg-[#05345c] text-[#dff3ff] rounded-lg whitespace-pre-wrap break-words">
                          {JSON.stringify(lastWhatsappWebhook.payload || {}, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed border-[#e5eeff] rounded-xl text-center text-[10px] text-gray-400">Waiting for WhatsApp activity...</div>
                    )}
                  </div>

                  {/* WordPress Activity */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#3d618c] mb-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Latest WordPress
                    </p>
                    {lastCustomWebhook ? (
                      <div className="bg-[#f8f9ff] p-3 rounded-xl border border-[#e5eeff] space-y-3">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500">{lastCustomWebhook.topic || 'Event'}</span>
                          <span className="font-mono text-white bg-[#05345c] px-1.5 py-0.5 rounded">{new Date(lastCustomWebhook.receivedAt).toLocaleTimeString()}</span>
                        </div>
                        <pre className="max-h-32 overflow-auto p-2 text-[9px] bg-[#05345c] text-[#dff3ff] rounded-lg whitespace-pre-wrap break-words">
                          {latestWordPressRawPayload}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed border-[#e5eeff] rounded-xl text-center text-[10px] text-gray-400">Waiting for WordPress activity...</div>
                    )}
                  </div>

                  {/* Zoho Activity */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#3d618c] mb-3 flex items-center gap-2">
                      <Workflow className="w-3 h-3" /> Latest Zoho CRM
                    </p>
                    {zohoWebhooks.length > 0 ? (
                      <div className="space-y-3">
                        {zohoWebhooks.map((webhook) => (
                          <div key={webhook.id} className="bg-[#f8f9ff] p-3 rounded-xl border border-[#e5eeff] space-y-3">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-gray-500">{formatZohoWebhookTopic(webhook.topic)}</span>
                              <span className="font-mono text-white bg-[#05345c] px-1.5 py-0.5 rounded">{new Date(webhook.receivedAt).toLocaleTimeString()}</span>
                            </div>
                            <pre className="max-h-32 overflow-auto p-2 text-[9px] bg-[#05345c] text-[#dff3ff] rounded-lg whitespace-pre-wrap break-words">
                              {JSON.stringify(webhook.payload || {}, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed border-[#e5eeff] rounded-xl text-center text-[10px] text-gray-400">Waiting for Zoho activity...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

{/* Branding Tab */}
         <TabsContent value="branding" className="space-y-8 mt-0 focus-visible:outline-none">
           <div className="bg-white p-8 rounded-2xl shadow-sm border-none ring-1 ring-black/[0.03] max-w-2xl">
             <h3 className="text-xl font-bold font-headline mb-2 flex items-center gap-3">
               <Palette className="w-6 h-6 text-[#005cc0]" />
               Chatbot Branding
             </h3>
             <p className="text-sm text-[#3d618c] mb-8">Customize your chatbot's appearance, logo, and messaging to match your brand identity.</p>

             <div className="space-y-8">
               {/* Logo Upload */}
               <div className="space-y-3">
                 <Label className="font-bold text-sm">Bot Logo</Label>
                 <div className="flex items-center gap-6">
                   <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[#f8f9ff] border border-[#e5eeff] flex items-center justify-center flex-shrink-0 group">
                     {logoPreview || branding.logoUrl ? (
                       <img
                         src={logoPreview || branding.logoUrl}
                         alt="Brand logo"
                         className="w-full h-full object-contain"
                       />
                     ) : (
                       <ImageIcon className="w-8 h-8 text-[#3d618c]" />
                     )}
                     <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center rounded-2xl">
                       <span className="text-white text-xs font-bold">Change</span>
                       <input
                         type="file"
                         accept="image/jpeg,image/png,image/webp,image/svg+xml"
                         className="hidden"
                         onChange={handleLogoUpload}
                       />
                     </label>
                   </div>
                   <div className="text-[11px] text-[#3d618c] space-y-1">
                     <p>Upload your company logo or</p>
                     <p className="font-medium">brand icon (JPG, PNG, WebP, SVG)</p>
                     <p className="text-[10px]">Max 2MB</p>
                   </div>
                 </div>
               </div>

               {/* Business Name */}
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label htmlFor="branding-businessName" className="font-bold text-sm">Business Name</Label>
                   <Input
                     id="branding-businessName"
                     placeholder="Your business name"
                     value={branding.businessName}
                     onChange={(e) => setBranding(prev => ({ ...prev, businessName: e.target.value }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="branding-botName" className="font-bold text-sm">Bot Name</Label>
                   <Input
                     id="branding-botName"
                     placeholder="e.g. Support Assistant"
                     value={branding.botName}
                     onChange={(e) => setBranding(prev => ({ ...prev, botName: e.target.value }))}
                   />
                 </div>
               </div>

               {/* Welcome Message */}
               <div className="space-y-2">
                 <Label htmlFor="branding-welcomeMessage" className="font-bold text-sm">Welcome Message</Label>
                 <textarea
                   id="branding-welcomeMessage"
                   rows={3}
                   placeholder="Hello! How can I help you today?"
                   value={branding.welcomeMessage}
                   onChange={(e) => setBranding(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                   className="w-full resize-none border border-gray-200 bg-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#005cc0]/30 text-sm"
                 />
               </div>

               {/* Primary Color & Position */}
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label className="font-bold text-sm">Primary Color</Label>
                   <div className="flex items-center gap-3">
                     <input
                       type="color"
                       value={branding.primaryColor}
                       onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                       className="w-12 h-10 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                     />
                     <code className="text-sm font-mono text-gray-600">{branding.primaryColor}</code>
                   </div>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="branding-position" className="font-bold text-sm">Widget Position</Label>
                   <select
                     id="branding-position"
                     value={branding.position}
                     onChange={(e) => setBranding(prev => ({ ...prev, position: e.target.value }))}
                     className="w-full border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#005cc0]/30"
                   >
                     <option value="bottom-right">Bottom Right</option>
                     <option value="bottom-left">Bottom Left</option>
                   </select>
                 </div>
               </div>

               {/* Enable/Disable */}
               <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-xl">
                 <div>
                   <p className="font-bold">Enable Chatbot Widget</p>
                   <p className="text-xs text-[#3d618c] mt-0.5">Toggle the live chat widget on your website</p>
                 </div>
                 <button
                   type="button"
                   onClick={() => setBranding(prev => ({ ...prev, enabled: !prev.enabled }))}
                   className={`w-12 h-7 rounded-full relative p-1 transition-colors ${branding.enabled ? 'bg-[#005cc0]' : 'bg-[#d2e4ff]'}`}
                 >
                   <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${branding.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                 </button>
               </div>

               {/* Save Button */}
               <div className="pt-4 border-t border-gray-100">
                 <Button onClick={handleSaveBranding} disabled={brandingLoading} className="w-full">
                   {brandingLoading ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       Saving...
                     </>
                   ) : (
                     <>
                       <Save className="w-4 h-4 mr-2" />
                       Save Branding
                     </>
                   )}
                 </Button>
               </div>
             </div>
           </div>
         </TabsContent>

         {/* Preferences Tab */}
         <TabsContent value="preferences" className="space-y-8 mt-0 focus-visible:outline-none">
          <div className="bg-white p-8 rounded-2xl shadow-sm border-none ring-1 ring-black/[0.03] max-w-2xl">
            <h3 className="text-xl font-bold font-headline mb-8">App Preferences</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-xl">
                <div>
                  <p className="font-bold">Dark Mode</p>
                  <p className="text-xs text-[#3d618c]">Toggle between light and dark themes</p>
                </div>
                <button type="button" onClick={toggleDarkMode} className={`w-12 h-7 rounded-full relative p-1 transition-colors ${isDarkMode ? 'bg-[#005cc0]' : 'bg-[#d2e4ff]'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-xl">
                <div>
                  <p className="font-bold">Notifications</p>
                  <p className="text-xs text-[#3d618c]">Instant browser alerts for new events</p>
                </div>
                <button type="button" onClick={() => setNotificationsEnabled(!notificationsEnabled)} className={`w-12 h-7 rounded-full relative p-1 transition-colors ${notificationsEnabled ? 'bg-[#005cc0]' : 'bg-[#d2e4ff]'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
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
    const url = `${window.location.origin}/api/webhook/whatsapp`
    return user?.id ? `${url}?userId=${user.id}` : url
  }, [user?.id])

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
        <div className="space-y-4">
          {/* Main Credentials */}
          {getFields().filter(f => !['webhookVerifyToken'].includes(f.key)).map(field => (
            <div key={field.key} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.key === 'catalogId' && (
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
                required={field.key !== 'catalogId'}
                className="bg-white"
              />
            </div>
          ))}

          {/* Meta Webhook Setup Group */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700">Meta Webhook Setup</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-emerald-900 font-bold">Callback URL</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 px-2" onClick={() => copyValue(webhookUrl, 'webhookUrl')} disabled={!webhookUrl}>
                  {copiedField === 'webhookUrl' ? 'Copied!' : <><Copy className="w-3 h-3 mr-1" /> Copy URL</>}
                </Button>
              </div>
              <div className="p-3 bg-white border border-emerald-100 rounded-lg break-all font-mono text-[11px] text-emerald-800 shadow-sm">
                {webhookUrl || 'Loading URL...'}
              </div>
              <p className="text-[10px] text-emerald-600/70 italic px-1">Paste this into the Meta App "Callback URL" field.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-emerald-900 font-bold">Verify Token</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 px-2"
                  onClick={() => copyValue(formData.webhookVerifyToken || '', 'webhookVerifyToken')}
                  disabled={!formData.webhookVerifyToken}
                >
                  {copiedField === 'webhookVerifyToken' ? 'Copied!' : <><Copy className="w-3 h-3 mr-1" /> Copy Token</>}
                </Button>
              </div>
              <Input
                id="webhookVerifyToken"
                value={formData.webhookVerifyToken || ''}
                readOnly
                className="bg-white border-emerald-100 font-mono text-[11px] text-emerald-800"
              />
              <p className="text-[10px] text-emerald-600/70 italic px-1">
                Paste this into the Meta App "Verify Token" field.
              </p>
            </div>
          </div>
        </div>
      )}

      {type !== 'whatsapp' && getFields().map(field => (
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
