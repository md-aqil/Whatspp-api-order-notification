// Script to identify the correct WhatsApp Business Account ID
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function identifyWhatsAppAccount() {
  let client;
  try {
    console.log('Identifying WhatsApp Business Account...');
    
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
    const phoneNumberId = integrations.whatsapp.phoneNumberId;
    
    console.log('Current IDs:');
    console.log('- Business Account ID:', businessAccountId);
    console.log('- Phone Number ID:', phoneNumberId);
    
    // Let's try to get info about the phone number itself, which might give us the WABA ID
    console.log('\n1. Getting phone number information...');
    const phoneInfoUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}?access_token=${accessToken}&fields=whatsapp_business_account`;
    const phoneInfoResponse = await fetch(phoneInfoUrl);
    const phoneInfoData = await phoneInfoResponse.json();
    
    if (phoneInfoResponse.ok) {
      console.log('Phone number info retrieved successfully');
      console.log('Phone info data:', JSON.stringify(phoneInfoData, null, 2));
      
      if (phoneInfoData.whatsapp_business_account) {
        const wabaId = phoneInfoData.whatsapp_business_account.id;
        console.log('\n✅ Found WhatsApp Business Account ID:', wabaId);
        
        // Now try to get templates using this WABA ID
        console.log('\n2. Trying to get templates with WABA ID...');
        const templatesUrl = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?access_token=${accessToken}`;
        const templatesResponse = await fetch(templatesUrl);
        const templatesData = await templatesResponse.json();
        
        if (templatesResponse.ok) {
          console.log('Templates retrieved successfully with WABA ID');
          console.log('Templates data:', JSON.stringify(templatesData, null, 2));
          return wabaId;
        } else {
          console.log('Failed to get templates with WABA ID:', templatesData);
        }
      }
    } else {
      console.log('Failed to get phone number info:', phoneInfoData);
    }
    
    // Try another approach - list all accounts connected to the business
    console.log('\n3. Trying to find connected WhatsApp accounts...');
    const accountsUrl = `https://graph.facebook.com/v22.0/me?access_token=${accessToken}&fields=accounts`;
    const accountsResponse = await fetch(accountsUrl);
    const accountsData = await accountsResponse.json();
    
    if (accountsResponse.ok) {
      console.log('Accounts data retrieved successfully');
      console.log('Accounts data:', JSON.stringify(accountsData, null, 2));
    } else {
      console.log('Failed to get accounts data:', accountsData);
    }
    
  } catch (error) {
    console.error('Error identifying WhatsApp account:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

identifyWhatsAppAccount();