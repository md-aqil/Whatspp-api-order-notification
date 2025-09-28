// Test script to check if a specific template works
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testSpecificTemplate(templateName) {
  let client;
  try {
    console.log(`Testing template: ${templateName}`);
    
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integration settings
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations?.whatsapp?.phoneNumberId || !integrations?.whatsapp?.accessToken) {
      console.log('WhatsApp not configured properly');
      return;
    }
    
    // Try to send a template message with the specified template name
    const messageData = {
      messaging_product: "whatsapp",
      to: "1234567890", // Test number, replace with a valid number for real testing
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en"
        }
      }
    };
    
    console.log('Sending template message with data:', JSON.stringify(messageData, null, 2));
    
    const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integrations.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Template message sent successfully:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('Error sending template message:', JSON.stringify(error, null, 2));
      
      // Check if it's the template name error
      if (error.error?.message?.includes('Template name does not exist')) {
        console.log(`❌ Template "${templateName}" does not exist in your account.`);
        console.log('Please check your Facebook Business Manager to see what templates are available.');
      } else if (error.error?.message?.includes('Recipient phone number not in allowed list')) {
        console.log(`✅ Template "${templateName}" exists and is recognized by the system!`);
        console.log('The error is just because the phone number is not in your allowed list.');
        console.log('You can add your phone number to the allowed list in Facebook Business Manager.');
      } else {
        console.log(`⚠️  Unexpected error with template "${templateName}".`);
      }
    }
    
  } catch (error) {
    console.error('Error testing template:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Get template name from command line arguments or use default
const templateName = process.argv[2] || 'hello_world';
testSpecificTemplate(templateName);