// Test script to send a template message to your actual number
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testWithActualNumber(templateName) {
  let client;
  try {
    console.log(`Testing template "${templateName}" with your actual number (+917210562014)`);
    
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
    
    // Send a template message to your actual number
    const messageData = {
      messaging_product: "whatsapp",
      to: "917210562014", // Your actual number without the +
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
      console.log('✅ Template message sent successfully!');
      console.log('Message ID:', data.messages?.[0]?.id);
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.json();
      console.log('❌ Error sending template message:', JSON.stringify(error, null, 2));
      
      // Provide specific guidance based on the error
      if (error.error?.message?.includes('Template name does not exist')) {
        console.log('\n🔧 SOLUTION NEEDED:');
        console.log('- The template name you used does not exist in your account');
        console.log('- Check your Facebook Business Manager for the exact template names');
        console.log('- Common templates to try: hello_world');
      } else if (error.error?.message?.includes('Recipient phone number not in allowed list')) {
        console.log('\n🔧 SOLUTION:');
        console.log('- Go to Facebook Business Manager');
        console.log('- Navigate to your WhatsApp Business Account');
        console.log('- Go to Settings > WhatsApp Accounts');
        console.log('- Add +917210562014 to your recipient list');
      } else {
        console.log('\n🔧 GENERAL TROUBLESHOOTING:');
        console.log('- Verify your access token is still valid');
        console.log('- Check your Facebook Business Manager settings');
        console.log('- Ensure your WhatsApp Business Account is properly configured');
      }
    }
    
  } catch (error) {
    console.error('Error testing with actual number:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Get template name from command line arguments or use default
const templateName = process.argv[2] || 'hello_world';
testWithActualNumber(templateName);