// Script to check if we can access templates via phone number
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkTemplatesViaPhone() {
  let client;
  try {
    console.log('Checking templates via phone number...');
    
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
    
    // Try to get message templates using the phone number ID directly
    // This is an alternative approach since we can't access the business account templates
    console.log('\nTrying to get templates via phone number ID...');
    const templatesUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates?access_token=${accessToken}`;
    const templatesResponse = await fetch(templatesUrl);
    const templatesData = await templatesResponse.json();
    
    if (templatesResponse.ok) {
      console.log('✅ Successfully retrieved templates via phone number ID!');
      console.log('Templates data:', JSON.stringify(templatesData, null, 2));
      
      if (templatesData.data && templatesData.data.length > 0) {
        console.log('\nAvailable templates:');
        templatesData.data.forEach(template => {
          console.log(`- ${template.name} (${template.status})`);
        });
        
        // Check specifically for order_confirmation
        const orderConfirmationTemplate = templatesData.data.find(
          template => template.name === 'order_confirmation'
        );
        
        if (orderConfirmationTemplate) {
          console.log('\n✅ Found order_confirmation template!');
          console.log('Template details:');
          console.log('- Name:', orderConfirmationTemplate.name);
          console.log('- Status:', orderConfirmationTemplate.status);
          console.log('- Category:', orderConfirmationTemplate.category);
          console.log('- Language:', orderConfirmationTemplate.language);
        } else {
          console.log('\n❌ order_confirmation template not found');
        }
      } else {
        console.log('No templates found');
      }
      
      return true;
    } else {
      console.log('Failed to get templates via phone number ID:', templatesData.error?.message || templatesData);
    }
    
    // Let's also try to see what other endpoints are available for the phone number
    console.log('\nTrying to get available endpoints for phone number...');
    const metadataUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}?access_token=${accessToken}&metadata=1`;
    const metadataResponse = await fetch(metadataUrl);
    const metadataData = await metadataResponse.json();
    
    if (metadataResponse.ok) {
      console.log('Available endpoints/connections for phone number:');
      if (metadataData.metadata && metadataData.metadata.connections) {
        Object.keys(metadataData.metadata.connections).forEach(connection => {
          console.log(`- ${connection}`);
        });
      }
    } else {
      console.log('Failed to get metadata:', metadataData.error?.message || metadataData);
    }
    
  } catch (error) {
    console.error('Error checking templates via phone:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkTemplatesViaPhone();