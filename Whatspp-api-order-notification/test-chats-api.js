// Test script to debug the chats API endpoint
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

async function testChatsAPI() {
  let client;
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    console.log('Connected to MongoDB successfully');
    
    // Test creating a new chat
    const phone = '+1234567890';
    const name = 'Test Customer';
    
    console.log(`Creating chat for ${phone} with name ${name}`);
    
    // Format the phone number
    const formattedPhone = phone.replace(/\D/g, '');
    console.log(`Formatted phone: ${formattedPhone}`);

    // Check if chat already exists
    const existingChat = await db.collection('chats').findOne({ 
      userId: 'default',
      phone: formattedPhone 
    });
    
    console.log('Existing chat:', existingChat);

    if (existingChat) {
      console.log('Chat already exists');
      return existingChat;
    }

    // Create new chat
    const newChat = {
      id: uuidv4(),
      userId: 'default',
      phone: formattedPhone,
      name: name || `Customer ${formattedPhone}`,
      lastMessage: 'Chat created',
      timestamp: new Date(),
      unread: 0,
      avatar: `https://ui-avatars.com/api/?name=${name || 'Customer'}&background=random`
    };

    console.log('New chat object:', newChat);
    
    const result = await db.collection('chats').insertOne(newChat);
    console.log('Insert result:', result);
    
    console.log('Chat created successfully');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testChatsAPI();