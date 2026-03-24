'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()

  return (
    <div className="dashboard-home p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-slate-400 dark:text-white/25">Overview</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        </div>
      </div>

      <Card className="mx-auto mt-12 max-w-2xl border-slate-200/70 bg-white/90 shadow-[0_30px_60px_-40px_rgba(5,52,92,0.45)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-slate-900 dark:text-white">Welcome to WhatsApp Commerce Hub</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-slate-600 dark:text-white/55">
            All configuration options are now available in Settings.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => router.push('/dashboard/settings')}
              className="cta-gradient flex items-center gap-2 border-0 shadow-[0_18px_40px_-18px_rgba(55,132,247,0.75)]"
            >
              <Settings className="w-4 h-4" />
              Go to Settings
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <Card
          className="cursor-pointer border-slate-200/70 bg-white/90 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06] dark:hover:shadow-none"
          onClick={() => router.push('/dashboard/automations')}
        >
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Automations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-white/55">Create and manage automated workflows</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-slate-200/70 bg-white/90 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06] dark:hover:shadow-none"
          onClick={() => router.push('/dashboard/campaigns')}
        >
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-white/55">Send broadcast messages to your customers</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-slate-200/70 bg-white/90 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06] dark:hover:shadow-none"
          onClick={() => router.push('/dashboard/orders')}
        >
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-white/55">View and manage incoming orders</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
