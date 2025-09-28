// Test script to try common template names that might exist in your account
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testCommonTemplates() {
  let client;
  try {
    console.log('Testing common template names in your account...');
    console.log('This will help identify what templates might be available.\n');
    
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
    
    // List of common template names businesses use
    const commonTemplates = [
      'welcome',
      'welcome_message',
      'hello',
      'greeting',
      'catalog',
      'product_catalog',
      'product_update',
      'new_arrival',
      'new_products',
      'special_offer',
      'discount',
      'order_confirmation',
      'order_update',
      'shipping_confirmation',
      'shipping_update',
      'delivery_update',
      'issue_resolution',
      'customer_support',
      'appointment_reminder',
      'follow_up',
      'thank_you',
      'feedback',
      'survey'
    ];
    
    // Test each template
    for (const templateName of commonTemplates) {
      console.log(`\n🔍 Testing template: ${templateName}`);
      
      const messageData = {
        messaging_product: "whatsapp",
        to: "917210562014", // Your actual number
        type: "template",
        template: {
          name: templateName,
          language: {
            code: "en"
          }
        }
      };
      
      const url = `https://graph.facebook.com/v22.0/${integrations.whatsapp.phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integrations.whatsapp.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ SUCCESS: Template "${templateName}" exists!`);
        console.log(`   Message ID: ${data.messages?.[0]?.id}`);
        break; // Found one that works, no need to test more
      } else {
        const error = await response.json();
        if (error.error?.code === 132001) {
          console.log(`   ❌ Template "${templateName}" does not exist`);
        } else if (error.error?.code === 131030) {
          console.log(`   ✅ Template "${templateName}" EXISTS but phone not in allowed list`);
          console.log(`   🎯 This is the template you should use!`);
          break; // Found one that exists
        } else {
          console.log(`   ❓ Unexpected error for "${templateName}": ${error.error?.message}`);
        }
      }
    }
    
    console.log('\n📋 RECOMMENDATION:');
    console.log('If none of the above templates work, you should:');
    console.log('1. Create a new template in Facebook Business Manager');
    console.log('2. Use a simple message like: "Hi {{1}}, check out our latest products!"');
    console.log('3. Submit it for approval (1-2 business days)');
    console.log('4. Once approved, use that exact template name in the dashboard');
    
  } catch (error) {
    console.error('Error testing common templates:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testCommonTemplates();