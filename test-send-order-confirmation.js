// Script to test sending order_confirmation template
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testSendOrderConfirmation() {
  let client;
  try {
    console.log('Testing order_confirmation template by attempting to send...');
    
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
    
    // Try to send a message with the order_confirmation template
    // This will tell us if the template exists and is approved
    console.log('\nAttempting to send order_confirmation template to your number (+917210562014)...');
    
    const messageData = {
      messaging_product: "whatsapp",
      to: "+917210562014", // Your actual number
      type: "template",
      template: {
        name: "order_confirmation",
        language: {
          code: "en"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: "12345"
              },
              {
                type: "text",
                text: "John Doe"
              }
            ]
          }
        ]
      }
    };
    
    const sendMessageUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const sendMessageResponse = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    
    const sendMessageData = await sendMessageResponse.json();
    
    if (sendMessageResponse.ok) {
      console.log('✅ Successfully sent order_confirmation template!');
      console.log('Message ID:', sendMessageData.messages[0].id);
      console.log('\nThis means the template exists and is approved in your account.');
      return true;
    } else {
      console.log('Failed to send order_confirmation template:', sendMessageData);
      
      // Check if it's the specific error we're looking for
      if (sendMessageData.error && sendMessageData.error.code === 132001) {
        console.log('\n❌ Template name does not exist in the translation');
        console.log('This confirms the order_confirmation template does not exist in your account.');
      }
      
      // Let's try some common template names
      const commonTemplateNames = [
        'hello_world',
        'order_update',
        'shipping_confirmation',
        'delivery_update',
        'order_status',
        'welcome'
      ];
      
      console.log('\nTrying common template names...');
      for (const templateName of commonTemplateNames) {
        console.log(`\nTrying template: ${templateName}`);
        
        const testData = JSON.parse(JSON.stringify(messageData));
        testData.template.name = templateName;
        
        const testResponse = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testData)
        });
        
        const testDataResponse = await testResponse.json();
        
        if (testResponse.ok) {
          console.log(`✅ Success with template: ${templateName}`);
          console.log(`You can use ${templateName} for your catalog messages`);
          return true;
        } else {
          console.log(`Failed with ${templateName}:`, testDataResponse.error?.message || testDataResponse);
        }
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('Error testing template send:', error.message);
    return false;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testSendOrderConfirmation();