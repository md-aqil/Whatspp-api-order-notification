import { NextResponse } from 'next/server'
import { buildMetaAuthHeaders, mapMetaAccessTokenError } from '@/lib/meta-auth'
import { queryOne } from '@/lib/postgres'

async function getStoredIntegrations() {
  return queryOne(
    `SELECT whatsapp
     FROM integrations
     WHERE "userId" = $1
     ORDER BY "updatedAt" DESC NULLS LAST, id DESC
     LIMIT 1`,
    ['default']
  )
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
