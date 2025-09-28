// Test script to fetch message templates
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testMessageTemplates() {
  let client;
  try {
    console.log('Testing message templates...');
    
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integration settings
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp?.businessAccountId || !integrations?.whatsapp?.accessToken) {
      console.log('WhatsApp business account ID or access token not configured');
      return;
    }
    
    // Get message templates
    const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}/message_templates?access_token=${integrations.whatsapp.accessToken}`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url);
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Message templates:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing message templates:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testMessageTemplates();