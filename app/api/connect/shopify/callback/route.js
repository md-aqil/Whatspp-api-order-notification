import { NextResponse } from 'next/server'
import { buildOrigin, getConnectSession, isSessionValid, saveShopifyForSession } from '@/lib/connect'
import { httpClient } from '@/lib/httpClient'

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('state')
    const shop = url.searchParams.get('shop')
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    const origin = buildOrigin(request)
    const backToConnect = (extra) => `${origin}/connect/${token}${extra ? `?${extra}` : ''}`

    if (error) {
      return NextResponse.redirect(`${backToConnect('shopify=error')}`)
    }

    if (!token || !shop || !code) {
      return NextResponse.redirect(`${backToConnect('shopify=error')}`)
    }

    const session = await getConnectSession(token)
    if (!session || !isSessionValid(session)) {
      return NextResponse.redirect(`${origin}/connect/${token}?shopify=expired`)
    }

    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const redirectUri = `${origin}/api/connect/shopify/callback`

    // Exchange the OAuth code for a permanent access token (server-side only)
    const tokenResponse = await httpClient.post(
      `https://${normalizedShop}/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code
      },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const accessToken = tokenResponse.data?.access_token
    const scope = tokenResponse.data?.scope || ''
    if (!accessToken) {
      console.error('Shopify token exchange failed:', tokenResponse.data)
      return NextResponse.redirect(`${backToConnect('shopify=error')}`)
    }

    await saveShopifyForSession(session, {
      shopDomain: normalizedShop,
      accessToken,
      scope
    })

    // Best-effort: register the webhooks this app relies on
    try {
      const webhookUrl = `${origin}/api/webhook/shopify`
      const topics = ['orders/create', 'carts/update', 'checkouts/update']
      for (const topic of topics) {
        await createShopifyWebhook(
          { shopDomain: normalizedShop, clientId: process.env.SHOPIFY_CLIENT_ID, clientSecret: process.env.SHOPIFY_CLIENT_SECRET },
          topic,
          webhookUrl
        ).catch((e) => console.warn(`Shopify webhook ${topic} skipped:`, e.message))
      }
    } catch (whErr) {
      console.warn('Shopify webhook registration skipped:', whErr.message)
    }

    return NextResponse.redirect(`${backToConnect('shopify=done')}`)
  } catch (error) {
    console.error('Shopify callback error:', error)
    const origin = buildOrigin(request)
    const u = new URL(request.url)
    return NextResponse.redirect(`${origin}/connect/${u.searchParams.get('state') || ''}?shopify=error`)
  }
}
