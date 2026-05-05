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
    const body = await request.json()
    
    // Log for debugging
    await insertWebhookLog('zoho', 'crm_update', body)

    // Map Zoho fields to automation context
    const context = {
      customer_name: body.Last_Name || body.Full_Name || 'Zoho Lead',
      customer_phone: body.Phone || body.Mobile || '',
      zoho_lead_id: body.id || '',
      zoho_status: body.Lead_Status || body.Status || '',
      ...body // Include everything else as well
    }

    const integrations = await getStoredIntegrations()
    await triggerAutomationEvent('zoho.lead_updated', context, integrations)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Zoho webhook processing error:', error)
    return NextResponse.json({ success: true })
  }
}
