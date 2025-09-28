// Script to get WhatsApp Business Account ID from phone number
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function getWabaId() {
  let client;
  try {
    console.log('Getting WhatsApp Business Account ID...');
    
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
    const phoneNumberId = integrations.whatsapp.phoneNumberId;
    
    console.log('Using Phone Number ID:', phoneNumberId);
    
    // Try different field combinations to get the WABA ID
    const fieldCombinations = [
      'whatsapp_business_account',
      'business_account',
      'waba_id',
      'whatsapp_business_account_id'
    ];
    
    for (const field of fieldCombinations) {
      console.log(`\nTrying field: ${field}`);
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}?access_token=${accessToken}&fields=${field}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`Success with field ${field}:`, JSON.stringify(data, null, 2));
        if (data[field]) {
          console.log(`✅ Found WABA ID in field ${field}:`, data[field]);
          return data[field];
        }
      } else {
        console.log(`Failed with field ${field}:`, data.error?.message || data);
      }
    }
    
    // Try getting all available fields for the phone number
    console.log('\nTrying to get all available fields for phone number...');
    const allFieldsUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}?access_token=${accessToken}`;
    const allFieldsResponse = await fetch(allFieldsUrl);
    const allFieldsData = await allFieldsResponse.json();
    
    if (allFieldsResponse.ok) {
      console.log('All available fields:', Object.keys(allFieldsData));
      console.log('Full data:', JSON.stringify(allFieldsData, null, 2));
      
      // Look for any field that might contain the WABA ID
      for (const [key, value] of Object.entries(allFieldsData)) {
        if (typeof value === 'string' && value.includes('whatsapp') && value.length > 10) {
          console.log(`Potential WABA ID in field ${key}:`, value);
        }
        if (typeof value === 'object' && value !== null) {
          if (value.id && value.id.includes('whatsapp')) {
            console.log(`Potential WABA ID in nested object ${key}:`, value.id);
          }
        }
      }
    } else {
      console.log('Failed to get all fields:', allFieldsData.error?.message || allFieldsData);
    }
    
    // Try a different approach - get the phone number details with more fields
    console.log('\nTrying detailed phone number query...');
    const detailedUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}?access_token=${accessToken}&fields=id,name,display_phone_number,quality_rating,platform_type,business_verification_status,account_review_status`;
    const detailedResponse = await fetch(detailedUrl);
    const detailedData = await detailedResponse.json();
    
    if (detailedResponse.ok) {
      console.log('Detailed phone number data:', JSON.stringify(detailedData, null, 2));
    } else {
      console.log('Failed to get detailed data:', detailedData.error?.message || detailedData);
    }
    
  } catch (error) {
    console.error('Error getting WABA ID:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

getWabaId();