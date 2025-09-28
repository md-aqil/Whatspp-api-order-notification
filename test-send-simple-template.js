// Test script to send a simple template message
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testSendSimpleTemplate() {
  let client;
  try {
    console.log('Testing simple template message...');
    
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integration settings
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      console.log('WhatsApp not configured properly');
      return;
    }
    
    // Try to send a simple template message
    // We'll use a generic template structure
    const messageData = {
      messaging_product: "whatsapp",
      to: "1234567890", // Test number, replace with a valid number for real testing
      type: "template",
      template: {
        name: "hello_world", // This is a standard template that should be available
        language: {
          code: "en"
        }
      }
    };
    
    console.log('Sending template message with data:', JSON.stringify(messageData, null, 2));
    
    const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integrations.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Template message sent successfully:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error sending template message:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing simple template message:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testSendSimpleTemplate();