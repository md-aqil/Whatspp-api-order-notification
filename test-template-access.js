// Test script to try different template access methods
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testTemplateAccess() {
  let client;
  try {
    console.log('Testing template access methods...');
    
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
    
    const businessAccountId = integrations.whatsapp.businessAccountId || '665095226180028';
    
    // Try different methods to access templates
    
    // Method 1: Direct template access
    console.log('\n1. Trying direct template access...');
    const url1 = `https://graph.facebook.com/v22.0/${businessAccountId}?access_token=${integrations.whatsapp.accessToken}&fields=message_templates`;
    const response1 = await fetch(url1);
    console.log('Response status:', response1.status);
    
    if (response1.ok) {
      const data = await response1.json();
      console.log('Direct template access:', JSON.stringify(data, null, 2));
    } else {
      const error = await response1.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
    // Method 2: Try with different field names
    console.log('\n2. Trying with different field names...');
    const url2 = `https://graph.facebook.com/v22.0/${businessAccountId}?access_token=${integrations.whatsapp.accessToken}&fields=templates`;
    const response2 = await fetch(url2);
    console.log('Response status:', response2.status);
    
    if (response2.ok) {
      const data = await response2.json();
      console.log('Template access with "templates":', JSON.stringify(data, null, 2));
    } else {
      const error = await response2.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
    // Method 3: Try to list all available fields
    console.log('\n3. Trying to list all available fields...');
    const url3 = `https://graph.facebook.com/v22.0/${businessAccountId}?access_token=${integrations.whatsapp.accessToken}`;
    const response3 = await fetch(url3);
    console.log('Response status:', response3.status);
    
    if (response3.ok) {
      const data = await response3.json();
      console.log('Available fields:', JSON.stringify(data, null, 2));
    } else {
      const error = await response3.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
    // Method 4: Try the edge directly
    console.log('\n4. Trying edge access...');
    const url4 = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates?access_token=${integrations.whatsapp.accessToken}`;
    const response4 = await fetch(url4);
    console.log('Response status:', response4.status);
    
    if (response4.ok) {
      const data = await response4.json();
      console.log('Edge access:', JSON.stringify(data, null, 2));
    } else {
      const error = await response4.json();
      console.log('Error:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing template access:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testTemplateAccess();