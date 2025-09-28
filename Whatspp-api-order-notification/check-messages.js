const { MongoClient } = require('mongodb');

async function checkMessages() {
  let client;
  try {
    // Connect to MongoDB
    client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    console.log('Connected to MongoDB successfully');

    const db = client.db('WhatsApp_api');
    
    // Check recent incoming messages
    console.log('\n--- Recent Incoming Messages (from customers) ---');
    const incomingMessages = await db.collection('messages')
      .find({ isCustomer: true })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    if (incomingMessages.length === 0) {
      console.log('No incoming messages found');
    } else {
      incomingMessages.forEach((msg, index) => {
        console.log(`\n--- Message ${index + 1} ---`);
        console.log(`ID: ${msg.id}`);
        console.log(`Text: ${msg.message}`);
        console.log(`From customer: ${msg.isCustomer}`);
        console.log(`Phone: ${msg.phone}`);
        console.log(`Timestamp: ${msg.timestamp}`);
      });
    }
    
    // Check recent outgoing messages
    console.log('\n--- Recent Outgoing Messages (to customers) ---');
    const outgoingMessages = await db.collection('messages')
      .find({ isCustomer: false })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    if (outgoingMessages.length === 0) {
      console.log('No outgoing messages found');
    } else {
      outgoingMessages.forEach((msg, index) => {
        console.log(`\n--- Message ${index + 1} ---`);
        console.log(`ID: ${msg.id}`);
        console.log(`Text: ${msg.message}`);
        console.log(`From customer: ${msg.isCustomer}`);
        console.log(`Phone: ${msg.phone}`);
        console.log(`Timestamp: ${msg.timestamp}`);
      });
    }
    
    // Check chats
    console.log('\n--- Recent Chats ---');
    const chats = await db.collection('chats')
      .find({})
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    if (chats.length === 0) {
      console.log('No chats found');
    } else {
      chats.forEach((chat, index) => {
        console.log(`\n--- Chat ${index + 1} ---`);
        console.log(`ID: ${chat.id}`);
        console.log(`Phone: ${chat.phone}`);
        console.log(`Name: ${chat.name}`);
        console.log(`Last message: ${chat.lastMessage}`);
        console.log(`Unread: ${chat.unread}`);
        console.log(`Timestamp: ${chat.timestamp}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking messages:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

checkMessages();