# WhatsApp Catalog Integration Guide

## Overview

This guide explains how to properly set up and use WhatsApp catalog functionality in your application. The system now supports both text-based product catalogs (fallback) and actual WhatsApp Business catalogs using catalog link messages.

## Prerequisites

1. WhatsApp Business API account
2. Facebook Business Manager account
3. Product catalog in Facebook Business Manager
4. Connected Shopify store

## Setting Up Facebook Catalog

### 1. Create a Facebook Product Catalog

1. Go to Facebook Business Manager
2. Navigate to "Commerce" > "Catalogs"
3. Click "Add Catalog"
4. Select "E-commerce" as the catalog type
5. Give your catalog a name
6. Click "Create Catalog"

### 2. Get Your Catalog ID

1. In Facebook Business Manager, go to "Commerce" > "Catalogs"
2. Click on your newly created catalog
3. The URL will contain your Catalog ID: `https://business.facebook.com/commerce/catalogs/{CATALOG_ID}/`

### 3. Configure Catalog ID in Your Application

1. Go to your application's Integrations tab
2. In the WhatsApp Business section, add your Catalog ID to the "Catalog ID" field
3. Save the integration

## How Catalog Messages Work

### Without Catalog ID (Fallback Mode)

When no Catalog ID is configured, the system sends a formatted text message with product details:

```
🛍️ *Product Catalog*

*Exotic® Premium Textured Handbags for Women*
✨ Exotic Premium Ladies' Hand & Sling Bag ✨
Step into elegance with the Exotic Premium Ladi...
💰 Price: $1437.00
🛒 Contact us to purchase

_💡 Tip: Connect your Facebook catalog for a better shopping experience!_
```

### With Catalog ID (Catalog Link Message)

When a Catalog ID is configured, the system sends a text message with a link to your WhatsApp catalog:

```
🛍️ *Our Product Catalog*

Check out our latest products:
https://wa.me/c/818391834688215

Browse our full collection and find something special just for you!
```

When recipients click on the link, they can browse your products directly in WhatsApp.

## Testing Catalog Functionality

### 1. Test with Current Setup (Text-based)

```bash
node test_catalog_message.js
```

This will send a text-based catalog using the first product from your Shopify store.

### 2. Test with Actual WhatsApp Catalog

1. Configure your Catalog ID in the WhatsApp integration settings
2. Run the same test script:
```bash
node test_catalog_message.js
```

If you have a valid Catalog ID, it will now send a catalog link message.

## API Endpoints

### Send Catalog Endpoint

**POST** `/api/send-catalog`

**Request Body:**
```json
{
  "products": ["product_id_1", "product_id_2"],
  "recipient": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "wamid.HBg..."
}
```

## Troubleshooting

### Catalog Link Not Working

1. **Verify Catalog ID**: Ensure the Catalog ID is correct and matches your Facebook catalog
2. **Check Product IDs**: Make sure product IDs in your Shopify store match those in your Facebook catalog
3. **Sync Products**: Refresh your products to ensure they're up-to-date
4. **Catalog Approval**: Ensure your Facebook catalog is approved and active

### Products Not Appearing in Catalog

1. **Product Feed**: Ensure your Facebook catalog is properly connected to your Shopify store
2. **Product Status**: Check that products are approved and active in your Facebook catalog
3. **Product IDs**: Verify that product IDs match between systems

## Best Practices

1. **Keep Catalogs Synced**: Regularly refresh products to ensure catalog accuracy
2. **Use High-Quality Images**: Ensure product images meet Facebook's requirements
3. **Accurate Pricing**: Keep prices synchronized between Shopify and Facebook
4. **Test Regularly**: Send test catalogs to verify functionality

## Advanced Catalog Features

For businesses that want to implement more advanced catalog features like Single-Product Messages or Multi-Product Messages, you'll need to:

1. Ensure your products are properly set up in Facebook's catalog with the correct retailer IDs
2. Have your catalog approved by Facebook
3. Use the proper interactive message formats as documented in the WhatsApp Business API documentation

The current implementation uses catalog link messages which are the most reliable and widely supported method.

## Need Help?

If you're having issues with catalog functionality:

1. Check that your Facebook catalog is properly set up and contains products
2. Verify that your Catalog ID is correctly configured in the application
3. Ensure your WhatsApp Business account has catalog messaging enabled
4. Contact Facebook support if you're having issues with your catalog approval