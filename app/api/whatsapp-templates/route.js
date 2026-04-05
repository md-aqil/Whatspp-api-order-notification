import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'
import { query } from '@/lib/postgres'

async function getStoredIntegrations() {
  const [rows] = await query(
    `SELECT whatsapp
     FROM integrations
     WHERE userId = ?
     ORDER BY updatedAt DESC, id DESC
     LIMIT 1`,
    ['default']
  )
  const row = rows[0]
  if (!row) return null
  // Parse JSON string from MySQL
  return {
    whatsapp: typeof row.whatsapp === 'string' ? JSON.parse(row.whatsapp) : row.whatsapp
  }
}

export async function GET() {
  try {
    const integrations = await getStoredIntegrations()
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
      `https://graph.facebook.com/v22.0/${whatsapp.businessAccountId}/message_templates`,
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

      let guidance = 'Check your access token, business account ID, and Meta app permissions.'
      if (data.error?.code === 200) {
        guidance = 'Your token is missing required Meta permissions for template access.'
      } else if (data.error?.code === 100) {
        guidance = 'The WhatsApp business account ID appears invalid or inaccessible for this token.'
      }

      return NextResponse.json(
        {
          error: mapMetaAccessTokenError(data.error?.message || 'Failed to fetch templates from Meta.'),
          guidance
        },
        { status: response.status }
      )
    }

    const templates = Array.isArray(data.data) ? data.data : []
    const approvedTemplates = templates.filter((template) => template.status === 'APPROVED')

    return NextResponse.json(approvedTemplates)
  } catch (error) {
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
