// Test script to check if order_confirmation template exists
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testOrderConfirmationTemplate() {
  let client;
  try {
    console.log('Testing order_confirmation template...');
    
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
    const phoneNumberId = integrations.whatsapp.phoneNumberId; // This should be your actual number's ID
    const businessAccountId = integrations.whatsapp.businessAccountId || '665095226180028';
    
    console.log('Testing with:');
    console.log('- Business Account ID:', businessAccountId);
    console.log('- Phone Number ID:', phoneNumberId);
    console.log('- Access Token:', accessToken ? 'Present' : 'Missing');
    
    console.log('\n--- Testing order_confirmation template ---');
    
    // First, let's try to fetch all templates to see what's available
    const templatesUrl = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;
    
    console.log('Fetching all templates...');
    const templatesResponse = await fetch(templatesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const templatesData = await templatesResponse.json();
    
    if (!templatesResponse.ok) {
      console.error('Failed to fetch templates:', templatesData);
      return;
    }
    
    console.log(`Found ${templatesData.data?.length || 0} templates`);
    
    // List all template names
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
        console.log('\n✓ Found order_confirmation template!');
        console.log('Template details:');
        console.log('- Name:', orderConfirmationTemplate.name);
        console.log('- Status:', orderConfirmationTemplate.status);
        console.log('- Category:', orderConfirmationTemplate.category);
        console.log('- Language:', orderConfirmationTemplate.language);
        return true;
      } else {
        console.log('\n✗ order_confirmation template not found in your account');
        console.log('Closest matches:');
        templatesData.data.forEach(template => {
          const similarity = stringSimilarity('order_confirmation', template.name);
          if (similarity > 0.5) {
            console.log(`- ${template.name} (${(similarity * 100).toFixed(1)}% similar)`);
          }
        });
        return false;
      }
    } else {
      console.log('No templates found in your account');
      return false;
    }
  } catch (error) {
    console.error('Error testing template:', error.message);
    return false;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Simple string similarity function
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = (s1, s2) => {
    const costs = new Array(s2.length + 1);
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  };
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// Run the test
testOrderConfirmationTemplate().then(found => {
  if (found) {
    console.log('\n✅ You can use the order_confirmation template in your catalog messages');
  } else {
    console.log('\n❌ You will need to create an order_confirmation template in your Meta account');
    console.log('Or try using one of the existing templates shown above');
  }
});