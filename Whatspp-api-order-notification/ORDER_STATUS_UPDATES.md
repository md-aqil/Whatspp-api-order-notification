# Order Status Updates via WhatsApp

## Overview

This feature automatically sends WhatsApp notifications to customers when their Shopify order status changes. The system listens for various Shopify webhook events and sends appropriate status update messages to customers.

## Supported Order Status Events

The system currently supports notifications for the following order events:

1. **Order Created** - Initial order confirmation
2. **Order Updated** - General order updates
3. **Order Paid** - Payment confirmation
4. **Order Fulfilled** - Order fulfillment notification
5. **Order Cancelled** - Order cancellation notification

## How It Works

1. **Webhook Registration**: When you connect your Shopify store, the system automatically registers webhooks for all supported order events.

2. **Event Processing**: When Shopify sends a webhook notification about an order status change:
   - The system identifies the order in its database
   - Updates the order status
   - Sends a WhatsApp notification to the customer (if a phone number is available)

3. **WhatsApp Notification**: The system sends a formatted message with relevant order information and the new status.

## Message Templates

### Order Fulfilled
```
✅ *Order Status Update*

Your order #1001 has been fulfilled and is on its way!

Thank you for your purchase!
```

### Order Shipped
```
🚚 *Order Status Update*

Your order #1001 has been shipped!

Thank you for your purchase!
```

### Order Cancelled
```
❌ *Order Status Update*

Your order #1001 has been cancelled.

Thank you for your purchase!
```

### Order Refunded
```
💰 *Order Status Update*

Your order #1001 has been refunded.

Thank you for your purchase!
```

### Other Status Updates
```
🔄 *Order Status Update*

Your order #1001 status has been updated to: [status]

Thank you for your purchase!
```

## Setup Instructions

1. Connect your Shopify store through the Integrations page
2. The system will automatically register the necessary webhooks
3. Ensure your WhatsApp Business API is properly configured
4. Test the functionality using the provided test scripts

## Testing

To test the order status update functionality:

1. Run the webhook setup script:
   ```bash
   node setup_shopify_webhooks.js
   ```

2. Run the test order status update script:
   ```bash
   node test_order_status_update.js
   ```

## Troubleshooting

### No WhatsApp Notification Sent
- Verify the customer phone number is present in the order
- Check that WhatsApp Business API is properly configured
- Review webhook logs for errors

### Webhook Registration Failed
- Ensure your Shopify access token has the required permissions
- Verify your Shopify store domain is correct
- Check that your application is accessible from the internet

### Status Not Updating
- Confirm the webhook is properly registered in your Shopify admin
- Check the webhook logs for processing errors
- Verify the order exists in the system database