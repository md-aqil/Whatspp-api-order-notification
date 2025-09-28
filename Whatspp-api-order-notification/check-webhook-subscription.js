// Script to check WhatsApp webhook subscription
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkWebhookSubscription() {
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
    
    // Get current webhook subscription
    console.log('\nChecking current webhook subscription...');
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/subscribed_apps`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Current webhook subscription:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorData = await response.json();
      console.log('Failed to get webhook subscription:');
      console.log('Status:', response.status);
      console.log('Error:', JSON.stringify(errorData, null, 2));
    }
    
    // Also check the webhook itself
    console.log('\nChecking webhook configuration...');
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/whatsapp`;
    console.log('Webhook URL:', webhookUrl);
    
  } catch (error) {
    console.error('Error checking webhook subscription:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkWebhookSubscription();