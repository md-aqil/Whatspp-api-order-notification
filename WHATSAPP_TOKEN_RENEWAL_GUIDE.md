# WhatsApp Business API Token Renewal Guide

## Issue Summary
The WhatsApp Business API access token has expired, preventing all messaging functionality in the dashboard.

**Error Message**: "Error validating access token: Session has expired on Thursday, 25-Sep-25 04:00:00 PDT"

## Root Cause
WhatsApp Business API tokens have a limited lifespan (typically 24-60 days) and must be renewed periodically.

## Solution Steps

### Step 1: Generate New Access Token

1. Go to [Facebook Developers Portal](https://developers.facebook.com/)
2. Navigate to your WhatsApp Business app
3. Go to **App Settings** > **Basic**
4. Under **WhatsApp Business Account**, click **Generate Token**
5. Copy the new access token

### Step 2: Update Dashboard Integration

1. Open the WhatsApp Commerce Hub dashboard at http://localhost:3001/dashboard
2. Navigate to the **Integrations** tab
3. Click on **WhatsApp Business** section
4. Paste the new access token in the **Access Token** field
5. Verify the **Phone Number ID** is correct (should be: 818391834688215)
6. Click **Save Integration**

### Step 3: Test Message Sending

1. After saving, wait 10-15 seconds for the integration to initialize
2. Go to the **Send Catalog** tab
3. Select one or more products
4. Enter a test phone number
5. Click **Send Catalog via WhatsApp**
6. Verify success message appears

### Step 4: Test Chat Functionality

1. Navigate to http://localhost:3001/dashboard/chat
2. Select a chat from the list
3. Type a message in the input field
4. Click the send button or press Enter
5. Verify the message appears in the chat window

### Step 5: Test Campaigns

1. Go to the **Campaigns** tab
2. Click **New Campaign**
3. Fill in campaign details
4. Click **Create & Send Now**
5. Verify the campaign appears in the list with "Sent" status

## Verification Commands

### Test API Directly
```bash
curl -X POST "https://graph.facebook.com/v22.0/818391834688215/messages" \
  -H "Authorization: Bearer YOUR_NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "text",
    "text": {
      "body": "Test message"
    }
  }'
```

### Check Token Validity
```bash
curl -X GET "https://graph.facebook.com/v22.0/me?access_token=YOUR_NEW_ACCESS_TOKEN"
```

## Prevention Measures

### Implement Token Refresh
To prevent future expirations, consider implementing:

1. **Automated Monitoring**
   - Set up alerts for token expiration
   - Monitor API response codes for auth errors

2. **Token Rotation**
   - Generate new tokens before expiration
   - Store multiple valid tokens
   - Implement fallback mechanisms

3. **User Notifications**
   - Display token expiration warnings in dashboard
   - Provide clear renewal instructions
   - Show token validity period

## Troubleshooting

### If Messages Still Fail After Token Update

1. **Verify Token Format**
   - Ensure no extra spaces or characters
   - Confirm token is from correct app

2. **Check Phone Number ID**
   - Verify ID matches your WhatsApp Business number
   - Confirm ID is from the same Facebook Business account

3. **Test with cURL**
   - Use the direct API test command above
   - Check for specific error messages

4. **Review Facebook App Permissions**
   - Ensure WhatsApp Business API is enabled
   - Verify all required permissions are granted

### Common Error Messages

- **"Invalid OAuth access token"** - Token format is incorrect
- **"Unsupported post request"** - Wrong endpoint or missing parameters
- **"No permission"** - App doesn't have required permissions

## Support Resources

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Facebook Developer Support](https://developers.facebook.com/support/)
- [WhatsApp Business API Community](https://www.facebook.com/groups/whatsappbusinessapi/)

## Next Steps After Resolution

1. Retest all messaging functionality
2. Complete responsive design testing
3. Verify webhook processing for incoming messages
4. Implement token expiration monitoring