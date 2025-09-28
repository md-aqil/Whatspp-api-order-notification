// Script to find WhatsApp Business Account from business portfolio
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function findWhatsAppBusinessAccount() {
  let client;
  try {
    console.log('Finding WhatsApp Business Account...');
    
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
    
    console.log('Using Business Account ID:', businessAccountId);
    
    // Try different edges to find WhatsApp business accounts
    const edgesToTry = [
      'whatsapp_business_accounts',
      'businesses',
      'owned_businesses',
      'client_whatsapp_business_accounts'
    ];
    
    for (const edge of edgesToTry) {
      console.log(`\nTrying edge: ${edge}`);
      const url = `https://graph.facebook.com/v22.0/${businessAccountId}/${edge}?access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`Success with edge ${edge}:`, JSON.stringify(data, null, 2));
        if (data.data && data.data.length > 0) {
          console.log(`✅ Found WhatsApp Business Accounts via edge ${edge}:`);
          data.data.forEach(account => {
            console.log(`- ID: ${account.id}, Name: ${account.name || 'N/A'}`);
          });
          return data.data[0].id; // Return the first WABA ID found
        }
      } else {
        console.log(`Failed with edge ${edge}:`, data.error?.message || data);
      }
    }
    
    // Try getting all available edges/connections for the business account
    console.log('\nTrying to get all connections for business account...');
    const connectionsUrl = `https://graph.facebook.com/v22.0/${businessAccountId}/?access_token=${accessToken}&metadata=1`;
    const connectionsResponse = await fetch(connectionsUrl);
    const connectionsData = await connectionsResponse.json();
    
    if (connectionsResponse.ok) {
      console.log('Available connections/edges:');
      if (connectionsData.metadata && connectionsData.metadata.connections) {
        Object.keys(connectionsData.metadata.connections).forEach(connection => {
          console.log(`- ${connection}`);
        });
      } else {
        console.log('No connections metadata found');
      }
    } else {
      console.log('Failed to get connections:', connectionsData.error?.message || connectionsData);
    }
    
    // Try a manual approach - check if the businessAccountId itself is actually a WABA
    console.log('\nTrying to use businessAccountId as WABA ID directly...');
    const wabaUrl = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates?access_token=${accessToken}`;
    const wabaResponse = await fetch(wabaUrl);
    const wabaData = await wabaResponse.json();
    
    if (wabaResponse.ok) {
      console.log('✅ Business Account ID is actually a WABA ID!');
      console.log('Templates data:', JSON.stringify(wabaData, null, 2));
      return businessAccountId;
    } else {
      console.log('Business Account ID is not a WABA ID:', wabaData.error?.message || wabaData);
    }
    
  } catch (error) {
    console.error('Error finding WhatsApp Business Account:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

findWhatsAppBusinessAccount();