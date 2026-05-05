import { handleShopifyWebhook } from '@/lib/webhooks/shopify'

export async function POST(request) {
  return handleShopifyWebhook(request)
}

export async function GET(request) {
  return handleShopifyWebhook(request)
}
