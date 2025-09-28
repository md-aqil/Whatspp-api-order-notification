// Test script to check available fields on business account
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testBusinessFields() {
  let client;
  try {
    console.log('Testing business account fields...');
    
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
    
    // Get business account details
    const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}?access_token=${integrations.whatsapp.accessToken}`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url);
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Business account details:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing business fields:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testBusinessFields();