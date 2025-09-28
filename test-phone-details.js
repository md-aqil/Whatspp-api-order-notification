// Test script to get phone number details including business account ID
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testPhoneDetails() {
  let client;
  try {
    console.log('Testing phone number details...');
    
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integration settings
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      console.log('WhatsApp not properly configured');
      return;
    }
    
    // Get phone number details
    const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.phoneNumberId}?access_token=${integrations.whatsapp.accessToken}&fields=id,name,business_account_id,verified_name,display_phone_number,quality_rating`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url);
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Phone number details:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing phone details:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testPhoneDetails();