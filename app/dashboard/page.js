'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <Card className="max-w-2xl mx-auto mt-12">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to WhatsApp Commerce Hub</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            All configuration options are now available in Settings.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => router.push('/dashboard/settings')}
              className="flex items-center gap-2"
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
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/dashboard/automations')}
        >
          <CardHeader>
            <CardTitle className="text-lg">Automations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Create and manage automated workflows</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/dashboard/campaigns')}
        >
          <CardHeader>
            <CardTitle className="text-lg">Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Send broadcast messages to your customers</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/dashboard/orders')}
        >
          <CardHeader>
            <CardTitle className="text-lg">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">View and manage incoming orders</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
