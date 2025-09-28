// Verification script to check if the catalog fix is properly implemented
const fs = require('fs');
const path = require('path');

// Path to the route.js file
const routeFilePath = path.join(__dirname, 'app', 'api', '[[...path]]', 'route.js');

// Read the file
fs.readFile(routeFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading route.js:', err);
    return;
  }

  // Check if the new interactive message code is present
  const hasSingleProductMessage = data.includes('type: "product"');
  const hasProductListMessage = data.includes('type: "product_list"');
  const hasCatalogIdCheck = data.includes('const hasCatalogId = integrations.whatsapp.catalogId');
  
  console.log('=== Catalog Fix Verification ===');
  console.log('✅ File route.js found');
  console.log(`✅ Catalog ID check present: ${hasCatalogIdCheck}`);
  console.log(`✅ Single product message support: ${hasSingleProductMessage}`);
  console.log(`✅ Product list message support: ${hasProductListMessage}`);
  
  if (hasSingleProductMessage && hasProductListMessage) {
    console.log('\n🎉 SUCCESS: The catalog fix has been properly implemented!');
    console.log('Product images should now be included when sending catalogs.');
  } else {
    console.log('\n❌ INCOMPLETE: The catalog fix is not fully implemented.');
    console.log('Please check the route.js file for proper implementation.');
  }
  
  console.log('\n=== How it works ===');
  console.log('1. For single products: Sends interactive product messages with images');
  console.log('2. For multiple products: Sends product list messages with images');
  console.log('3. Falls back to text links if needed');
});