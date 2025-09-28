// Script to check recent WhatsApp webhook logs
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkWebhookLogs() {
  let client;
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    console.log('Connected to MongoDB successfully');
    
    // Check for recent WhatsApp webhook logs
    const logs = await db.collection('webhook_logs')
      .find({ type: 'whatsapp' })
      .sort({ receivedAt: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nRecent WhatsApp webhook logs:');
    if (logs.length === 0) {
      console.log('No webhook logs found');
    } else {
      logs.forEach((log, index) => {
        console.log(`\n--- Log ${index + 1} ---`);
        console.log(`Received at: ${log.receivedAt}`);
        console.log(`Payload: ${JSON.stringify(log.payload, null, 2)}`);
      });
    }
    
    // Also check for recent messages
    console.log('\n--- Recent Messages ---');
    const messages = await db.collection('messages')
      .find({ userId: 'default' })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    if (messages.length === 0) {
      console.log('No messages found');
    } else {
      messages.forEach((msg, index) => {
        console.log(`\n--- Message ${index + 1} ---`);
        console.log(`ID: ${msg.id}`);
        console.log(`Text: ${msg.message}`);
        console.log(`From customer: ${msg.isCustomer}`);
        console.log(`Phone: ${msg.phone}`);
        console.log(`Recipient: ${msg.recipient}`);
        console.log(`Timestamp: ${msg.timestamp}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkWebhookLogs();