// Test script to verify the WhatsApp templates endpoint
require('dotenv').config();

async function testTemplatesEndpoint() {
  try {
    console.log('Testing WhatsApp templates endpoint...');
    
    // Test the endpoint
    const response = await fetch('http://localhost:3003/api/whatsapp-templates');
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const templates = await response.json();
      console.log('Templates fetched successfully:');
      console.log(JSON.stringify(templates, null, 2));
    } else {
      const error = await response.json();
      console.log('Error fetching templates:', error);
    }
  } catch (error) {
    console.error('Error testing templates endpoint:', error);
  }
}

testTemplatesEndpoint();