// Diagnostic script to check the current state of the catalog implementation
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function diagnoseCatalogIssue() {
  let client;
  try {
    // Check if the route.js file exists
    const routeFilePath = path.join(__dirname, 'app', 'api', '[[...path]]', 'route.js');
    if (!fs.existsSync(routeFilePath)) {
      console.log('❌ route.js file not found');
      return;
    }
    
    // Read the file content
    const fileContent = fs.readFileSync(routeFilePath, 'utf8');
    
    // Check for specific patterns
    const hasInteractiveProduct = fileContent.includes('type: "product"');
    const hasInteractiveProductList = fileContent.includes('type: "product_list"');
    const hasTextBasedApproach = fileContent.includes('type: "text"') && fileContent.includes('catalogLink');
    
    console.log('=== Catalog Implementation Diagnosis ===');
    console.log(`✅ Route file exists: ${fs.existsSync(routeFilePath)}`);
    console.log(`❌ Using interactive product messages: ${hasInteractiveProduct}`);
    console.log(`❌ Using interactive product list messages: ${hasInteractiveProductList}`);
    console.log(`✅ Using text-based approach: ${hasTextBasedApproach}`);
    
    if (hasInteractiveProduct || hasInteractiveProductList) {
      console.log('\n🚨 ISSUE IDENTIFIED:');
      console.log('The implementation is still using interactive message types that require pre-approved templates.');
      console.log('This is causing the "Failed to send message: (#131009) Parameter value is not valid" error.');
      
      console.log('\n🔧 SOLUTION:');
      console.log('Replace the interactive message implementation with a text-based approach.');
      console.log('This approach does not require pre-approved templates and will work immediately.');
    } else {
      console.log('\n✅ The implementation appears to be using the text-based approach.');
      console.log('If you are still getting errors, there may be another issue.');
    }
    
    // Check database for integrations
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    // Get integrations
    const integrations = await db.collection('integrations').findOne({ userId: 'default' });
    
    if (!integrations) {
      console.log('\n⚠️  No integrations found in database');
      return;
    }
    
    console.log(`\n=== Integration Status ===`);
    console.log(`WhatsApp connected: ${!!(integrations.whatsapp?.phoneNumberId && integrations.whatsapp?.accessToken)}`);
    console.log(`Catalog ID configured: ${!!integrations.whatsapp?.catalogId}`);
    console.log(`Business Account ID: ${integrations.whatsapp?.businessAccountId || 'Not set'}`);
    console.log(`Phone Number ID: ${integrations.whatsapp?.phoneNumberId || 'Not set'}`);
    
  } catch (error) {
    console.error('Error diagnosing catalog issue:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

diagnoseCatalogIssue();