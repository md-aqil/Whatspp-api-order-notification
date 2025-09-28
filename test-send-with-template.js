// Test script to verify sending catalog with template
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testSendWithTemplate() {
  try {
    console.log('Testing send catalog with template...');
    
    // Test the send catalog endpoint with a template
    const response = await fetch('http://localhost:3003/api/send-catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        products: ['123', '456'],
        recipient: '+1234567890',
        templateName: 'catalog_template'
      })
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Catalog sent successfully with template:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const error = await response.json();
      console.log('Error sending catalog:', error);
    }
  } catch (error) {
    console.error('Error testing send with template:', error);
  }
}

testSendWithTemplate();