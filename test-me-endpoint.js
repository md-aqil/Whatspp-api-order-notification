// Test script to get business account ID from me endpoint
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testMeEndpoint() {
  let client;
  try {
    console.log('Testing me endpoint...');
    
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
    
    // Get business accounts from me endpoint
    const url = `https://graph.facebook.com/v22.0/me?access_token=${integrations.whatsapp.accessToken}`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url);
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Me endpoint response:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing me endpoint:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testMeEndpoint();