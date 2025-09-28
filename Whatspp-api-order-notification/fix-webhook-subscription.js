// Script to fix WhatsApp webhook subscription
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fixWebhookSubscription() {
  let client;
  try {
    // Check database for integration settings
    console.log('Checking database for WhatsApp integration settings...');
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations || !integrations.whatsapp?.accessToken) {
      console.log('WhatsApp not properly configured');
      return;
    }
    
    const accessToken = integrations.whatsapp.accessToken;
    const phoneNumberId = integrations.whatsapp.phoneNumberId;
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/whatsapp`;
    
    console.log('Webhook URL:', webhookUrl);
    
    // According to Facebook's documentation, we need to subscribe the app to the phone number
    // This is done by making a POST request to the phone number's subscribed_apps endpoint
    console.log('\nSubscribing app to phone number for message events...');
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/subscribed_apps`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Successfully subscribed app to phone number:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorData = await response.json();
      console.log('Failed to subscribe app to phone number:');
      console.log('Status:', response.status);
      console.log('Error:', JSON.stringify(errorData, null, 2));
    }
    
  } catch (error) {
    console.error('Error fixing webhook subscription:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

fixWebhookSubscription();