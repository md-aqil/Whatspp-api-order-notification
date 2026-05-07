import { NextResponse } from 'next/server'
import { 
  getStoredIntegrations 
} from '../db/integration-repository'
import { 
  insertWebhookLog 
} from '../mysql'
import { 
  triggerAutomationEvent 
} from '../automation-engine'

/**
 * Handler for Zoho CRM webhooks
 */
export async function handleZohoWebhook(request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let body = {}

    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      // Try parsing as JSON anyway, or fallback to query params
      try {
        body = await request.json()
      } catch (e) {
        const url = new URL(request.url)
        body = Object.fromEntries(url.searchParams.entries())
      }
    }
    
    // Log for debugging
    if (Object.keys(body).length > 0) {
      await insertWebhookLog('zoho', 'crm_update', body)

      // Map Zoho fields to automation context (matching user screenshot)
      const context = {
        customer_name: (body.first_name || '') + ' ' + (body.last_name || body.Last_Name || body.Full_Name || 'Zoho Lead'),
        customer_phone: body.phone || body.Phone || body.Mobile || '',
        customerPhone: body.phone || body.Phone || body.Mobile || '',
        customerName: (body.first_name || '') + ' ' + (body.last_name || body.Last_Name || body.Full_Name || 'Zoho Lead'),
        zoho_lead_id: body.id || body.lead_id || '',
        zoho_status: body.Lead_Status || body.Status || body.status || '',
        ...body 
      }

      const integrations = await getStoredIntegrations()
      await triggerAutomationEvent('zoho.lead_updated', context, integrations)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Zoho webhook processing error:', error)
    return NextResponse.json({ success: true })
  }
}
