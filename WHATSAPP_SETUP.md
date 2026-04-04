# WhatsApp Business API Setup - Complete Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Meta Developer Account Setup](#meta-developer-account-setup)
3. [Creating a Meta App](#creating-a-meta-app)
4. [WhatsApp Product Configuration](#whatsapp-product-configuration)
5. [Getting Your Credentials](#getting-your-credentials)
6. [Connecting to Your App](#connecting-to-your-app)
7. [Testing the Connection](#testing-the-connection)
8. [Webhook Setup](#webhook-setup)
9. [Managing Access Tokens](#managing-access-tokens)
10. [Troubleshooting](#troubleshooting)
11. [Security Best Practices](#security-best-practices)

---

## Prerequisites

Before starting, ensure you have:
- [ ] Meta Business Account (https://business.facebook.com)
- [ ] Meta Developer Account (https://developers.facebook.com/)
- [ ] A phone number that will be used for WhatsApp Business
- [ ] Access to your WhatsApp Commerce Hub application

---

## Meta Developer Account Setup

### Step 1: Create Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **Log In** and sign in with your Facebook account
3. If you don't have a developer account, click **Register**
4. Complete the registration by providing:
   - Full name
   - Email address
   - Phone number
5. Accept the Terms of Service and Privacy Policy

### Step 2: Verify Your Account

Meta may require additional verification:
- Email verification (check your inbox)
- Phone verification (enter code sent to your phone)
- Business verification (may be required for full access)

---

## Creating a Meta App

### Step 1: Create New App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Other** as the app type

```
┌─────────────────────────────────────────┐
│  What do you want your app to do?      │
│                                         │
│  [ ] Consumer                            │
│  [x] Business                            │
│  [ ] None                                │
└─────────────────────────────────────────┘
```

### Step 2: App Details

1. Enter an **App Name**: `WhatsApp Commerce Hub`
2. Select or create a **Business Portfolio**:
   - If you have one: Select existing business
   - If not: Create new business portfolio
3. Click **Create App**

### Step 3: Add WhatsApp Product

1. Scroll down to **Add products to your app**
2. Find **WhatsApp** in the list
3. Click **Set Up**

```
┌─────────────────────────────────────────┐
│  Products                              │
│                                         │
│  [+] WhatsApp     [Configure]          │
│  [+] Facebook Login                    │
│  [+] Facebook Marketing API            │
└─────────────────────────────────────────┘
```

---

## WhatsApp Product Configuration

### Understanding the WhatsApp Dashboard

After adding WhatsApp product, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│  WhatsApp                                                 │
│  ─────────────────────────────────────────────────────  │
│  [Getting Started] [API Setup] [Channel Settings]        │
│  [Template Messages] [Analytics]                        │
└─────────────────────────────────────────────────────────┘
```

### Step 1: API Setup (Getting Credentials)

Click on **API Setup** in the left sidebar:

#### 1.1 Save Credentials

You'll see these credentials (mark them down):

| Field | Description | Example |
|-------|-------------|---------|
| **Temporary Access Token** | Token for API access | `EAAGO...` |
| **Phone Number ID** | Your WhatsApp number ID | `234567890123456` |
| **WhatsApp Business Account ID** | Your business account | `123456789012345` |

#### 1.2 Download Business Info

```json
{
  "phone_number_id": "234567890123456",
  "wa_phone_number_id": "234567890123456",
  "business_account_id": "123456789012345"
}
```

### Step 2: Channel Settings

1. Click **Channel Settings** in the left sidebar
2. Go to **Phone Numbers** tab
3. Note your verified phone numbers

```
┌─────────────────────────────────────────────────────────┐
│  Phone Numbers                                          │
│  ─────────────────────────────────────────────────────  │
│  📱 +1 555-123-4567    [Verified ✓]    [Edit]         │
└─────────────────────────────────────────────────────────┘
```

### Step 3: Business Account ID

1. In the WhatsApp setup page, find **Business Account ID**
2. Copy it - you'll need this for API calls
3. Example: `123456789012345`

---

## Getting Your Credentials

### Summary of Required Values

| Field | Location in Meta Dashboard | Must Have |
|-------|---------------------------|-----------|
| **phoneNumberId** | API Setup → Phone Number ID column | ✅ Required |
| **accessToken** | API Setup → Temporary Access Token | ✅ Required |
| **businessAccountId** | API Setup → Business Account ID | ✅ Required |

### How to Get Each Credential

#### 1. phoneNumberId

```
Meta Dashboard → Your App → WhatsApp → API Setup
```
Look for the **Phone Number ID** column in the "On Behalf Of Business" section.

Or via API:
```bash
curl "https://graph.facebook.com/v22.0/{business-account-id}/phone_numbers" \
  -H "Authorization: Bearer {access-token}"
```

#### 2. accessToken

```
Meta Dashboard → Your App → WhatsApp → API Setup
```
Copy the **Temporary Access Token** shown in the "Step 5" section.

**Note**: This token expires in ~24 hours. See "Managing Access Tokens" below.

#### 3. businessAccountId

```
Meta Dashboard → Your App → WhatsApp → API Setup
```
Find the **Business Account ID** at the top of the page.

---

## Connecting to Your App

### Method 1: Through Dashboard UI (Recommended)

1. Open your WhatsApp Commerce Hub
2. Navigate to: `http://localhost:3000/dashboard/settings` (local) or `https://lcsw.dpdns.org/dashboard/settings` (production)
3. Find the **Integrations** section
4. Fill in the WhatsApp form:

```
┌─────────────────────────────────────────┐
│  WhatsApp Integration                   │
│                                         │
│  Phone Number ID: [________________]    │
│  Access Token:    [________________]    │
│  Business Account ID: [________________]│
│                                         │
│  [Save Integration]                     │
└─────────────────────────────────────────┘
```

### Method 2: Direct Database Insertion

You can also insert directly into the database:

```sql
-- Connect to your MySQL database
mysql -u root -p whatsapp_api

-- Update the integrations table
UPDATE integrations 
SET whatsapp = JSON_OBJECT(
  'phoneNumberId', '234567890123456',
  'accessToken', 'EAAGO...your-token-here...',
  'businessAccountId', '123456789012345',
  'connected', true
)
WHERE userId = 'default';
```

### Method 3: Via API

```bash
curl -X POST "http://localhost:3000/api/settings/integrations" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "whatsapp",
    "data": {
      "phoneNumberId": "234567890123456",
      "accessToken": "EAAGO...your-token...",
      "businessAccountId": "123456789012345"
    }
  }'
```

---

## Testing the Connection

### Test 1: Check Configuration API

```bash
curl http://localhost:3000/api/wa-config
```

Expected response:
```json
{
  "wordpress_url": "...",
  "woocommerce": {...},
  "shopify": {...},
  "connection": {...}
}
```

### Test 2: Get WhatsApp Templates

```bash
curl http://localhost:3000/api/whatsapp-templates
```

Expected response (if connected):
```json
[
  {
    "id": "123456789",
    "name": "order_confirmation",
    "status": "APPROVED",
    "category": "TRANSACTIONAL",
    "language": "en_US"
  },
  ...
]
```

Expected response (if not connected):
```json
{
  "error": "WhatsApp not configured properly...",
  "guidance": "Open Integrations and save..."
}
```

### Test 3: Send a Test Message

Use the automations test feature in your dashboard, or:

```bash
curl -X POST "http://localhost:3000/api/automations/test" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "template": "hello_world"
  }'
```

---

## Webhook Setup

Webhooks allow you to receive incoming messages and status updates.

### Step 1: Configure Webhook in Meta

1. Go to **Meta Dashboard** → **Your App** → **WhatsApp** → **Configuration**
2. Find **Webhook** section
3. Click **Edit** → **Add Callback URL**

```
┌─────────────────────────────────────────┐
│  Webhook Configuration                  │
│                                         │
│  Callback URL:                          │
│  [https://lcsw.dpdns.org/api/webhook/whatsapp]
│                                         │
│  Verify Token:                          │
│  [41ddad7ee4b44d0418876d444b36f4ac817c042c36265b5d]
│                                         │
│  [Verify and Save]                      │
└─────────────────────────────────────────┘
```

4. Click **Verify and Save**

### Step 2: Subscribe to Webhook Fields

After saving, subscribe to these fields:

| Field | Description |
|-------|-------------|
| `messages` | Incoming messages |
| `messages.statuses` | Message delivery statuses |
| `phone_number_id` | Phone number changes |

### Step 3: Verify in Your App

Your app's webhook is already configured at:
- **URL**: `https://lcsw.dpdns.org/api/webhook/whatsapp`
- **Verify Token**: `41ddad7ee4b44d0418876d444b36f4ac817c042c36265b5d`

---

## Managing Access Tokens

### Understanding Token Types

| Token Type | Duration | How to Get |
|-------------|----------|------------|
| **Temporary Access Token** | ~24 hours | Meta Dashboard → API Setup |
| **System User Access Token** | Never expires | Business Settings → System Users |

### Refreshing the Temporary Token

The temporary token expires every ~24 hours. To refresh:

#### Method 1: Manual Refresh (Recommended for Testing)

1. Go to **Meta Dashboard** → **Your App** → **WhatsApp** → **API Setup**
2. Find **Step 5: Get temporary access token**
3. Click **Click to reveal access token**
4. Copy the new token
5. Update in your app's Settings page

#### Method 2: System User Token (Recommended for Production)

For production, create a permanent token:

1. Go to **Meta Business Settings**
2. Navigate to **Users** → **System Users**
3. Click **Add**
4. Create a system user with **Admin** role
5. Assign the system user to your WhatsApp Business Account
6. Generate an access token for the system user

```
┌─────────────────────────────────────────────────────────┐
│  System Users                                           │
│  ─────────────────────────────────────────────────────  │
│  [+] Add                                                │
│                                                         │
│  Name: WhatsApp API Bot                                 │
│  Role: Admin                                            │
│  [Generate Token]                                       │
└─────────────────────────────────────────────────────────┘
```

### Setting Up Token Refresh Automation (Optional)

Create a scheduled job to refresh the token:

```javascript
// Example: Refresh token script
async function refreshWhatsAppToken() {
  const newToken = await getNewTokenFromMeta();
  await updateDatabaseToken(newToken);
  console.log('Token refreshed successfully');
}

// Run this daily via cron
setInterval(refreshWhatsAppToken, 24 * 60 * 60 * 1000);
```

---

## Troubleshooting

### Common Errors and Solutions

#### Error 1: "WhatsApp not configured"
```
Error: WhatsApp not configured properly. Missing access token or business account ID.
```

**Solution**: Go to Settings and fill in all WhatsApp credentials.

---

#### Error 2: "Access token is invalid"
```
{
  "error": {
    "message": "Invalid OAuth access token.",
    "type": "OAuthException",
    "code": 190
  }
}
```

**Solutions**:
1. Token expired - get a new one from Meta Dashboard
2. Token was copied incorrectly - check for extra spaces
3. Token was revoked - generate a new one

---

#### Error 3: "Phone number not found"
```
{
  "error": {
    "message": "Invalid phone number ID.",
    "type": "OAuthException",
    "code": 100
  }
}
```

**Solution**: 
1. Verify phoneNumberId in Meta Dashboard
2. Make sure the phone number is verified
3. Check if the phone is assigned to your business account

---

#### Error 4: "Business Account ID not found"
```
{
  "error": {
    "message": "Invalid Business Account ID",
    "type": "OAuthException",
    "code": 100
  }
}
```

**Solution**:
1. Go to Meta Dashboard → WhatsApp → API Setup
2. Copy the exact Business Account ID shown

---

#### Error 5: "Insufficient Permissions"
```
{
  "error": {
    "message": "Permission denied",
    "type": "OAuthException",
    "code": 200
  }
}
```

**Solution**:
1. Your app may need **Advanced Access** for certain permissions
2. Go to **App Review** → **Permissions and Features**
3. Request additional permissions

---

#### Error 6: "Messages sent but not delivered"
```
Status shows "sent" but not "delivered"
```

**Possible reasons**:
1. Recipient hasn't opted in to receive messages
2. Recipient's phone number is not on WhatsApp
3. 24-hour message window has expired (for regular messages)

**Solution**: Use **Template Messages** for initiating conversations outside the 24-hour window.

---

### Debugging Tips

#### 1. Enable Debug Logging

Check your server logs:
```bash
tail -f /tmp/next.log
```

#### 2. Test API Directly

Use curl to test the Meta API directly:
```bash
curl "https://graph.facebook.com/v22.0/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Check Webhook Logs

In your app, check webhook logs:
```bash
curl "http://localhost:3000/api/webhook-logs?limit=50"
```

---

## Security Best Practices

### 1. Protect Your Access Token

```javascript
// ❌ DON'T: Log or expose token
console.log("Token:", accessToken);

// ✅ DO: Mask token for logging
const maskedToken = accessToken.substring(0, 5) + "..." + accessToken.substring(accessToken.length - 5);
```

### 2. Environment Variables

Never hardcode tokens. Use environment variables:

```env
# .env file
WHATSAPP_ACCESS_TOKEN=EAAGO...
WHATSAPP_PHONE_NUMBER_ID=234567890123456
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
```

### 3. Rotate Tokens Regularly

- Temporary tokens: Rotate every 24 hours
- System user tokens: Rotate quarterly

### 4. Limit Token Permissions

Create separate system users for different functions:
- One for sending messages
- One for reading templates
- One for managing webhooks

### 5. Monitor API Usage

Check your API usage in Meta Dashboard:
```
Meta Dashboard → Your App → WhatsApp → Analytics
```

---

## API Reference

### Base URL
```
https://graph.facebook.com/v22.0
```

### Common Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/me` | GET | Get app info |
| `/{phone-number-id}/messages` | POST | Send message |
| `/{business-account-id}/message_templates` | GET | List templates |
| `/webhooks` | GET | Get webhook subscriptions |

### Example: Send Template Message

```javascript
const response = await fetch(
  `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' }
      }
    })
  }
);
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  WHATSAPP SETUP QUICK REFERENCE                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📍 Meta Developer Portal                               │
│  https://developers.facebook.com/                      │
│                                                         │
│  📍 WhatsApp Business Manager                          │
│  https://business.facebook.com/                        │
│                                                         │
│  📍 Your App Webhook URL                                │
│  https://lcsw.dpdns.org/api/webhook/whatsapp            │
│                                                         │
│  📍 Verify Token (fixed)                               │
│  41ddad7ee4b44d0418876d444b36f4ac817c042c36265b5d       │
│                                                         │
│  📍 API Version                                         │
│  v22.0                                                  │
│                                                         │
│  📍 API Base URL                                        │
│  https://graph.facebook.com/v22.0                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  NEEDED VALUES                                          │
│  ─────────────────                                      │
│  □ Phone Number ID: _____________                       │
│  □ Access Token:  _____________                         │
│  □ Business Account ID: _____________                   │
└─────────────────────────────────────────────────────────┘
```

---

## Support

If you encounter issues not covered here:

1. Check [Meta WhatsApp Documentation](https://developers.facebook.com/docs/whatsapp)
2. Check your app's logs at `/tmp/next.log`
3. Review webhook logs at `/api/webhook-logs`
4. Verify database has correct credentials:
   ```sql
   SELECT JSON_DETAILED(whatsapp) FROM integrations WHERE userId = 'default';
   ```