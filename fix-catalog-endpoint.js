// Script to fix the send-catalog endpoint by replacing the problematic section
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

  // Find the problematic section
  const startMarker = '// Check if we have a catalog ID configured';
  const endMarker = '} catch (error) {';
  
  const startIndex = data.indexOf(startMarker);
  const endIndex = data.indexOf(endMarker, startIndex);
  
  if (startIndex === -1 || endIndex === -1) {
    console.log('Could not find the markers in the file');
    return;
  }
  
  // Extract the parts before and after the problematic section
  const beforeSection = data.substring(0, startIndex);
  const afterSection = data.substring(endIndex);
  
  // Create the new section
  const newSection = `          // Check if we have a catalog ID configured
          const hasCatalogId = integrations.whatsapp.catalogId;
          
          // Always use text-based messages to avoid template approval requirements
          // Create a catalog link
          const businessAccountId = integrations.whatsapp.businessAccountId || integrations.whatsapp.phoneNumberId;
          const catalogLink = \`https://wa.me/c/\${businessAccountId}\`;
          
          // Create a message that includes information about selected products with images
          let productInfo = "Selected products:\\n";
          selectedProducts.slice(0, 3).forEach((product, index) => {
            let productEntry = \`\${index + 1}. *\${product.title}* - $\${product.price}\\n\`;
            if (product.image) {
              productEntry += \`   📷 Image: \${product.image}\\n\`;
            }
            if (product.description) {
              productEntry += \`   📝 \${product.description.substring(0, 100)}\${product.description.length > 100 ? '...' : ''}\\n\`;
            }
            productInfo += productEntry + "\\n";
          });
          if (selectedProducts.length > 3) {
            productInfo += \`...and \${selectedProducts.length - 3} more items\\n\`;
          }
          
          const catalogMessage = \`🛍️ *Our Product Catalog*

Check out our latest products:
\${catalogLink}

\${productInfo}Browse our full collection and find something special just for you!

🛍️ *Shop Now* - Click the link above to browse our catalog with images\`;

          const messageData = {
            messaging_product: "whatsapp",
            to: formattedRecipient,
            type: "text",
            text: {
              body: catalogMessage,
              preview_url: true
            }
          };

          console.log('Sending message with data:', JSON.stringify(messageData, null, 2));

          const result = await sendWhatsAppMessage(
            integrations.whatsapp.phoneNumberId,
            integrations.whatsapp.accessToken,
            formattedRecipient,
            messageData
          );

          console.log('WhatsApp API response:', JSON.stringify(result, null, 2));

          // Log the message
          await db.collection('messages').insertOne({
            id: uuidv4(),
            userId: 'default',
            recipient: formattedRecipient,
            products: selectedProducts,
            whatsappMessageId: result.messages?.[0]?.id,
            status: 'sent',
            sentAt: new Date()
          });

          return handleCORS(NextResponse.json({ 
            success: true, 
            messageId: result.messages?.[0]?.id 
          }));`;
  
  // Combine all parts
  const newData = beforeSection + newSection + afterSection;
  
  // Write the fixed file
  fs.writeFile(routeFilePath, newData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing route.js:', err);
      return;
    }
    
    console.log('✅ Successfully fixed the send-catalog endpoint!');
    console.log('The file has been updated with the corrected implementation.');
  });
});