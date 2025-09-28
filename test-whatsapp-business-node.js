// Test script to check WhatsApp business node
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testWhatsAppBusinessNode() {
  let client;
  try {
    console.log('Testing WhatsApp business node...');
    
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
    
    // Try different node types for WhatsApp business
    
    // Try with whatsapp_business_account node type
    console.log('\n1. Trying whatsapp_business_account node type...');
    const url1 = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}?access_token=${integrations.whatsapp.accessToken}&fields=id,name`;
    const response1 = await fetch(url1);
    console.log('Response status:', response1.status);
    
    if (response1.ok) {
      const data = await response1.json();
      console.log('WhatsApp business account:', JSON.stringify(data, null, 2));
    } else {
      const error = await response1.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
    // Try to get available edges/connections
    console.log('\n2. Trying to get connections...');
    const url2 = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}/connections?access_token=${integrations.whatsapp.accessToken}`;
    const response2 = await fetch(url2);
    console.log('Response status:', response2.status);
    
    if (response2.ok) {
      const data = await response2.json();
      console.log('Connections:', JSON.stringify(data, null, 2));
    } else {
      const error = await response2.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing WhatsApp business node:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWhatsAppBusinessNode();