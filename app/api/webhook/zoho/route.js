import { handleZohoWebhook } from '@/lib/webhooks/zoho'

export async function POST(request) {
  return handleZohoWebhook(request)
}

export async function GET(request) {
  return handleZohoWebhook(request)
}
