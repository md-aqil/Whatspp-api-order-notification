'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Store, MessageCircle, AlertCircle, Smartphone } from 'lucide-react'

export default function ConnectTokenPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shopDomain, setShopDomain] = useState('')
  const [busy, setBusy] = useState({ shopify: false, whatsapp: false })

  const pollRef = useRef(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/connect/session?token=${encodeURIComponent(token)}`, {
        cache: 'no-store'
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid connect session')
        setStatus({ valid: false })
        return
      }
      setStatus(data)
      if (data.valid && data.status === 'complete') {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch (e) {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => pollRef.current && clearInterval(pollRef.current)
  }, [token])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('shopify')
    const wa = params.get('whatsapp')
    if (result === 'error') setError('Shopify connection failed. Try again.')
    if (result === 'expired') setError('This connect session expired. Generate a new QR code.')
    if (result === 'done') setBusy((b) => ({ ...b, shopify: false }))
    if (wa === 'error') setError('WhatsApp connection failed. Try again.')
    if (wa === 'expired') setError('This connect session expired. Generate a new QR code.')
    if (wa === 'done') setBusy((b) => ({ ...b, whatsapp: false }))
    if (result || wa) {
      router.replace(`/connect/${token}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const startShopify = () => {
    const shop = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!shop) {
      setError('Enter your Shopify store domain (e.g. your-store.myshopify.com)')
      return
    }
    setBusy((b) => ({ ...b, shopify: true }))
    setError('')
    window.location.href = `/api/connect/shopify/authorize?token=${encodeURIComponent(token)}&shop=${encodeURIComponent(shop)}`
  }

  const startWhatsapp = () => {
    setBusy((b) => ({ ...b, whatsapp: true }))
    setError('')
    window.location.href = `/api/connect/whatsapp/authorize?token=${encodeURIComponent(token)}`
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin w-8 h-8 text-[#005cc0]" />
      </main>
    )
  }

  if (status && !status.valid) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900">Session expired</h1>
          <p className="text-sm text-slate-500 mt-2">
            This QR code is no longer valid. Open the dashboard and generate a new one.
          </p>
        </div>
      </main>
    )
  }

  const allDone = status?.status === 'complete'

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#005cc0] to-[#003a82] p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <Smartphone className="w-7 h-7 text-[#005cc0]" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Connect your store</h1>
            <p className="text-sm text-slate-500">Link Shopify and WhatsApp to your account</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <ConnectStep
          icon={<Store className="w-5 h-5" />}
          title="Shopify"
          description="Sign in and install the app on your store"
          connected={status?.shopifyConnected}
          busy={busy.shopify}
          onConnect={startShopify}
          input={
            <input
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              disabled={busy.shopify || status?.shopifyConnected}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#005cc0] disabled:bg-slate-50"
            />
          }
          meta={status?.shopify?.shopDomain}
        />

        <div className="my-4 h-px bg-slate-100" />

        <ConnectStep
          icon={<MessageCircle className="w-5 h-5" />}
          title="WhatsApp Business"
          description="Log in to Meta and select your business number"
          connected={status?.whatsappConnected}
          busy={busy.whatsapp}
          onConnect={startWhatsapp}
          meta={status?.whatsapp?.accountName}
        />

        {allDone && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 p-4 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-semibold">All set! You can close this page.</span>
          </div>
        )}
      </div>
    </main>
  )
}

function ConnectStep({ icon, title, description, connected, busy, onConnect, input, meta }) {
  return (
    <div className={`rounded-2xl border p-4 ${connected ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? 'bg-emerald-100 text-emerald-600' : 'bg-[#eff4ff] text-[#005cc0]'}`}>
          {connected ? <CheckCircle2 className="w-5 h-5" /> : icon}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{connected ? (meta || 'Connected') : description}</p>
        </div>
        {!connected &&
          (busy ? (
            <Loader2 className="animate-spin w-5 h-5 text-[#005cc0]" />
          ) : (
            <button
              onClick={onConnect}
              className="rounded-lg bg-[#005cc0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004a9e]"
            >
              Connect
            </button>
          ))}
      </div>
      {input && !connected && <div className="mt-3">{input}</div>}
    </div>
  )
}
