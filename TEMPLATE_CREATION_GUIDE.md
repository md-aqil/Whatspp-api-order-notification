# WhatsApp Template Creation Guide

Based on our testing, we've confirmed that your Meta Business account (ID: 665095226180028) does not have any approved templates. To use template-based messaging in your WhatsApp catalog integration, you'll need to create and approve a template first.

## Steps to Create a WhatsApp Template

### 1. Access Facebook Business Manager
1. Go to [Facebook Business Manager](https://business.facebook.com/)
2. Log in with your Facebook account that has access to the business (Md Automation)

### 2. Navigate to WhatsApp Templates
1. In Business Manager, find your WhatsApp business account
2. Go to **Messages** > **Templates** in the left sidebar
3. Click **Create Template**

### 3. Create an Order Confirmation Template
Fill in the following details for your template:

**Template Name:** `order_confirmation`
> Note: Template names must be all lowercase letters, numbers, and underscores only.

**Language:** English (or your preferred language)

**Category:** Transactional (for order confirmations)

**Template Content:**
```
Hello {{1}},

Thank you for your order! Here are your order details:

Order Number: {{2}}
Status: Confirmed
Expected Delivery: {{3}}

You can view your order details here: [View Order]

If you have any questions, please contact us.

Thank you for shopping with us!
```

**Variables:**
- `{{1}}` - Customer name
- `{{2}}` - Order number
- `{{3}}` - Delivery date

### 4. Submit for Approval
1. Review your template carefully
2. Click **Create** to submit for approval
3. Facebook typically takes 1-2 business days to review and approve templates

## Alternative Template Options

If you prefer to use a different template name or content, here are some alternatives:

### Simple Template
**Name:** `catalog_notification`
**Content:**
```
Hi {{1}},

We've prepared a catalog for you with our latest products!

[View Catalog]

Let us know if you have any questions.
```

### Product Update Template
**Name:** `product_update`
**Content:**
```
Hello {{1}},

We have new products available in our catalog!

[View New Products]

Best regards,
Your Team
```

## After Template Approval

Once your template is approved:
1. Run the test script again to verify the template exists:
   ```bash
   node test-send-order-confirmation.js
   ```

2. You should see a success message indicating the template is available

3. The template will then appear in your dashboard template panel

## Common Issues and Solutions

### Template Not Found After Creation
- Wait for Facebook's approval process (1-2 business days)
- Ensure the template name exactly matches what you're using in the code
- Template names are case-sensitive

### Permission Errors
- Make sure your Facebook account has the necessary permissions on the business account
- You may need to be an admin of the business account

### Character Limits
- Template headers: 60 characters
- Template body: 1024 characters
- Template footers: 60 characters

## Testing Your Template

After approval, you can test your template with this command:
```bash
node test-send-order-confirmation.js
```

If successful, you'll see:
```
✅ Successfully sent order_confirmation template!
```

## Using Templates in Catalog Messages

Once your template is approved and working, you can:
1. Go to your dashboard
2. Select products to send in your catalog
3. Choose your approved template from the template panel
4. Send the catalog with the template message

This will resolve the "#132001 Template name does not exist in the translation" error you've been experiencing.