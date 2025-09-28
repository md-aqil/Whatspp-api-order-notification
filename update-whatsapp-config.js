// Script to properly update WhatsApp configuration including catalog ID
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateWhatsAppConfig() {
  const phoneNumberId = process.argv[2];
  const accessToken = process.argv[3];
  const businessAccountId = process.argv[4];
  const catalogId = process.argv[5];
  const webhookVerifyToken = process.argv[6] || 'whatsapp_verify_token_123';

  if (!phoneNumberId || !accessToken) {
    console.log('Usage: node update-whatsapp-config.js <PHONE_NUMBER_ID> <ACCESS_TOKEN> [BUSINESS_ACCOUNT_ID] [CATALOG_ID] [WEBHOOK_VERIFY_TOKEN]');
    console.log('Example: node update-whatsapp-config.js 818391834688215 "your_access_token" 832073532824981 "your_catalog_id" "your_webhook_token"');
    return;
  }

  let client;
  try {
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Update the WhatsApp integration with all fields
    const updateData = {
      phoneNumberId: phoneNumberId,
      accessToken: accessToken,
      businessAccountId: businessAccountId || phoneNumberId,
      webhookVerifyToken: webhookVerifyToken,
      connected: true
    };
    
    // Only add catalogId if provided
    if (catalogId) {
      updateData.catalogId = catalogId;
    }
    
    const result = await db.collection('integrations').updateOne(
      { userId: 'default' },
      { 
        $set: { 
          'whatsapp': updateData,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    
    if (result.matchedCount > 0 || result.upsertedCount > 0) {
      console.log('✅ Successfully updated WhatsApp configuration');
      console.log('Phone Number ID:', phoneNumberId);
      console.log('Business Account ID:', businessAccountId || phoneNumberId);
      if (catalogId) {
        console.log('Catalog ID:', catalogId);
      } else {
        console.log('Catalog ID: Not set (optional)');
      }
      console.log('Webhook Verify Token:', webhookVerifyToken);
      console.log('\nYour WhatsApp integration is now properly configured!');
    } else {
      console.log('❌ Failed to update integration document.');
    }
    
  } catch (error) {
    console.error('Error updating WhatsApp configuration:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

updateWhatsAppConfig();