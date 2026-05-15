import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { getBranding, upsertBranding } from '@/lib/providers/branding-provider'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getUserIdFromRequest(request) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) return null
  try {
    const payload = verifyToken(accessToken)
    return payload?.id || null
  } catch (e) {
    return null
  }
}

export async function GET(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const branding = await getBranding(userId)
    return NextResponse.json({ success: true, branding })
  } catch (error) {
    console.error('Get branding error:', error)
    return NextResponse.json({ error: 'Failed to fetch branding' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { businessName, logoUrl, welcomeMessage, primaryColor, fontFamily, position, botName, enabled } = body

    const updatedBranding = await upsertBranding(userId, {
      businessName,
      logoUrl,
      welcomeMessage,
      primaryColor,
      fontFamily,
      position,
      botName,
      enabled
    })

    return NextResponse.json({ success: true, branding: updatedBranding })
  } catch (error) {
    console.error('Save branding error:', error)
    return NextResponse.json({ error: 'Failed to save branding' }, { status: 500 })
  }
}