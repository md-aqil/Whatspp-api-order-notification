import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

// MongoDB connection
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

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// WhatsApp API functions
async function sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData) {
  // Updated to use the same version as your working cURL command
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
  
  // Improved error handling to ensure we only return success when the message is actually sent
  if (!response.ok) {
    console.error('WhatsApp API Error:', data);
    throw new Error(data.error?.message || `WhatsApp API error: ${response.status} ${response.statusText}`)
  }
  
  // Additional validation that the message was accepted
  if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
    console.error('Unexpected WhatsApp API response:', data);
    throw new Error('WhatsApp API returned unexpected response format')
  }
  
  return data
}

// Function to save incoming WhatsApp messages to database
async function saveIncomingMessage(db, messageData) {
  console.log('saveIncomingMessage called with:', JSON.stringify(messageData, null, 2));
  
  // Extract data based on message type
  const { from, text, timestamp, type, image, document, audio, video, location, contacts } = messageData;
  
  // Create message object
  const message = {
    id: uuidv4(),
    userId: 'default',
    recipient: from, // This is the customer's phone number
    phone: from, // Also store phone number directly for easier querying
    message: '', // Will be populated based on message type
    isCustomer: true,
    timestamp: new Date(timestamp ? timestamp * 1000 : Date.now()), // Convert WhatsApp timestamp to JS Date
    whatsappMessageId: messageData.id,
    status: 'received',
    messageType: type || 'unknown'
  };
  
  // Handle different message types
  if (type === 'text' && text?.body) {
    message.message = text.body;
  } else if (type === 'image') {
    message.message = '[Image message received]';
  } else if (type === 'document') {
    message.message = '[Document message received]';
  } else if (type === 'audio') {
    message.message = '[Audio message received]';
  } else if (type === 'video') {
    message.message = '[Video message received]';
  } else if (type === 'location' && location) {
    message.message = `[Location: ${location.latitude}, ${location.longitude}]`;
  } else if (type === 'contacts' && contacts) {
    message.message = '[Contact information received]';
  } else {
    // Fallback for unknown message types
    message.message = '[Message received]';
    console.log('Unknown message type:', JSON.stringify(messageData, null, 2));
  }
  
  console.log('Saving message to database:', JSON.stringify(message, null, 2));
  
  // Save to database
  await db.collection('messages').insertOne(message);
  
  // Update or create chat in the chats collection
  const chat = await db.collection('chats').findOne({ phone: from });
  
  if (chat) {
    // Update existing chat
    await db.collection('chats').updateOne(
      { phone: from },
      {
        $set: {
          lastMessage: message.message,
          timestamp: message.timestamp,
          unread: chat.unread + 1
        }
      }
    );
  } else {
    // Create new chat
    await db.collection('chats').insertOne({
      id: uuidv4(),
      userId: 'default',
      phone: from,
      name: `Customer ${from}`, // This would ideally come from customer data
      lastMessage: message.message,
      timestamp: message.timestamp,
      unread: 1,
      avatar: `https://ui-avatars.com/api/?name=Customer&background=random`
    });
  }
  
  return message;
}

// Function to save outgoing WhatsApp messages to database
async function saveOutgoingMessage(db, to, messageText, whatsappResponse) {
  const message = {
    id: uuidv4(),
    userId: 'default',
    recipient: to,
    phone: to, // Also store phone number directly for easier querying
    message: messageText,
    isCustomer: false,
    timestamp: new Date(),
    whatsappMessageId: whatsappResponse.messages?.[0]?.id,
    status: 'sent'
  };
  
  await db.collection('messages').insertOne(message);
  
  // Update or create chat in the chats collection
  const chat = await db.collection('chats').findOne({ phone: to });
  
  if (chat) {
    // Update existing chat
    await db.collection('chats').updateOne(
      { phone: to },
      {
        $set: {
          lastMessage: messageText,
          timestamp: new Date()
        }
      }
    );
  } else {
    // Create new chat
    await db.collection('chats').insertOne({
      id: uuidv4(),
      userId: 'default',
      phone: to,
      name: `Customer ${to}`,
      lastMessage: messageText,
      timestamp: new Date(),
      unread: 0,
      avatar: `https://ui-avatars.com/api/?name=Customer&background=random`
    });
  }
  
  return message;
}

async function sendOrderStatusUpdate(phoneNumberId, accessToken, to, order, newStatus) {
  // Format the status message
  let statusMessage = '';
  let statusEmoji = '';
  
  switch(newStatus) {
    case 'fulfilled':
      statusEmoji = '✅';
      statusMessage = `Your order #${order.orderNumber} has been fulfilled and is on its way!`;
      break;
    case 'shipped':
      statusEmoji = '🚚';
      statusMessage = `Your order #${order.orderNumber} has been shipped!`;
      break;
    case 'cancelled':
      statusEmoji = '❌';
      statusMessage = `Your order #${order.orderNumber} has been cancelled.`;
      break;
    case 'refunded':
      statusEmoji = '💰';
      statusMessage = `Your order #${order.orderNumber} has been refunded.`;
      break;
    default:
      statusEmoji = '🔄';
      statusMessage = `Your order #${order.orderNumber} status has been updated to: ${newStatus}`;
  }
  
  const messageData = {
    messaging_product: "whatsapp",
    to: to.replace(/\D/g, ''),
    type: "text",
    text: {
      body: `${statusEmoji} *Order Status Update*

${statusMessage}

Thank you for your purchase!`
    }
  };

  return await sendWhatsAppMessage(phoneNumberId, accessToken, to, messageData);
}

// Shopify API functions
async function fetchShopifyProducts(shopDomain, accessToken) {
  const url = `https://${shopDomain}/admin/api/2023-10/products.json`
  
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify API error')
  }

  return data.products.map(product => ({
    id: product.id.toString(),
    title: product.title,
    description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 200),
    price: product.variants[0]?.price || '0.00',
    image: product.images[0]?.src,
    handle: product.handle
  }))
}

async function fetchShopifyOrders(shopDomain, accessToken) {
  const url = `https://${shopDomain}/admin/api/2023-10/orders.json?status=any`
  
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify API error')
  }

  // Transform Shopify orders to match our internal format
  return data.orders.map(order => ({
    id: `shopify-${order.id}`,
    userId: 'default',
    shopifyOrderId: order.id.toString(),
    orderNumber: order.order_number,
    customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
    customerEmail: order.customer?.email,
    customerPhone: order.customer?.phone,
    total: order.total_price,
    currency: order.currency,
    status: order.financial_status,
    lineItems: order.line_items || [],
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at || order.created_at)
  }))
}

