// Test script to check user's WhatsApp business accounts
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testUserWhatsAppAccounts() {
  let client;
  try {
    console.log('Testing user WhatsApp business accounts...');
    
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integration settings
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp?.accessToken) {
      console.log('WhatsApp access token not configured');
      return;
    }
    
    // Get user ID first
    const meUrl = `https://graph.facebook.com/v22.0/me?access_token=${integrations.whatsapp.accessToken}`;
    const meResponse = await fetch(meUrl);
    
    if (!meResponse.ok) {
      const error = await meResponse.json();
      console.log('Error getting user ID:', JSON.stringify(error, null, 2));
      return;
    }
    
    const meData = await meResponse.json();
    const userId = meData.id;
    
    console.log('User ID:', userId);
    
    // Try to get WhatsApp business accounts
    console.log('\nTrying to get WhatsApp business accounts...');
    const url = `https://graph.facebook.com/v22.0/${userId}?access_token=${integrations.whatsapp.accessToken}&fields=whatsapp_business_accounts{id,name,message_templates}`;
    const response = await fetch(url);
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('User with WhatsApp business accounts:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing user WhatsApp accounts:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testUserWhatsAppAccounts();