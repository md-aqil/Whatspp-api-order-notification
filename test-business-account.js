// Test script to verify the WhatsApp business account
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testBusinessAccount() {
  let client;
  try {
    console.log('Testing WhatsApp business account...');
    
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integration settings
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp) {
      console.log('WhatsApp not configured');
      return;
    }
    
    console.log('WhatsApp integration settings:');
    console.log('Phone Number ID:', integrations.whatsapp.phoneNumberId);
    console.log('Business Account ID:', integrations.whatsapp.businessAccountId);
    console.log('Access Token:', integrations.whatsapp.accessToken ? '***REDACTED***' : 'NOT SET');
    
    // Test with business account ID
    if (integrations.whatsapp.businessAccountId) {
      console.log('\nTesting with Business Account ID...');
      const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${integrations.whatsapp.accessToken}`
        }
      });
      
      console.log('Business Account Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Business Account Data:', JSON.stringify(data, null, 2));
      } else {
        const error = await response.json();
        console.log('Business Account Error:', JSON.stringify(error, null, 2));
      }
    }
    
    // Test with phone number ID
    if (integrations.whatsapp.phoneNumberId) {
      console.log('\nTesting with Phone Number ID...');
      const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.phoneNumberId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${integrations.whatsapp.accessToken}`
        }
      });
      
      console.log('Phone Number Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Phone Number Data:', JSON.stringify(data, null, 2));
      } else {
        const error = await response.json();
        console.log('Phone Number Error:', JSON.stringify(error, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error testing business account:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testBusinessAccount();