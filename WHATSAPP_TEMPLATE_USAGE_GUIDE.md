# WhatsApp Template Usage Guide

This guide explains how to use approved WhatsApp templates with your real Meta account in the WhatsApp Commerce Hub.

## Current Implementation Status

The system is now configured to work with your real Meta account:
- Business Account ID: 665095226180028 (Md Automation)
- Phone Number ID: 818391834688215

However, there are some limitations with fetching templates through the API, so we've implemented a workaround that allows manual template entry.

## How to Use Templates

### 1. Identify Your Approved Templates

1. Go to [Facebook Business Manager](https://business.facebook.com/)
2. Navigate to your WhatsApp business account (Md Automation)
3. Go to the "Templates" section
4. Note down the exact names of your approved templates

### 2. Common Template Names to Try

These are standard templates that are often available:
- `hello_world` (standard template)
- `sample_issue_resolution`
- `sample_shipping_notification`
- `sample_happy_hour_announcement`

### 3. Using Templates in the Dashboard

1. Go to the "Send Catalog" tab in the dashboard
2. Select products you want to include in the catalog
3. Enter the recipient's phone number
4. In the right panel (Templates section):
   - If templates are fetched successfully, click on one to select it
   - If no templates are shown, enter the template name manually in the input field
5. Click "Send with Template" button

### 4. Troubleshooting Template Issues

#### "Template name does not exist in the translation" Error

This error occurs when:
- The template name is misspelled
- The template is not approved in your account
- The template language doesn't match

**Solutions:**
1. Double-check the exact spelling and case of the template name
2. Verify the template status is "Approved" in Facebook Business Manager
3. Ensure the template language matches what you're sending (usually "en" for English)

#### "Recipient phone number not in allowed list" Error

This error occurs when:
- The recipient phone number is not in your WhatsApp Business account's allowed list

**Solution:**
1. Go to Facebook Business Manager
2. Navigate to your WhatsApp business account
3. Go to "Settings" > "WhatsApp Accounts"
4. Add the recipient phone number to your recipient list

### 5. Testing Templates

You can test if a template exists in your account using the test script:

```bash
node test-specific-template.js [template_name]
```

For example:
```bash
node test-specific-template.js hello_world
```

If the template exists, you'll see a message saying it's recognized by the system.

## Best Practices

1. **Use Exact Template Names**: Always use the exact name as it appears in Facebook Business Manager
2. **Verify Template Status**: Ensure templates are "Approved" before trying to use them
3. **Test with Your Number**: Add your own phone number to the allowed list for testing
4. **Check Language Settings**: Make sure the template language matches your sending language

## Adding New Templates

To create and use new templates:

1. Go to Facebook Business Manager
2. Navigate to your WhatsApp business account
3. Go to the "Templates" section
4. Click "Create Template"
5. Fill in the template details
6. Submit for review
7. Wait for Facebook's approval (usually takes 1-2 business days)
8. Once approved, you can use the template name in the dashboard

## Need Help?

If you're still having issues:

1. Verify your WhatsApp Business account is properly set up
2. Check that your access token has the necessary permissions
3. Ensure your business account ID is correctly configured
4. Contact Facebook support if templates aren't showing as approved

For technical issues with the dashboard:
- Check the browser console for errors
- Verify the application is properly connected to your WhatsApp account
- Ensure all required environment variables are set