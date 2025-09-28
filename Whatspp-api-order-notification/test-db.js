const { MongoClient } = require('mongodb');

async function testDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('WhatsApp_api');
    
    // List existing collections
    const collections = await db.listCollections().toArray();
    console.log('Existing collections:', collections.map(c => c.name));
    
    // Create required collections if they don't exist
    const requiredCollections = [
      'chats',
      'messages',
      'integrations',
      'orders',
      'products',
      'campaigns',
      'webhooks',
      'webhook_logs'
    ];
    
    for (const collectionName of requiredCollections) {
      try {
        await db.createCollection(collectionName);
        console.log(`Created collection: ${collectionName}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`Collection ${collectionName} already exists`);
        } else {
          console.error(`Error creating collection ${collectionName}:`, error.message);
        }
      }
    }
    
    console.log('Database setup completed');
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await client.close();
  }
}

testDB();