import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'
import { query } from '@/lib/postgres'
import { requireRequestUserId } from '@/lib/request-user'

import { decrypt } from '@/lib/encryption'

async function getStoredIntegrations(userId) {
  const [rows] = await query(
    `SELECT whatsapp
     FROM integrations
     WHERE userId = ?
     ORDER BY updatedAt DESC, id DESC
     LIMIT 1`,
    [userId]
  )
  const row = rows[0]
  if (!row) return null
  
  let whatsappStr = row.whatsapp
  if (typeof whatsappStr === 'string' && whatsappStr.includes(':')) {
    whatsappStr = decrypt(whatsappStr)
  }
  
  return {
    whatsapp: typeof whatsappStr === 'string' ? JSON.parse(whatsappStr) : whatsappStr
  }
}

export async function GET(request) {
  try {
    const userId = requireRequestUserId(request)
    const integrations = await getStoredIntegrations(userId)
    const whatsapp = integrations?.whatsapp

    if (!whatsapp?.accessToken || !whatsapp?.businessAccountId) {
      return NextResponse.json(
        {
          error: 'WhatsApp not configured properly. Missing access token or business account ID.',
          guidance: 'Open Integrations and save a valid WhatsApp phone number, access token, and business account ID.'
        },
        { status: 400 }
      )
    }

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${whatsapp.businessAccountId}/message_templates?limit=1000`,
      {
        headers: {
          ...buildMetaAuthHeaders(whatsapp.accessToken),
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('WhatsApp Templates API Error:', data)

      let errorMsg = data.error?.message || 'Failed to fetch templates from Meta.'
      let guidance = 'Check your access token, business account ID, and Meta app permissions.'
      
      if (response.status === 401 || errorMsg.includes('expired') || errorMsg.includes('valid access token')) {
        errorMsg = 'Your WhatsApp access token has expired. Please refresh it in Integrations settings.'
        guidance = 'Go to Dashboard > Settings > Integrations, copy your Meta access token again, and save it. Tokens expire after ~24 hours unless extended.'
      } else if (data.error?.code === 200) {
        guidance = 'Your token is missing required Meta permissions for template access.'
      } else if (data.error?.code === 100) {
        guidance = 'The WhatsApp business account ID appears invalid or inaccessible for this token.'
      }

      return NextResponse.json(
        {
          error: errorMsg,
          guidance
        },
        { status: response.status }
      )
    }

    const templates = Array.isArray(data.data) ? data.data : []
    const approvedTemplates = templates.filter((template) => String(template.status || '').toUpperCase() === 'APPROVED')

    return NextResponse.json(approvedTemplates)
  } catch (error) {
    if (error?.status === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('Error fetching WhatsApp templates:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch templates',
        guidance: 'Please verify PostgreSQL connectivity and your WhatsApp integration settings.'
      },
      { status: 500 }
    )
  }
}
