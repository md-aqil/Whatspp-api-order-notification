// Test script to verify the template panel functionality
require('dotenv').config();

async function testTemplatePanel() {
  try {
    console.log('Testing template panel functionality...');
    
    // Test the templates endpoint
    console.log('\n1. Testing templates endpoint...');
    const templatesResponse = await fetch('http://localhost:3003/api/whatsapp-templates');
    console.log('Templates response status:', templatesResponse.status);
    
    if (templatesResponse.ok) {
      const templates = await templatesResponse.json();
      console.log('Templates fetched successfully:');
      console.log(JSON.stringify(templates, null, 2));
    } else {
      const error = await templatesResponse.json();
      console.log('Error fetching templates:', error);
      console.log('This is expected if templates cannot be fetched from the API');
    }
    
    console.log('\n✅ Template panel test completed!');
    console.log('\nTo test the full functionality:');
    console.log('1. Open the dashboard at http://localhost:3003/dashboard');
    console.log('2. Go to the "Send Catalog" tab');
    console.log('3. Select some products');
    console.log('4. Enter a recipient phone number');
    console.log('5. In the right panel, either:');
    console.log('   - Select a template if any are shown');
    console.log('   - Or enter a template name manually (e.g., "hello_world")');
    console.log('6. Click "Send with Template"');
    
  } catch (error) {
    console.error('Error testing template panel:', error);
  }
}

testTemplatePanel();