// Script to check WhatsApp configuration
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkWhatsAppConfig() {
  let client;
  try {
    // Check environment variables
    console.log('Environment variables:');
    console.log('MONGO_URL:', process.env.MONGO_URL);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('CORS_ORIGINS:', process.env.CORS_ORIGINS);
    
    // Check if required WhatsApp variables are set in environment
    const requiredVars = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('\nMissing environment variables:');
      missingVars.forEach(varName => console.log(`- ${varName}`));
    } else {
      console.log('\nAll required WhatsApp environment variables are set');
    }
    
    // Check database for integration settings
    console.log('\nChecking database for WhatsApp integration settings...');
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations) {
      console.log('No integrations found in database');
      return;
    }
    
    console.log('\nIntegration settings found:');
    console.log('WhatsApp connected:', integrations.whatsapp?.phoneNumberId ? 'Yes' : 'No');
    
    if (integrations.whatsapp?.phoneNumberId) {
      console.log('Phone Number ID:', integrations.whatsapp.phoneNumberId);
      console.log('Business Account ID:', integrations.whatsapp.businessAccountId || 'Not set');
      console.log('Webhook Verify Token:', integrations.whatsapp.webhookVerifyToken || 'Not set');
      
      // Test WhatsApp API connection
      const phoneNumberId = integrations.whatsapp.phoneNumberId;
      const accessToken = integrations.whatsapp.accessToken;
      
      if (accessToken) {
        console.log(`\nTesting connection to WhatsApp Business API...`);
        
        // Get phone number info
        const url = `https://graph.facebook.com/v17.0/${phoneNumberId}`;
        console.log(`Making request to: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('\nWhatsApp API connection successful!');
          console.log('Response:', JSON.stringify(data, null, 2));
        } else {
          const errorData = await response.json();
          console.log('\nWhatsApp API connection failed!');
          console.log('Status:', response.status);
          console.log('Error:', JSON.stringify(errorData, null, 2));
        }
      } else {
        console.log('\nAccess token not found in database');
      }
    } else {
      console.log('WhatsApp not configured in database');
    }
    
  } catch (error) {
    console.error('Error checking WhatsApp configuration:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkWhatsAppConfig();