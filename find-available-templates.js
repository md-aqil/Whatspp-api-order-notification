// Script to find available templates using different API approaches
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function findAvailableTemplates() {
  let client;
  try {
    console.log('Finding available templates...');
    
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
    
    const accessToken = integrations.whatsapp.accessToken;
    const businessAccountId = integrations.whatsapp.businessAccountId || '665095226180028';
    
    console.log('Testing with Business Account ID:', businessAccountId);
    
    // Method 1: Try getting business account info first
    console.log('\n1. Getting business account information...');
    const businessInfoUrl = `https://graph.facebook.com/v22.0/${businessAccountId}?access_token=${accessToken}`;
    const businessInfoResponse = await fetch(businessInfoUrl);
    const businessInfoData = await businessInfoResponse.json();
    
    if (businessInfoResponse.ok) {
      console.log('Business account info retrieved successfully');
      console.log('Available fields:', Object.keys(businessInfoData));
    } else {
      console.log('Failed to get business account info:', businessInfoData);
    }
    
    // Method 2: Try the message_templates edge directly
    console.log('\n2. Trying message_templates edge directly...');
    const templatesUrl = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates?access_token=${accessToken}`;
    const templatesResponse = await fetch(templatesUrl);
    const templatesData = await templatesResponse.json();
    
    if (templatesResponse.ok) {
      console.log('Templates retrieved successfully');
      console.log('Templates data:', JSON.stringify(templatesData, null, 2));
      return;
    } else {
      console.log('Failed to get templates via edge:', templatesData);
    }
    
    // Method 3: Try with WhatsApp Business Management API
    console.log('\n3. Trying WhatsApp Business Management API...');
    const wabaUrl = `https://graph.facebook.com/v22.0/${businessAccountId}/?access_token=${accessToken}&fields=account_review_status,business_verification_status,name,status,timezone_id,message_template_namespace`;
    const wabaResponse = await fetch(wabaUrl);
    const wabaData = await wabaResponse.json();
    
    if (wabaResponse.ok) {
      console.log('WABA info retrieved successfully');
      console.log('WABA data:', JSON.stringify(wabaData, null, 2));
    } else {
      console.log('Failed to get WABA info:', wabaData);
    }
    
    // Method 4: Try listing all connected WhatsApp business accounts
    console.log('\n4. Trying to list connected WhatsApp business accounts...');
    const phoneNumbersUrl = `https://graph.facebook.com/v22.0/${businessAccountId}/phone_numbers?access_token=${accessToken}`;
    const phoneNumbersResponse = await fetch(phoneNumbersUrl);
    const phoneNumbersData = await phoneNumbersResponse.json();
    
    if (phoneNumbersResponse.ok) {
      console.log('Phone numbers retrieved successfully');
      console.log('Phone numbers data:', JSON.stringify(phoneNumbersData, null, 2));
    } else {
      console.log('Failed to get phone numbers:', phoneNumbersData);
    }
    
  } catch (error) {
    console.error('Error finding templates:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

findAvailableTemplates();