// Script to update Facebook Catalog ID in WhatsApp configuration
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateCatalogId() {
  const catalogId = process.argv[2]; // Pass catalog ID as command line argument
  
  if (!catalogId) {
    console.log('Usage: node update-catalog-id.js <YOUR_CATALOG_ID>');
    console.log('Please provide your Facebook Catalog ID as a command line argument.');
    return;
  }

  let client;
  try {
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Update the WhatsApp integration with the catalog ID
    const result = await db.collection('integrations').updateOne(
      { userId: 'default' },
      { 
        $set: { 
          'whatsapp.catalogId': catalogId,
          'whatsapp.businessAccountId': catalogId // Usually the same as catalog ID
        } 
      }
    );
    
    if (result.matchedCount > 0) {
      console.log(`✅ Successfully updated Catalog ID: ${catalogId}`);
      console.log('Your WhatsApp catalog integration is now configured!');
      console.log('You should now be able to send actual WhatsApp catalogs instead of text-based fallback messages.');
    } else {
      console.log('❌ No integration document found. Please check your database.');
    }
    
  } catch (error) {
    console.error('Error updating catalog ID:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

updateCatalogId();