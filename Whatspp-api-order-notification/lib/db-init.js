// Database initialization script
// This script ensures all required collections exist and have proper indexes

import { MongoClient } from 'mongodb'

async function initializeDatabase() {
  // Use the same connection string format as in the main app
  const client = new MongoClient('mongodb://localhost:27017')
  
  try {
    await client.connect()
    const db = client.db('WhatsApp_api')
    
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map(c => c.name)
    
    // Collections needed for the chat system
    const requiredCollections = [
      'chats',
      'messages',
      'integrations',
      'orders',
      'products',
      'campaigns',
      'webhooks',
      'webhook_logs'
    ]
    
    for (const collectionName of requiredCollections) {
      if (!collectionNames.includes(collectionName)) {
        await db.createCollection(collectionName)
        console.log(`Created collection: ${collectionName}`)
      }
    }
    
    // Create indexes for better performance
    await db.collection('chats').createIndex({ userId: 1, phone: 1 })
    await db.collection('messages').createIndex({ userId: 1, recipient: 1, timestamp: -1 })
    await db.collection('orders').createIndex({ userId: 1, shopifyOrderId: 1 })
    await db.collection('products').createIndex({ userId: 1 })
    await db.collection('campaigns').createIndex({ userId: 1, createdAt: -1 })
    await db.collection('webhook_logs').createIndex({ type: 1, receivedAt: -1 })
    
    console.log('Database initialization completed successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
  } finally {
    await client.close()
  }
}

// Run the initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().then(() => {
    process.exit(0)
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export default initializeDatabase