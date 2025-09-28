// Test script to debug WhatsApp API issues
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testWhatsAppAPI() {
  let client;
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    console.log('Connected to MongoDB successfully');
    
    // Get WhatsApp integration details
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      console.log('WhatsApp not configured');
      return;
    }
    
    console.log('WhatsApp integration details:');
    console.log('Phone Number ID:', integrations.whatsapp.phoneNumberId);
    console.log('Access Token:', integrations.whatsapp.accessToken ? '***REDACTED***' : 'NOT SET');
    
    // Test WhatsApp API directly
    const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.phoneNumberId}/messages`;
    const messageData = {
      messaging_product: "whatsapp",
      to: "1234567890", // Test number
      type: "text",
      text: {
        body: "Test message from debugging script"
      }
    };
    
    console.log('Sending test message to WhatsApp API...');
    console.log('URL:', url);
    console.log('Message data:', JSON.stringify(messageData, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integrations.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.log('WhatsApp API Error:', data);
    } else {
      console.log('Message sent successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWhatsAppAPI();