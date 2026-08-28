import { NextResponse } from 'next/server'
import { buildOrigin, getConnectSession, isSessionValid, saveWhatsappForSession } from '@/lib/connect'
import { httpClient } from '@/lib/httpClient'

async function getAppAccessToken() {
  const res = await httpClient.get('https://graph.facebook.com/v22.0/oauth/access_token', {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      grant_type: 'client_credentials'
    }
  })
  return res.data?.access_token
}

async function exchangeLongLivedToken(shortToken) {
  try {
    const res = await httpClient.get('https://graph.facebook.com/v22.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortToken
      }
    })
    return res.data?.access_token || shortToken
  } catch (e) {
    console.warn('Meta long-lived token exchange failed, using short token:', e.message)
    return shortToken
  }
}

async function discoverWhatsAppNumber(longToken) {
  // Subject of the embedded-signup token is the WABA id (or a system user)
  const meRes = await httpClient.get('https://graph.facebook.com/v22.0/me', {
    params: { access_token: longToken, fields: 'id,name' }
  })
  const subjectId = meRes.data?.id

  // Try phone numbers directly under the subject
  let phones = []
  try {
    const r = await httpClient.get(`https://graph.facebook.com/v22.0/${subjectId}/phone_numbers`, {
      params: { access_token: longToken }
    })
    phones = r.data?.data || []
  } catch (e) {
    console.warn('Meta phone_numbers lookup under subject failed:', e.message)
  }

  let wabaId = subjectId
  if (phones.length === 0) {
    // Fallback: subject is a system user, list owned WABAs
    const wabaRes = await httpClient.get(
      `https://graph.facebook.com/v22.0/${subjectId}/owned_whatsapp_business_accounts`,
      { params: { access_token: longToken } }
    )
    const wabas = wabaRes.data?.data || []
    if (wabas.length === 0) {
      throw new Error('No WhatsApp Business Account found for this Meta login')
    }
    wabaId = wabas[0].id
    const phoneRes = await httpClient.get(`https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`, {
      params: { access_token: longToken }
    })
    phones = phoneRes.data?.data || []
  }

  if (phones.length === 0) {
    throw new Error('No WhatsApp phone number found. Add a number in Meta Business Manager first.')
  }

  const phone = phones[0]
  return {
    phoneNumberId: phone.id,
    phoneNumber: phone.display_phone_number || phone.verified_name || '',
    accountName: phone.verified_name || phone.display_phone_number || 'WhatsApp Business',
    businessAccountId: wabaId
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const origin = buildOrigin(request)
  const token = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const backToConnect = (extra) => `${origin}/connect/${token}${extra ? `?${extra}` : ''}`

  try {
    requireConnectEnv('META_APP_ID', 'META_APP_SECRET')

    if (error) {
      return NextResponse.redirect(`${backToConnect('whatsapp=error')}`)
    }
    if (!token || !code) {
      return NextResponse.redirect(`${backToConnect('whatsapp=error')}`)
    }

    const session = await getConnectSession(token)
    if (!session || !isSessionValid(session)) {
      return NextResponse.redirect(`${backToConnect('whatsapp=expired')}`)
    }

    const redirectUri = `${origin}/api/connect/whatsapp/callback`
    const codeRes = await httpClient.get('https://graph.facebook.com/v22.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code
      }
    })
    const shortToken = codeRes.data?.access_token
    if (!shortToken) {
      console.error('Meta token exchange failed:', codeRes.data)
      return NextResponse.redirect(`${backToConnect('whatsapp=error')}`)
    }

    const longToken = await exchangeLongLivedToken(shortToken)
    const discovered = await discoverWhatsAppNumber(longToken)

    await saveWhatsappForSession(session, { ...discovered, accessToken: longToken })

    return NextResponse.redirect(`${backToConnect('whatsapp=done')}`)
  } catch (err) {
    console.error('WhatsApp callback error:', err.message)
    return NextResponse.redirect(`${backToConnect('whatsapp=error')}`)
  }
}
