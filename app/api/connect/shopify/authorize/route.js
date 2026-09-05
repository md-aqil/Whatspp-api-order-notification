import { NextResponse } from 'next/server'
import { buildOrigin, getConnectSession, isSessionValid, requireConnectEnv, saveShopifyForSession } from '@/lib/connect'
import { createShopifyWebhook, normalizeShopifyDomain } from '@/lib/integrations/shopify'
import { httpClient } from '@/lib/httpClient'

export const dynamic = 'force-dynamic'

const DEFAULT_SCOPES = [
  'read_products',
  'read_orders',
  'write_orders',
  'read_customers',
  'read_checkouts',
  'read_fulfillments',
  'write_webhooks'
].join(',')

export async function GET(request) {
  try {
    requireConnectEnv('SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET')

    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    const shop = normalizeShopifyDomain(url.searchParams.get('shop') || '')

    if (!shop) {
      return NextResponse.json({ error: 'Shop domain is required' }, { status: 400 })
    }

    const session = await getConnectSession(token)
    if (!session || !isSessionValid(session)) {
      return NextResponse.json({ error: 'Connect session is invalid or expired' }, { status: 410 })
    }

    const origin = buildOrigin(request)
    const redirectUri = `${origin}/api/connect/shopify/callback`
    const scopes = process.env.SHOPIFY_SCOPES || DEFAULT_SCOPES

    const authorizeUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(process.env.SHOPIFY_CLIENT_ID)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(token)}`

    return NextResponse.redirect(authorizeUrl)
  } catch (error) {
    if (error?.status === 500 && error?.code === 'MISSING_ENV') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('Shopify authorize error:', error)
    return NextResponse.json({ error: 'Failed to start Shopify authorization' }, { status: 500 })
  }
}

export async function POST(request) {
  // Allow the phone page to POST the shop domain instead of a query param
  try {
    const body = await request.json().catch(() => ({}))
    const token = body.token || new URL(request.url).searchParams.get('token')
    const shop = normalizeShopifyDomain(body.shop || '')

    const authorizeUrl = new URL(`${buildOrigin(request)}/api/connect/shopify/authorize`)
    authorizeUrl.searchParams.set('token', token)
    authorizeUrl.searchParams.set('shop', shop)

    return NextResponse.redirect(authorizeUrl.toString())
  } catch (error) {
    console.error('Shopify authorize POST error:', error)
    return NextResponse.json({ error: 'Failed to start Shopify authorization' }, { status: 500 })
  }
}
