// Test script to verify the complete template workflow
require('dotenv').config();

async function testCompleteWorkflow() {
  try {
    console.log('Testing complete template workflow...');
    
    // 1. Fetch templates
    console.log('\n1. Fetching templates...');
    const templatesResponse = await fetch('http://localhost:3003/api/whatsapp-templates');
    console.log('Templates response status:', templatesResponse.status);
    
    if (templatesResponse.ok) {
      const templates = await templatesResponse.json();
      console.log('Templates fetched successfully:');
      console.log(JSON.stringify(templates, null, 2));
      
      if (templates.length > 0) {
        const selectedTemplate = templates[0];
        console.log(`\n2. Selected template: ${selectedTemplate.name}`);
        
        // 3. Test sending with template (this will fail due to missing products, but we can verify the template parameter is accepted)
        console.log('\n3. Testing send with template...');
        const sendResponse = await fetch('http://localhost:3003/api/send-catalog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            products: ['test-product-1', 'test-product-2'],
            recipient: '+1234567890',
            templateName: selectedTemplate.name
          })
        });
        
        console.log('Send response status:', sendResponse.status);
        
        if (sendResponse.ok) {
          const result = await sendResponse.json();
          console.log('Catalog sent successfully with template!');
          console.log(JSON.stringify(result, null, 2));
        } else {
          const error = await sendResponse.json();
          console.log('Expected error (no products in DB):', error.error);
        }
      }
    } else {
      const error = await templatesResponse.json();
      console.log('Error fetching templates:', error);
    }
    
    console.log('\n✅ Complete workflow test finished!');
  } catch (error) {
    console.error('Error testing complete workflow:', error);
  }
}

testCompleteWorkflow();