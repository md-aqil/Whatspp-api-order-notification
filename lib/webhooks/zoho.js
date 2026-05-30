
import { NextResponse } from 'next/server'
import { 
  getStoredIntegrations 
} from '../db/integration-repository'
import { 
  insertWebhookLog,
  query,
  queryMany,
  queryOne
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
      const webhookTopic = request.method === 'GET' ? 'crm_get' : 'crm_post'

      // 1. Identify User (Priority: Query Param > Body > Matching Phone in Chats/Messages > Most recently updated Zoho integration > 'default')
      const url = new URL(request.url)
      let userId = url.searchParams.get('userId') || body.userId || null

      if (!userId) {
        const rawPhone = body.phone || body.Phone || body.Mobile || ''
        const phone = typeof rawPhone === 'string' ? rawPhone.replace(/\D/g, '') : ''
        if (phone) {
          const chatRow = await queryOne(
            `SELECT userId FROM chats WHERE phone = ? LIMIT 1`,
            [phone]
          )
          if (chatRow?.userId) {
            userId = chatRow.userId
          } else {
            const msgRow = await queryOne(
              `SELECT userId FROM messages WHERE phone = ? OR recipient = ? LIMIT 1`,
              [phone, phone]
            )
            if (msgRow?.userId) {
              userId = msgRow.userId
            }
          }
        }
      }

      if (!userId) {
        // Fallback to the user who has a Zoho integration configured (most recently updated)
        const zohoRows = await queryMany(
          `SELECT userId FROM integrations WHERE zoho IS NOT NULL AND zoho != 'null' ORDER BY updatedAt DESC LIMIT 1`
        )
        if (zohoRows.length > 0) {
          userId = zohoRows[0].userId
        }
      }

      userId = userId || 'default'

      await insertWebhookLog('zoho', webhookTopic, body, userId)

      const integrations = await getStoredIntegrations(userId)
      // We no longer require Zoho OAuth to be connected here since webhooks can function standalone

      // 2. Map Zoho fields to automation context (matching user screenshot)
      const context = {
        customer_name: (body.first_name || '') + ' ' + (body.last_name || body.Last_Name || body.Full_Name || 'Zoho Lead'),
        customer_phone: body.phone || body.Phone || body.Mobile || '',
        customerPhone: body.phone || body.Phone || body.Mobile || '',
        customerName: (body.first_name || '') + ' ' + (body.last_name || body.Last_Name || body.Full_Name || 'Zoho Lead'),
        zoho_lead_id: body.id || body.lead_id || '',
        zoho_status: body.Lead_Status || body.Status || body.status || '',
        ...body 
      }

      // 3. Upsert into Chats table (so it shows up in dashboard)
      if (context.customer_phone) {
        const phone = context.customer_phone.replace(/\D/g, '')
        await query(
          `INSERT INTO chats (id, userId, phone, name, lastMessage, timestamp, unread)
           VALUES (?, ?, ?, ?, ?, NOW(), 0)
           ON DUPLICATE KEY UPDATE name = VALUES(name), timestamp = NOW()`,
          [`${userId}:${phone}`, userId, phone, context.customer_name, 'New lead from Zoho CRM']
        )
      }

      await triggerAutomationEvent('zoho.lead_updated', context, integrations, userId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Zoho webhook processing error:', error)
    return NextResponse.json({ success: true })
  }
}
