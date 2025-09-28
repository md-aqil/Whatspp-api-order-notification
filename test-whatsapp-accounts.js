// Test script to get WhatsApp business accounts
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testWhatsAppAccounts() {
  let client;
  try {
    console.log('Testing WhatsApp business accounts...');
    
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
    
    // Get WhatsApp business accounts
    const url = `https://graph.facebook.com/v22.0/me?access_token=${integrations.whatsapp.accessToken}&fields=whatsapp_business_accounts{name,id,message_templates{name,id,status,category,components}}`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url);
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('WhatsApp business accounts:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing WhatsApp accounts:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWhatsAppAccounts();