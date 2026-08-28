import { NextResponse } from 'next/server'
import { createConnectSession, getConnectSession, buildOrigin, buildConnectUrl, isSessionValid, deriveSessionStatus } from '@/lib/connect'
import { requireRequestUserId } from '@/lib/request-user'

export async function POST(request) {
  try {
    const userId = requireRequestUserId(request)
    const { token, connectUrl } = await (async () => {
      const session = await createConnectSession(userId)
      const origin = buildOrigin(request)
      return { token: session.token, connectUrl: buildConnectUrl(origin, session.token) }
    })()

    return NextResponse.json({
      token,
      connectUrl,
      expires_in: 900
    })
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error creating connect session:', error)
    return NextResponse.json({ error: 'Failed to create connect session' }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const session = await getConnectSession(token)
    if (!session) {
      return NextResponse.json({ valid: false, status: 'not_found' }, { status: 404 })
    }

    const valid = isSessionValid(session)
    const { status, shopifyConnected, whatsappConnected } = deriveSessionStatus(session)

    return NextResponse.json({
      valid,
      status: valid ? status : 'expired',
      shopifyConnected,
      whatsappConnected,
      shopify: session.shopify ? { shopDomain: session.shopify.shopDomain } : null,
      whatsapp: session.whatsapp
        ? { phoneNumberId: session.whatsapp.phoneNumberId, accountName: session.whatsapp.accountName }
        : null,
      expires_at: session.expires_at
    })
  } catch (error) {
    console.error('Error fetching connect session:', error)
    return NextResponse.json({ error: 'Failed to fetch connect session' }, { status: 500 })
  }
}
