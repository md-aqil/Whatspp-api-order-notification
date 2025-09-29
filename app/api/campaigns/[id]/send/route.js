import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

// Database connection
let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

// Function to send WhatsApp message
async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })

  const data = await response.json()
  
  if (!response.ok) {
    console.error('WhatsApp API Error:', data);
    throw new Error(data.error?.message || `WhatsApp API error: ${response.status} ${response.statusText}`)
  }
  
  if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
    console.error('Unexpected WhatsApp API response:', data);
    throw new Error('WhatsApp API returned unexpected response format')
  }
  
  return data
}

// POST /api/campaigns/[id]/send - Send a campaign
export async function POST(request, { params }) {
  try {
    const { id } = params
    const db = await connectToMongo()
    
    // Fetch the campaign from the database
    const campaign = await db.collection('campaigns').findOne({ 
      id: id, 
      userId: 'default' 
    })
    
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // Validate the campaign is in a sendable state
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Campaign is not in a sendable state' },
        { status: 400 }
      )
    }
    
    // Get integrations
    const integrations = await db.collection('integrations').findOne({ userId: 'default' })
    
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 }
      )
    }
    
    // Determine recipients
    let recipients = []
    if (campaign.audience === 'custom' && campaign.recipients && Array.isArray(campaign.recipients)) {
      recipients = campaign.recipients
    } else if (campaign.audience === 'custom' && campaign.recipientPhones) {
      // Support comma-separated phone numbers
      recipients = campaign.recipientPhones.split(',').map(p => p.trim()).filter(p => p)
    } else {
      // For demo purposes, we'll use a test phone number
      // In a real implementation, you would fetch actual customer phone numbers
      recipients = [process.env.TEST_PHONE_NUMBER || '+1234567890']
    }
    
    // Send the campaign to each recipient
    const results = []
    let successCount = 0
    let failureCount = 0
    
    for (const recipient of recipients) {
      try {
        // Validate and format phone number
        const formattedRecipient = recipient.replace(/\D/g, '')
        
        if (formattedRecipient.length < 10) {
          results.push({
            recipient: recipient,
            success: false,
            error: 'Invalid phone number format'
          })
          failureCount++
          continue
        }
        
        let messageData
        
        // Check if campaign uses a template
        if (campaign.template) {
          // Send using template
          messageData = {
            messaging_product: 'whatsapp',
            to: formattedRecipient,
            type: 'template',
            template: {
              name: campaign.template,
              language: {
                code: 'en'
              }
            }
          }
        } else {
          // Send using text message
          const messageBody = campaign.message || 'Hello! This is a campaign message.'
          
          if (!messageBody.trim()) {
            results.push({
              recipient: recipient,
              success: false,
              error: 'Message body is required when not using a template'
            })
            failureCount++
            continue
          }
          
          messageData = {
            messaging_product: 'whatsapp',
            to: formattedRecipient,
            type: 'text',
            text: {
              body: messageBody
            }
          }
        }
        
        // Send the message
        const result = await sendWhatsAppMessage(
          integrations.whatsapp.phoneNumberId,
          integrations.whatsapp.accessToken,
          formattedRecipient,
          messageData
        )
        
        results.push({
          recipient: recipient,
          success: true,
          messageId: result.messages?.[0]?.id
        })
        successCount++
      } catch (error) {
        console.error(`Failed to send campaign to ${recipient}:`, error)
        results.push({
          recipient: recipient,
          success: false,
          error: error.message || 'Failed to send message'
        })
        failureCount++
      }
    }
    
    // Determine overall campaign status
    let campaignStatus
    if (successCount > 0 && failureCount === 0) {
      campaignStatus = 'sent'
    } else if (successCount > 0 && failureCount > 0) {
      campaignStatus = 'partially_sent'
    } else {
      campaignStatus = 'failed'
    }
    
    // Update campaign status
    const updateData = {
      status: campaignStatus,
      sentAt: new Date(),
      results: results,
      sentCount: successCount,
      failedCount: failureCount
    }
    
    await db.collection('campaigns').updateOne(
      { id: id, userId: 'default' },
      { $set: updateData }
    )
    
    return NextResponse.json({ 
      success: successCount > 0,
      status: campaignStatus,
      message: `${successCount} messages sent successfully, ${failureCount} failed`,
      sentAt: new Date(),
      results: results
    })
  } catch (error) {
    console.error('Error sending campaign:', error)
    
    // Update campaign status to failed if there was a system error
    try {
      const db = await connectToMongo()
      await db.collection('campaigns').updateOne(
        { id: params.id, userId: 'default' },
        { $set: { status: 'failed', error: error.message } }
      )
    } catch (updateError) {
      console.error('Failed to update campaign status after error:', updateError)
    }
    
    return NextResponse.json(
      { error: 'Failed to send campaign', details: error.message },
      { status: 500 }
    )
  }
}