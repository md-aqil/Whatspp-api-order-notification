'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [loading, setLoading] = useState(false)

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
          Configure your webhook settings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
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

// Helper function to copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
  // Using window.alert as toast might not be available in this scope
  if (typeof window !== 'undefined') {
    window.alert('Copied to clipboard!')
  }
}