async function fetchCompleteShopifyOrder(shopDomain, accessToken, orderId) {
  const url = `https://${shopDomain}/admin/api/2023-10/orders/${orderId}.json`;
  
  console.log(`Fetching complete order ${orderId} from Shopify API: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`Shopify API error fetching complete order ${orderId}:`, data.errors || response.status);
    throw new Error(data.errors || 'Shopify API error fetching complete order');
  }

  console.log(`Successfully fetched complete order ${orderId}`);
  return data.order;
}

async function createShopifyWebhook(shopDomain, accessToken, topic, webhookUrl) {
  const url = `https://${shopDomain}/admin/api/2023-10/webhooks.json`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook: {
        topic: topic,
        address: webhookUrl,
        format: 'json'
      }
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.errors || 'Shopify webhook creation error')
  }
  
  return data.webhook
}

// Stripe functions
async function createStripeCheckoutSession(lineItems, metadata) {
  // This would integrate with Stripe API
  // Placeholder for now
  const sessionId = uuidv4()
  const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`
  
  return {
    id: sessionId,
    url: checkoutUrl
  }
}

// Campaign functions
async function sendCampaignToRecipients(campaign, integrations, db) {
  const { whatsapp } = integrations
  let recipients = []
  
  // Determine recipients based on audience
  if (campaign.audience === 'all_customers') {
    // Get all customers from orders
    const orders = await db.collection('orders').find({ userId: 'default' }).toArray()
    recipients = [...new Set(orders.map(order => order.customerPhone).filter(phone => phone))]
  } else if (campaign.audience === 'recent_buyers') {
    // Get customers from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const orders = await db.collection('orders').find({ 
      userId: 'default',
      createdAt: { $gte: thirtyDaysAgo }
    }).toArray()
    recipients = [...new Set(orders.map(order => order.customerPhone).filter(phone => phone))]
  } else if (campaign.audience === 'custom') {
    recipients = campaign.recipients || []
  }

  // Send messages to all recipients
  const results = []
  for (const recipient of recipients) {
    try {
      const messageData = {
        messaging_product: "whatsapp",
        to: recipient.replace(/\D/g, ''),
        type: "text",
        text: {
          body: campaign.message
        }
      }

      console.log(`Sending message to ${recipient}...`);
      const result = await sendWhatsAppMessage(
        whatsapp.phoneNumberId,
        whatsapp.accessToken,
        recipient,
        messageData
      )
      console.log(`Message sent successfully to ${recipient}:`, result);

      results.push({
        recipient,
        success: true,
        messageId: result.messages?.[0]?.id
      })

      // Log the message
      await db.collection('messages').insertOne({
        id: uuidv4(),
        userId: 'default',
        campaignId: campaign.id,
        recipient,
        message: campaign.message,
        whatsappMessageId: result.messages?.[0]?.id,
        status: 'sent',
        sentAt: new Date()
      })

    } catch (error) {
      console.error(`Failed to send message to ${recipient}:`, error.message);
      results.push({
        recipient,
        success: false,
        error: error.message
      })
      
      // Log the error
      await db.collection('messages').insertOne({
        id: uuidv4(),
        userId: 'default',
        campaignId: campaign.id,
        recipient,
        message: campaign.message,
        status: 'failed',
        error: error.message,
        sentAt: new Date()
      })
    }
  }

  return results
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  // Fix the route construction to properly handle webhook paths
  const route = path.length > 0 ? `/${path.join('/')}` : '/'
  const method = request.method

  // Add debugging for route matching
  console.log(`Processing route: ${route}, method: ${method}, path array:`, path)
  console.log(`Full params:`, params)

  try {
    const db = await connectToMongo()

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "WhatsApp Commerce Hub API" }))
    }

    // Integrations endpoints
    if (route === '/integrations' && method === 'GET') {
      const integrations = await db.collection('integrations').findOne({ userId: 'default' })
      
      const defaultIntegrations = {
        whatsapp: { connected: false, data: {} },
        shopify: { connected: false, data: {} },
        stripe: { connected: false, data: {} }
      }

      if (integrations) {
        // Check if integrations are properly configured
        defaultIntegrations.whatsapp.connected = !!(integrations.whatsapp?.phoneNumberId && integrations.whatsapp?.accessToken)
        defaultIntegrations.shopify.connected = !!(integrations.shopify?.shopDomain && integrations.shopify?.accessToken)
        defaultIntegrations.stripe.connected = !!(integrations.stripe?.secretKey)
        
        // Return data without sensitive fields
        defaultIntegrations.whatsapp.data = {
          phoneNumberId: integrations.whatsapp?.phoneNumberId || '',
          businessAccountId: integrations.whatsapp?.businessAccountId || '',
          catalogId: integrations.whatsapp?.catalogId || '', // Add catalogId to the response
          webhookVerifyToken: integrations.whatsapp?.webhookVerifyToken || ''
        }
        defaultIntegrations.shopify.data = {
          shopDomain: integrations.shopify?.shopDomain || '',
          apiKey: integrations.shopify?.apiKey || ''
        }
        defaultIntegrations.stripe.data = {
          publishableKey: integrations.stripe?.publishableKey || ''
        }
      }

      return handleCORS(NextResponse.json(defaultIntegrations))
    }

    if (route === '/integrations' && method === 'POST') {
      const body = await request.json()
      const { type, data } = body

      if (!type || !data) {
        return handleCORS(NextResponse.json(
          { error: "Type and data are required" }, 
          { status: 400 }
        ))
      }

      // Test the integration before saving
      try {
        if (type === 'whatsapp' && data.phoneNumberId && data.accessToken) {
          // Test WhatsApp connection by getting phone number info
          const testUrl = `https://graph.facebook.com/v22.0/${data.phoneNumberId}`
          const testResponse = await fetch(testUrl, {
            headers: { 'Authorization': `Bearer ${data.accessToken}` }
          })
          if (!testResponse.ok) {
            throw new Error('Invalid WhatsApp credentials')
          }
        }

        if (type === 'shopify' && data.shopDomain && data.accessToken) {
          // Test Shopify connection
          await fetchShopifyProducts(data.shopDomain, data.accessToken)
        }

        if (type === 'stripe' && data.secretKey) {
          // Test Stripe connection (placeholder)
          if (!data.secretKey.startsWith('sk_')) {
            throw new Error('Invalid Stripe secret key format')
          }
        }
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Integration test failed: ${error.message}` }, 
          { status: 400 }
        ))
      }

      // Ensure WhatsApp configuration has the right structure
      if (type === 'whatsapp') {
        data.connected = !!(data.phoneNumberId && data.accessToken);
        // Ensure catalogId is properly handled
        if (data.catalogId === '') {
          delete data.catalogId;
        }
      }

      // Save integration
      await db.collection('integrations').updateOne(
        { userId: 'default' },
        { 
          $set: { 
            [`${type}`]: data,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      )

      return handleCORS(NextResponse.json({ success: true }))
    }

    // Setup webhooks endpoint
    if (route === '/setup-webhooks' && method === 'POST') {
      const integrations = await db.collection('integrations').findOne({ userId: 'default' });
      
      if (!integrations?.shopify?.shopDomain || !integrations?.shopify?.accessToken) {
        return handleCORS(NextResponse.json(
          { error: "Shopify not configured" }, 
          { status: 400 }
        ))
      }

      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/shopify`
        
        // Create webhooks for order creation and status updates
        const webhooks = [
          { topic: 'orders/create', address: webhookUrl },
          { topic: 'orders/updated', address: webhookUrl },
          { topic: 'orders/paid', address: webhookUrl },
          { topic: 'orders/fulfilled', address: webhookUrl },
          { topic: 'orders/cancelled', address: webhookUrl },
          // NEW: Add customer webhooks to capture phone numbers
          { topic: 'customers/create', address: webhookUrl },
          { topic: 'customers/update', address: webhookUrl }
        ];
        
        const createdWebhooks = [];
        
        for (const webhook of webhooks) {
          try {
            const createdWebhook = await createShopifyWebhook(
              integrations.shopify.shopDomain,
              integrations.shopify.accessToken,
              webhook.topic,
              webhook.address
            );
            
            createdWebhooks.push({
              webhookId: createdWebhook.id,
              topic: webhook.topic,
              address: webhook.address
            });
          } catch (error) {
            console.error(`Failed to create webhook for ${webhook.topic}:`, error.message);
            // Continue with other webhooks even if one fails
          }
        }

        // Save webhook info
        await db.collection('webhooks').updateOne(
          { userId: 'default', type: 'shopify' },
          { 
            $set: { 
              webhooks: createdWebhooks,
              createdAt: new Date()
            }
          },
          { upsert: true }
        )

        return handleCORS(NextResponse.json({ 
          success: true, 
          webhooks: createdWebhooks 
        }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to setup webhooks: ${error.message}` }, 
          { status: 400 }
        ))
      }
    }

    // Products endpoint
    if (route === '/products' && method === 'GET') {
      const integrations = await db.collection('integrations').findOne({ userId: 'default' })
      
      if (!integrations?.shopify?.shopDomain || !integrations?.shopify?.accessToken) {
        return handleCORS(NextResponse.json(
          { error: "Shopify not configured" }, 
          { status: 400 }
        ))
      }

      try {
        const products = await fetchShopifyProducts(
          integrations.shopify.shopDomain,
          integrations.shopify.accessToken
        )
        
        // Cache products in database
        await db.collection('products').updateOne(
          { userId: 'default' },
          { 
            $set: { 
              products,
              lastSync: new Date()
            }
          },
          { upsert: true }
        )

        return handleCORS(NextResponse.json(products))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: `Failed to fetch products: ${error.message}` }, 
          { status: 400 }
        ))
      }
    }

    // Campaigns endpoints
    if (route === '/campaigns' && method === 'GET') {
      try {
        const db = await connectToMongo();
        const campaigns = await db.collection('campaigns')
          .find({ userId: 'default' })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()

        const cleanedCampaigns = campaigns.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedCampaigns))
      } catch (error) {
        console.error('Failed to fetch campaigns:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch campaigns' },
          { status: 500 }
        ))
      }
    }

    if (route === '/campaigns' && method === 'POST') {
      try {
        const db = await connectToMongo();
        const body = await request.json()
        
        if (!body.name || !body.message) {
          return handleCORS(NextResponse.json(
            { error: "Campaign name and message are required" }, 
            { status: 400 }
          ))
        }

        const campaign = {
          id: uuidv4(),
          userId: 'default',
          name: body.name,
          message: body.message,
          audience: body.audience || 'all_customers',
          recipients: body.recipients || [],
          status: body.status || 'draft',
          createdAt: new Date()
        }

        await db.collection('campaigns').insertOne(campaign)
        
        const { _id, ...cleanedCampaign } = campaign
        return handleCORS(NextResponse.json(cleanedCampaign))
      } catch (error) {
        console.error('Failed to create campaign:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to create campaign' },
          { status: 500 }
        ))
      }
    }

    // Send campaign endpoint
    if (route.startsWith('/campaigns/') && route.endsWith('/send') && method === 'POST') {
      try {
        const db = await connectToMongo();
        const campaignId = route.split('/')[2]
        
        const campaign = await db.collection('campaigns').findOne({ 
          id: campaignId, 
          userId: 'default' 
        })
        
        if (!campaign) {
          return handleCORS(NextResponse.json(
            { error: "Campaign not found" }, 
            { status: 404 }
          ))
        }

        const integrations = await db.collection('integrations').findOne({ userId: 'default' })
        
        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { error: "WhatsApp not configured" }, 
            { status: 400 }
          ))
        }

        try {
          const results = await sendCampaignToRecipients(campaign, integrations, db)
          
          // Update campaign status
          await db.collection('campaigns').updateOne(
            { id: campaignId },
            { 
              $set: { 
                status: 'sent',
                sentAt: new Date(),
                results: results
              }
            }
          )

          return handleCORS(NextResponse.json({ 
            success: true, 
            results: results 
          }))

        } catch (error) {
          // Update campaign status to failed
          await db.collection('campaigns').updateOne(
            { id: campaignId },
            { 
              $set: { 
                status: 'failed',
                error: error.message,
                failedAt: new Date()
              }
            }
          )

          return handleCORS(NextResponse.json(
            { error: `Failed to send campaign: ${error.message}` }, 
            { status: 400 }
          ))
        }
      } catch (error) {
        console.error('Failed to send campaign:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to send campaign' },
          { status: 500 }
        ))
      }
    }

    // Delete campaign endpoint
    if (route.startsWith('/campaigns/') && method === 'DELETE') {
      try {
        const db = await connectToMongo();
        const campaignId = route.split('/')[2]
        
        const result = await db.collection('campaigns').deleteOne({ 
          id: campaignId, 
          userId: 'default' 
        })
        
        if (result.deletedCount === 0) {
          return handleCORS(NextResponse.json(
            { error: "Campaign not found" }, 
            { status: 404 }
          ))
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('Failed to delete campaign:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to delete campaign' },
          { status: 500 }
        ))
      }
    }

    // Orders endpoint
    if (route === '/orders' && method === 'GET') {
      try {
        const db = await connectToMongo();
        // Try to fetch orders from Shopify if integration is configured
        const integrations = await db.collection('integrations').findOne({ userId: 'default' })
        
        if (integrations?.shopify?.shopDomain && integrations?.shopify?.accessToken) {
          try {
            // Fetch orders directly from Shopify
            const shopifyOrders = await fetchShopifyOrders(
              integrations.shopify.shopDomain,
              integrations.shopify.accessToken
            )
            
            // Return Shopify orders
            return handleCORS(NextResponse.json(shopifyOrders))
          } catch (error) {
            console.error('Failed to fetch Shopify orders:', error)
            // Fall back to database orders if Shopify fetch fails
          }
        }
        
        // Fall back to database orders
        const orders = await db.collection('orders')
          .find({ userId: 'default' })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()

        const cleanedOrders = orders.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedOrders))
      } catch (error) {
        console.error('Failed to fetch orders:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch orders' },
          { status: 500 }
        ))
      }
    }

    // Update the send catalog endpoint to support template selection and multiple recipients
    if (route === '/send-catalog' && method === 'POST') {
      try {
        const db = await connectToMongo();
        const body = await request.json();
        const { products: productIds, recipient, recipients, templateName } = body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
          return handleCORS(NextResponse.json(
            { error: "Products array is required" }, 
            { status: 400 }
          ));
        }

        // Handle both single recipient and multiple recipients
        let recipientList = [];
        if (recipients && Array.isArray(recipients) && recipients.length > 0) {
          recipientList = recipients;
        } else if (recipient) {
          // Support both single recipient and comma-separated recipients
          recipientList = recipient.split(',').map(r => r.trim()).filter(r => r);
        } else {
          return handleCORS(NextResponse.json(
            { error: "Recipient phone number(s) required" }, 
            { status: 400 }
          ));
        }

        // Get integrations
        const integrations = await db.collection('integrations').findOne({ userId: 'default' });
        
        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { error: "WhatsApp not configured" }, 
            { status: 400 }
          ));
        }

        // Get products
        const productsData = await db.collection('products').findOne({ userId: 'default' });
        if (!productsData) {
          return handleCORS(NextResponse.json(
            { error: "No products found. Please sync products first." }, 
            { status: 400 }
          ));
        }

        const selectedProducts = productsData.products.filter(p => productIds.includes(p.id));
        
        if (selectedProducts.length === 0) {
          return handleCORS(NextResponse.json(
            { error: "Selected products not found" }, 
            { status: 400 }
          ));
        }

        // Send to each recipient
        const results = [];
        for (const recipient of recipientList) {
          try {
            // Validate and format phone number
            const formattedRecipient = recipient.replace(/\D/g, '');
            
            // Log the recipient number for debugging
            console.log(`Sending catalog to: ${recipient}, formatted: ${formattedRecipient}`);
            
            // Check if the number seems valid
            if (formattedRecipient.length < 10) {
              results.push({
                recipient: recipient,
                success: false,
                error: "Invalid phone number format. Please include country code."
              });
              continue;
            }

            // Check if we're using a template
            if (templateName) {
              // Send using the selected template
              const messageData = {
                messaging_product: "whatsapp",
                to: formattedRecipient,
                type: "template",
                template: {
                  name: templateName,
                  language: {
                    code: "en"
                  },
                  components: [
                    {
                      type: "body",
                      parameters: [
                        {
                          type: "text",
                          text: selectedProducts.length.toString()
                        }
                      ]
                    }
                  ]
                }
              };

              const result = await sendWhatsAppMessage(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                formattedRecipient,
                messageData
              );

              // Log the message
              await db.collection('messages').insertOne({
                id: uuidv4(),
                userId: 'default',
                recipient: formattedRecipient,
                products: selectedProducts,
                template: templateName,
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              });

              results.push({
                recipient: recipient,
                success: true,
                messageId: result.messages?.[0]?.id
              });
            } else {
              // Use the existing text-based approach
              const hasCatalogId = integrations.whatsapp.catalogId;
              
              // Always use text-based messages to avoid template approval requirements
              // Create a catalog link
              const businessAccountId = integrations.whatsapp.businessAccountId || integrations.whatsapp.phoneNumberId;
              const catalogLink = `https://wa.me/c/${businessAccountId}`;
              
              // Create a message that includes information about selected products with images
              let productInfo = "Selected products:\n";
              selectedProducts.slice(0, 3).forEach((product, index) => {
                let productEntry = `${index + 1}. *${product.title}* - $${product.price}\n`;
                if (product.image) {
                  productEntry += `   📷 Image: ${product.image}\n`;
                }
                if (product.description) {
                  productEntry += `   📝 ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}\n`;
                }
                productInfo += productEntry + "\n";
              });
              if (selectedProducts.length > 3) {
                productInfo += `...and ${selectedProducts.length - 3} more items\n`;
              }
              
              const catalogMessage = `🛍️ *Our Product Catalog*

Check out our latest products:
${catalogLink}

${productInfo}Browse our full collection and find something special just for you!

🛍️ *Shop Now* - Click the link above to browse our catalog with images`;

              const messageData = {
                messaging_product: "whatsapp",
                to: formattedRecipient,
                type: "text",
                text: {
                  body: catalogMessage,
                  preview_url: true
                }
              };

              console.log('Sending message with data:', JSON.stringify(messageData, null, 2));

              const result = await sendWhatsAppMessage(
                integrations.whatsapp.phoneNumberId,
                integrations.whatsapp.accessToken,
                formattedRecipient,
                messageData
              );

              console.log('WhatsApp API response:', JSON.stringify(result, null, 2));

              // Log the message
              await db.collection('messages').insertOne({
                id: uuidv4(),
                userId: 'default',
                recipient: formattedRecipient,
                products: selectedProducts,
                whatsappMessageId: result.messages?.[0]?.id,
                status: 'sent',
                sentAt: new Date()
              });

              results.push({
                recipient: recipient,
                success: true,
                messageId: result.messages?.[0]?.id
              });
            }
          } catch (error) {
            console.error(`Failed to send catalog message to ${recipient}:`, error);
            results.push({
              recipient: recipient,
              success: false,
              error: error.message || 'Failed to send message'
            });
          }
        }

        // Return results
        const successfulSends = results.filter(r => r.success).length;
        const failedSends = results.filter(r => !r.success).length;
        
        return handleCORS(NextResponse.json({ 
          success: successfulSends > 0,
          sentCount: successfulSends,
          failedCount: failedSends,
          results: results
        }));
      } catch (error) {
        console.error('Failed to send catalog:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to send catalog' },
          { status: 500 }
        ));
      }
    }

    // New endpoint to fetch WhatsApp templates
    if (route === '/whatsapp-templates' && method === 'GET') {
      try {
        const db = await connectToMongo();
        
        // Get WhatsApp integration details
        const integrations = await db.collection('integrations').findOne({ userId: 'default' });
        
        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { 
              error: "WhatsApp not configured properly. Missing phone number ID or access token.",
              guidance: "Please check your WhatsApp integration settings in the dashboard."
            },
            { status: 400 }
          ));
        }

        // Use the business account ID from integration settings
        const businessAccountId = integrations.whatsapp.businessAccountId;
        
        if (!businessAccountId) {
          return handleCORS(NextResponse.json(
            { 
              error: "Business account ID not found in integration settings",
              guidance: "Please ensure your WhatsApp Business Account is properly configured."
            },
            { status: 400 }
          ));
        }

        // Fetch templates from WhatsApp API using the business account ID
        const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;
        
        const templateResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${integrations.whatsapp.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await templateResponse.json();
        
        if (!templateResponse.ok) {
          console.error('WhatsApp Templates API Error:', data);
          
          // Provide more detailed error information
          let errorMessage = "Failed to fetch templates from WhatsApp API";
          let guidance = "";
          
          if (data.error?.code === 100) {
            if (data.error?.message?.includes('message_templates')) {
              errorMessage = "Unable to access message templates";
              guidance = "Your business account may not have the required permissions or the account ID may be incorrect.";
            } else {
              errorMessage = "Invalid request to WhatsApp API";
              guidance = "There may be an issue with your business account configuration.";
            }
          } else if (data.error?.code === 200) {
            errorMessage = "Insufficient permissions";
            guidance = "Your access token may not have the required business_management permissions.";
          }
          
          // Return an empty array with error details instead of an error to allow the UI to still function
          return handleCORS(NextResponse.json({
            data: [],
            error: errorMessage,
            guidance: guidance,
            apiError: data.error
          }));
        }

        // Filter for approved templates only
        const approvedTemplates = data.data?.filter(template => 
          template.status === 'APPROVED'
        ) || [];

        return handleCORS(NextResponse.json(approvedTemplates));
      } catch (error) {
        console.error('Failed to fetch WhatsApp templates:', error);
        return handleCORS(NextResponse.json(
          { 
            error: 'Failed to fetch WhatsApp templates',
            guidance: "Please check your internet connection and WhatsApp integration settings.",
            technicalError: error.message
          },
          { status: 500 }
        ));
      }
    }

    // Webhook endpoint for WhatsApp
    if (route === '/webhook/whatsapp' && method === 'GET') {
      try {
        const db = await connectToMongo();
        const verifyToken = request.nextUrl.searchParams.get('hub.verify_token')
        const challenge = request.nextUrl.searchParams.get('hub.challenge')
        
        const integrations = await db.collection('integrations').findOne({ userId: 'default' })
        const expectedToken = integrations?.whatsapp?.webhookVerifyToken
        
        if (verifyToken === expectedToken) {
          return handleCORS(new NextResponse(challenge))
        } else {
          return handleCORS(new NextResponse('Forbidden', { status: 403 }))
        }
      } catch (error) {
        console.error('WhatsApp webhook verification error:', error)
        return handleCORS(new NextResponse('Internal server error', { status: 500 }))
      }
    }

    if (route === '/webhook/whatsapp' && method === 'POST') {
      try {
        const db = await connectToMongo();
        const body = await request.json()
        
        // Log webhook for debugging
        await db.collection('webhook_logs').insertOne({
          id: uuidv4(),
          type: 'whatsapp',
          payload: body,
          receivedAt: new Date()
        })
        
        console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));
        
        // Process incoming WhatsApp messages
        if (body.entry && Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            if (entry.changes && Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                console.log('Processing change:', JSON.stringify(change, null, 2));
                
                // Handle incoming messages
                if (change.field === 'messages') {
                  // Check for actual messages
                  if (change.value?.messages && Array.isArray(change.value.messages)) {
                    console.log('Processing incoming messages');
                    for (const message of change.value.messages) {
                      console.log('Saving incoming message:', JSON.stringify(message, null, 2));
                      // Save incoming message to database
                      await saveIncomingMessage(db, message)
                    }
                  }
                  
                  // Handle message statuses (delivery/read receipts)
                  if (change.value?.statuses && Array.isArray(change.value.statuses)) {
                    console.log('Processing message statuses');
                    for (const status of change.value.statuses) {
                      console.log('Message status update:', JSON.stringify(status, null, 2));
                      // We could save status updates to a separate collection if needed
                      // For now, we'll just log them
                    }
                  }
                  
                  // Handle contacts (new conversations)
                  if (change.value?.contacts && Array.isArray(change.value.contacts)) {
                    console.log('Processing contacts');
                    for (const contact of change.value.contacts) {
                      console.log('New contact:', JSON.stringify(contact, null, 2));
                      // We could save contact information if needed
                    }
                  }
                }
              }
            }
          }
        }
        
        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('WhatsApp webhook processing error:', error)
        // Always return success to WhatsApp even if we have errors
        // This prevents WhatsApp from retrying the webhook
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // Webhook endpoint for Shopify
    // Fixed the route matching to properly handle webhook paths
    if (route === '/webhook/shopify' && method === 'POST') {
      try {
        const db = await connectToMongo();
        const body = await request.json()
        const topic = request.headers.get('x-shopify-topic')
        
        // Log webhook for debugging
        await db.collection('webhook_logs').insertOne({
          id: uuidv4(),
          type: 'shopify',
          topic: topic,
          payload: body,
          receivedAt: new Date()
        })

        // Process different Shopify webhook topics
        if (topic === 'orders/create' && body.id) {
          // Log detailed information about the incoming order
          console.log(`=== NEW ORDER RECEIVED ===`);
          console.log(`Order Number: ${body.order_number}`);
          console.log(`Order ID: ${body.id}`);
          console.log(`Customer ID: ${body.customer?.id}`);
          console.log(`Customer Email: ${body.customer?.email}`);
          
          // Enhanced order creation logic to handle missing customer data
          // Look for phone number in multiple places
          let customerPhone = null;
          
          // Log what data we received
          console.log(`Received customer data:`, JSON.stringify(body.customer, null, 2));
          console.log(`Received shipping address:`, JSON.stringify(body.shipping_address, null, 2));
          console.log(`Received billing address:`, JSON.stringify(body.billing_address, null, 2));
          
          // Check customer object
          if (body.customer && body.customer.phone) {
            customerPhone = body.customer.phone;
            console.log(`Found phone in customer.phone: ${customerPhone}`);
          }
          // Check shipping address
          else if (body.shipping_address && body.shipping_address.phone) {
            customerPhone = body.shipping_address.phone;
            console.log(`Found phone in shipping_address.phone: ${customerPhone}`);
          }
          // Check billing address
          else if (body.billing_address && body.billing_address.phone) {
            customerPhone = body.billing_address.phone;
            console.log(`Found phone in billing_address.phone: ${customerPhone}`);
          }
          
          // NEW: Additional check for phone numbers in address fields
          // Sometimes Shopify doesn't send phone in dedicated phone field but in address fields
          if (!customerPhone) {
            console.log('Checking for phone numbers in name/address fields...');
            
            // Check if phone is in shipping address fields
            if (body.shipping_address) {
              // Look for phone in first_name, last_name, or address fields as a fallback
              const shippingFields = [
                body.shipping_address.first_name,
                body.shipping_address.last_name,
                body.shipping_address.address1,
                body.shipping_address.address2
              ];
              
              console.log('Shipping address fields to check:', shippingFields);
              
              for (const field of shippingFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in shipping address field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }
            
            // Check if phone is in billing address fields
            if (!customerPhone && body.billing_address) {
              const billingFields = [
                body.billing_address.first_name,
                body.billing_address.last_name,
                body.billing_address.address1,
                body.billing_address.address2
              ];
              
              console.log('Billing address fields to check:', billingFields);
              
              for (const field of billingFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in billing address field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }
            
            // Check if phone is in customer name fields
            if (!customerPhone && body.customer) {
              const customerFields = [
                body.customer.first_name,
                body.customer.last_name
              ];
              
              console.log('Customer name fields to check:', customerFields);
              
              for (const field of customerFields) {
                if (field && typeof field === 'string') {
                  // Look for common phone number patterns
                  const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                  if (phoneMatch) {
                    customerPhone = phoneMatch[0];
                    console.log(`Found phone number in customer name field: ${customerPhone}`);
                    break;
                  }
                }
              }
            }
          }
          
          // NEW: If still no phone found, check our customer database for regular customers
          if (!customerPhone && body.customer && body.customer.id) {
            try {
              console.log(`No phone found in webhook data for order ${body.order_number}, checking customer database for regular customer`);
              const customerRecord = await db.collection('shopify_customers').findOne({ 
                customerId: body.customer.id.toString() 
              });
              
              if (customerRecord && customerRecord.phone) {
                customerPhone = customerRecord.phone;
                console.log(`Found phone in customer database for regular customer: ${customerPhone}`);
              } else {
                console.log('No customer record found in database or no phone in record for regular customer');
              }
            } catch (dbError) {
              console.error('Error checking customer database for regular customer:', dbError.message);
            }
          }
          
          // NEW: If still no phone found, check our customer database for guest customers
          if (!customerPhone && body.customer && body.customer.id) {
            try {
              console.log(`No phone found for regular customer, checking customer database for guest customer`);
              const guestCustomerRecord = await db.collection('shopify_customers').findOne({ 
                customerId: `guest-${body.customer.id.toString()}` 
              });
              
              if (guestCustomerRecord && guestCustomerRecord.phone) {
                customerPhone = guestCustomerRecord.phone;
                console.log(`Found phone in customer database for guest customer: ${customerPhone}`);
              } else {
                console.log('No customer record found in database or no phone in record for guest customer');
              }
            } catch (dbError) {
              console.error('Error checking customer database for guest customer:', dbError.message);
            }
          }
          
          // NEW: If still no phone found, fetch complete order from Shopify API
          if (!customerPhone) {
            try {
              console.log(`No phone found in webhook data for order ${body.order_number}, fetching complete order from Shopify API`);
              const integrations = await db.collection('integrations').findOne({ userId: 'default' });
              
              if (integrations?.shopify?.shopDomain && integrations?.shopify?.accessToken) {
                const completeOrder = await fetchCompleteShopifyOrder(
                  integrations.shopify.shopDomain,
                  integrations.shopify.accessToken,
                  body.id
                );
                
                console.log(`Complete order fetched for order ${body.order_number}`);
                
                // Log what data we received from the complete order
                console.log(`Complete order customer data:`, JSON.stringify(completeOrder.customer, null, 2));
                console.log(`Complete order shipping address:`, JSON.stringify(completeOrder.shipping_address, null, 2));
                console.log(`Complete order billing address:`, JSON.stringify(completeOrder.billing_address, null, 2));
                
                // Try to find phone in the complete order data
                if (completeOrder.customer && completeOrder.customer.phone) {
                  customerPhone = completeOrder.customer.phone;
                  console.log(`Found phone in complete order customer data: ${customerPhone}`);
                } else if (completeOrder.shipping_address && completeOrder.shipping_address.phone) {
                  customerPhone = completeOrder.shipping_address.phone;
                  console.log(`Found phone in complete order shipping address: ${customerPhone}`);
                } else if (completeOrder.billing_address && completeOrder.billing_address.phone) {
                  customerPhone = completeOrder.billing_address.phone;
                  console.log(`Found phone in complete order billing address: ${customerPhone}`);
                }
                
                // If still not found, check for phone numbers in name/address fields of complete order
                if (!customerPhone) {
                  console.log('Checking complete order for phone numbers in name/address fields');
                  
                  // Check shipping address fields
                  if (completeOrder.shipping_address) {
                    const shippingFields = [
                      completeOrder.shipping_address.first_name,
                      completeOrder.shipping_address.last_name,
                      completeOrder.shipping_address.address1,
                      completeOrder.shipping_address.address2
                    ];
                    
                    console.log('Shipping address fields to check:', shippingFields);
                    
                    for (const field of shippingFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order shipping address field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }
                  
                  // Check billing address fields
                  if (!customerPhone && completeOrder.billing_address) {
                    const billingFields = [
                      completeOrder.billing_address.first_name,
                      completeOrder.billing_address.last_name,
                      completeOrder.billing_address.address1,
                      completeOrder.billing_address.address2
                    ];
                    
                    console.log('Billing address fields to check:', billingFields);
                    
                    for (const field of billingFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order billing address field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }
                  
                  // Check customer name fields
                  if (!customerPhone && completeOrder.customer) {
                    const customerFields = [
                      completeOrder.customer.first_name,
                      completeOrder.customer.last_name
                    ];
                    
                    console.log('Customer name fields to check:', customerFields);
                    
                    for (const field of customerFields) {
                      if (field && typeof field === 'string') {
                        const phoneMatch = field.match(/(\+?\d{10,15})|(\d{10})/);
                        if (phoneMatch) {
                          customerPhone = phoneMatch[0];
                          console.log(`Found phone number in complete order customer name field: ${customerPhone}`);
                          break;
                        }
                      }
                    }
                  }
                }
              } else {
                console.log('Shopify integration not configured, cannot fetch complete order');
              }
            } catch (fetchError) {
              console.error('Error fetching complete order from Shopify API:', fetchError.message);
            }
          }

          const order = {
            id: uuidv4(),
            userId: 'default',
            shopifyOrderId: body.id.toString(),
            orderNumber: body.order_number || body.name,
            customerName: body.customer ? 
              `${body.customer.first_name || ''} ${body.customer.last_name || ''}`.trim() : 
              'Unknown Customer',
            customerEmail: body.customer ? body.customer.email : null,
            customerPhone: customerPhone,
            total: body.total_price,
            currency: body.currency,
            status: body.financial_status || 'pending',
            lineItems: body.line_items || [],
            createdAt: new Date(body.created_at),
            whatsappSent: false
          }

          // Save order to database
          await db.collection('orders').insertOne(order)
      
          console.log(`=== ORDER PROCESSING COMPLETE ===`);
          console.log(`Order ${order.orderNumber} saved.`);
          console.log(`Customer phone: ${customerPhone ? customerPhone : 'NOT FOUND'}`);
          console.log(`WhatsApp notification: ${customerPhone ? 'WILL BE SENT' : 'SKIPPED (no phone)'}`);

          // Send WhatsApp confirmation to customer if phone number exists
          if (customerPhone) {
            const integrations = await db.collection('integrations').findOne({ userId: 'default' })
            
            if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
              try {
                const confirmationMessage = `🎉 *Order Confirmation*\n\n` +
                  `Thank you for your order, ${order.customerName}!\n\n` +
                  `📋 Order #${order.orderNumber}\n` +
                  `💰 Total: ${order.currency} ${order.total}\n` +
                  `📦 Status: Processing\n\n` +
                  `We'll send you updates as your order progresses. Thank you for choosing us! 🙏`

                const messageData = {
                  messaging_product: "whatsapp",
                  to: customerPhone.replace(/\D/g, ''),
                  type: "text",
                  text: {
                    body: confirmationMessage
                  }
                }

                const result = await sendWhatsAppMessage(
                  integrations.whatsapp.phoneNumberId,
                  integrations.whatsapp.accessToken,
                  customerPhone,
                  messageData
                )

                // Update order to mark WhatsApp as sent
                await db.collection('orders').updateOne(
                  { id: order.id },
                  { 
                    $set: { 
                      whatsappSent: true,
                      whatsappMessageId: result.messages?.[0]?.id,
                      whatsappSentAt: new Date()
                    }
                  }
                )

                // Log the message
                await db.collection('messages').insertOne({
                  id: uuidv4(),
                  userId: 'default',
                  orderId: order.id,
                  recipient: customerPhone,
                  message: confirmationMessage,
                  whatsappMessageId: result.messages?.[0]?.id,
                  status: 'sent',
                  sentAt: new Date()
                })
                
                console.log(`WhatsApp confirmation sent for order ${order.orderNumber}`);

              } catch (whatsappError) {
                console.error('Failed to send WhatsApp confirmation:', whatsappError)
                // Don't fail the webhook if WhatsApp fails
              }
            } else {
              console.log('WhatsApp not configured, skipping notification');
            }
          } else {
            console.log(`No phone number found for order ${order.orderNumber}, skipping WhatsApp notification`);
          }
        } 
        // Handle order status updates
        else if (topic && topic.startsWith('orders/') && body.id) {
          // Get the order from our database
          const existingOrder = await db.collection('orders').findOne({ 
            shopifyOrderId: body.id.toString() 
          })
          
          if (existingOrder) {
            // Extract the status from the topic (orders/fulfilled -> fulfilled)
            const newStatus = topic.replace('orders/', '')
            
            // Update order in database
            await db.collection('orders').updateOne(
              { shopifyOrderId: body.id.toString() },
              { 
                $set: { 
                  status: newStatus,
                  updatedAt: new Date()
                }
              }
            )
            
            // Send WhatsApp notification if customer phone exists and status has changed
            if (existingOrder.customerPhone && existingOrder.status !== newStatus) {
              const integrations = await db.collection('integrations').findOne({ userId: 'default' })
              
              if (integrations?.whatsapp?.phoneNumberId && integrations?.whatsapp?.accessToken) {
                try {
                  // Send status update notification
                  const result = await sendOrderStatusUpdate(
                    integrations.whatsapp.phoneNumberId,
                    integrations.whatsapp.accessToken,
                    existingOrder.customerPhone,
                    existingOrder,
                    newStatus
                  )
                  
                  // Log the message
                  await db.collection('messages').insertOne({
                    id: uuidv4(),
                    userId: 'default',
                    orderId: existingOrder.id,
                    recipient: existingOrder.customerPhone,
                    message: `Order status update: ${newStatus}`,
                    whatsappMessageId: result.messages?.[0]?.id,
                    status: 'sent',
                    sentAt: new Date()
                  })
                  
                  console.log(`WhatsApp status update sent for order ${existingOrder.orderNumber} (${newStatus})`);
                  
                } catch (whatsappError) {
                  console.error('Failed to send WhatsApp status update:', whatsappError)
                  // Don't fail the webhook if WhatsApp fails
                }
              }
            }
          }
        }

        return handleCORS(NextResponse.json({ success: true }))
      } catch (error) {
        console.error('Shopify webhook processing error:', error)
        // Always return success to Shopify even if we have errors
        // This prevents Shopify from retrying the webhook
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // Add a specific handler for debugging the route
    if (route === '/webhook/shopify' && method === 'GET') {
      return handleCORS(NextResponse.json({ 
        message: "Shopify webhook endpoint is working", 
        method: "GET",
        note: "Shopify webhooks use POST method"
      }))
    }

    // New endpoint to send WhatsApp messages from the dashboard
    if (route === '/send-whatsapp-message' && method === 'POST') {
      try {
        const db = await connectToMongo();
        const body = await request.json()
        const { to, message } = body

        if (!to || !message) {
          return handleCORS(NextResponse.json(
            { error: "Recipient and message are required" },
            { status: 400 }
          ))
        }

        // Get WhatsApp integration details
        const integrations = await db.collection('integrations').findOne({ userId: 'default' })
        
        if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
          return handleCORS(NextResponse.json(
            { error: "WhatsApp not configured" },
            { status: 400 }
          ))
        }

        // Prepare message data
        const messageData = {
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ''), // Remove any non-digit characters
          type: "text",
          text: {
            body: message
          }
        }

        // Send message via WhatsApp API
        const result = await sendWhatsAppMessage(
          integrations.whatsapp.phoneNumberId,
          integrations.whatsapp.accessToken,
          to,
          messageData
        )

        // Save message to database
        const savedMessage = await saveOutgoingMessage(db, to, message, result)

        // Return the saved message object
        const messageResponse = {
          id: savedMessage.id,
          text: savedMessage.message,
          isCustomer: savedMessage.isCustomer,
          timestamp: savedMessage.timestamp,
          phone: savedMessage.phone
        }

        return handleCORS(NextResponse.json({ 
          success: true,
          message: messageResponse,
          messageId: result.messages?.[0]?.id 
        }))

      } catch (error) {
        console.error('Failed to send WhatsApp message:', error)
        return handleCORS(NextResponse.json(
          { error: `Failed to send message: ${error.message}` },
          { status: 500 }
        ))
      }
    }

    // New endpoint to get chats for the dashboard
    if (route === '/chats' && method === 'GET') {
      try {
        const db = await connectToMongo();
        const chats = await db.collection('chats')
          .find({ userId: 'default' })
          .sort({ timestamp: -1 })
          .toArray()

        const cleanedChats = chats.map(({ _id, ...rest }) => rest)
        return handleCORS(NextResponse.json(cleanedChats))
      } catch (error) {
        console.error('Failed to fetch chats:', error)
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch chats' },
          { status: 500 }
        ))
      }
    }

    // New endpoint to get messages for a specific chat
    if (route.startsWith('/chats/') && route.endsWith('/messages') && method === 'GET') {
      try {
        const db = await connectToMongo();
        const phone = route.split('/')[2]; // Extract phone number from route
        
        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Fetch all messages for this phone number (both incoming from customer and outgoing to customer)
        const messages = await db.collection('messages')
          .find({ 
            userId: 'default',
            $or: [
              { recipient: phone },  // Messages sent to customer
              { phone: phone }       // Messages received from customer
            ]
          })
          .sort({ timestamp: 1 })
          .toArray();

        // Transform messages to ensure consistent structure for the frontend
        const transformedMessages = messages.map(msg => {
          // For incoming messages (from customer)
          // If isCustomer is explicitly set to true, or if the phone field matches the chat phone (and it's not an outgoing message)
          if (msg.isCustomer === true || (msg.phone && msg.phone === phone && msg.recipient !== phone)) {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: true,
              timestamp: msg.timestamp || new Date(),
              phone: msg.phone || phone
            };
          }
          // For outgoing messages (to customer)
          // If isCustomer is explicitly set to false, or if the recipient field matches the chat phone (and it's not an incoming message)
          else if (msg.isCustomer === false || (msg.recipient && msg.recipient === phone && msg.phone !== phone)) {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: false,
              timestamp: msg.timestamp || new Date(),
              phone: msg.recipient || phone
            };
          }
          // Fallback - assume outgoing message if we can't determine
          else {
            return {
              id: msg.id || msg._id?.toString() || uuidv4(),
              text: msg.message || msg.text || '',
              isCustomer: false,
              timestamp: msg.timestamp || new Date(),
              phone: msg.recipient || msg.phone || phone
            };
          }
        });

        return handleCORS(NextResponse.json(transformedMessages));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch messages' },
          { status: 500 }
        ));
      }
    }

    // New endpoint to create a new chat
    if (route === '/chats' && method === 'POST') {
      try {
        const db = await connectToMongo();
        let body;
        try {
          body = await request.json();
        } catch (parseError) {
          console.error('Failed to parse JSON body:', parseError);
          return handleCORS(NextResponse.json(
            { error: "Invalid JSON in request body" },
            { status: 400 }
          ));
        }
        
        const { phone, name } = body;

        if (!phone) {
          return handleCORS(NextResponse.json(
            { error: "Phone number is required" },
            { status: 400 }
          ));
        }

        // Format the phone number
        const formattedPhone = phone.replace(/\D/g, '');

        // Check if chat already exists
        const existingChat = await db.collection('chats').findOne({ 
          userId: 'default',
          phone: formattedPhone 
        });

        if (existingChat) {
          return handleCORS(NextResponse.json(existingChat));
        }

        // Create new chat
        const newChat = {
          id: uuidv4(),
          userId: 'default',
          phone: formattedPhone,
          name: name || `Customer ${formattedPhone}`,
          lastMessage: 'Chat created',
          timestamp: new Date(),
          unread: 0,
          avatar: `https://ui-avatars.com/api/?name=${name || 'Customer'}&background=random`
        };

        await db.collection('chats').insertOne(newChat);

        const { _id, ...cleanedChat } = newChat;
        return handleCORS(NextResponse.json(cleanedChat));
      } catch (error) {
        console.error('Failed to create chat:', error);
        return handleCORS(NextResponse.json(
          { error: 'Failed to create chat' },
          { status: 500 }
        ));
      }
    }

    // Route not found
    console.log(`Route not found: ${route}, method: ${method}`)
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute