import { NextResponse } from 'next/server'
import { buildOrigin, getConnectSession, isSessionValid, requireConnectEnv } from '@/lib/connect'

const META_SCOPES = 'whatsapp_business_messaging,whatsapp_business_management'

export async function GET(request) {
  try {
    requireConnectEnv('META_APP_ID', 'META_APP_SECRET')

    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    const session = await getConnectSession(token)
    if (!session || !isSessionValid(session)) {
      return NextResponse.json({ error: 'Connect session is invalid or expired' }, { status: 410 })
    }

    const origin = buildOrigin(request)
    const redirectUri = `${origin}/api/connect/whatsapp/callback`

    const authorizeUrl =
      `https://www.facebook.com/v22.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(process.env.META_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(META_SCOPES)}` +
      `&state=${encodeURIComponent(token)}`

    return NextResponse.redirect(authorizeUrl)
  } catch (error) {
    if (error?.status === 500 && error?.code === 'MISSING_ENV') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('WhatsApp authorize error:', error)
    return NextResponse.json({ error: 'Failed to start WhatsApp authorization' }, { status: 500 })
  }
}
