// Test script to check WhatsApp business account and templates
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testWhatsAppBusinessAccount() {
  let client;
  try {
    console.log('Testing WhatsApp business account...');
    
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
    
    // Try different approaches to get templates
    
    // Approach 1: Direct access to message_templates
    console.log('\n1. Trying direct message_templates access...');
    const url1 = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}/message_templates?access_token=${integrations.whatsapp.accessToken}`;
    const response1 = await fetch(url1);
    console.log('Response status:', response1.status);
    
    if (response1.ok) {
      const data = await response1.json();
      console.log('Templates:', JSON.stringify(data, null, 2));
    } else {
      const error = await response1.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
    // Approach 2: Get business account with message_templates field
    console.log('\n2. Trying business account with message_templates field...');
    const url2 = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}?access_token=${integrations.whatsapp.accessToken}&fields=name,message_templates`;
    const response2 = await fetch(url2);
    console.log('Response status:', response2.status);
    
    if (response2.ok) {
      const data = await response2.json();
      console.log('Business account with templates:', JSON.stringify(data, null, 2));
    } else {
      const error = await response2.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
    // Approach 3: Get all available fields
    console.log('\n3. Trying to get all available fields...');
    const url3 = `https://graph.facebook.com/v22.0/${integrations.whatsapp.businessAccountId}?access_token=${integrations.whatsapp.accessToken}&fields=id,name`;
    const response3 = await fetch(url3);
    console.log('Response status:', response3.status);
    
    if (response3.ok) {
      const data = await response3.json();
      console.log('Business account fields:', JSON.stringify(data, null, 2));
    } else {
      const error = await response3.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing WhatsApp business account:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWhatsAppBusinessAccount();