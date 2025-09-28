# WhatsApp Commerce Hub - Setup Instructions

## Prerequisites

1. Node.js (version 18 or higher)
2. MongoDB (local or remote instance)
3. Facebook/WhatsApp Business account
4. Shopify account (for integration)
5. Cloudflare account with Argo Tunnel enabled

## Initial Setup

1. Clone or download this repository
2. Install dependencies:
   ```
   yarn install
   ```
3. Set up your environment variables in `.env`:
   ```
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=WhatsApp_api
   NEXT_PUBLIC_BASE_URL=https://lcsw.dpdns.org
   CORS_ORIGINS=*
   ```
4. Initialize the database:
   ```
   node scripts/init-db.js
   ```

## Cloudflare Tunnel Setup

Instead of using ngrok, this project now uses Cloudflare Tunnel for exposing your local server to the internet.

### Setup Instructions

1. Install cloudflared from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Run `setup-cloudflare-tunnel.bat` for detailed instructions
3. Place your tunnel credentials file in the `tunnel-config` directory
4. Start the tunnel with `start-tunnel.bat`

### Webhook URLs

Once the tunnel is running, your webhook URLs will be:
- Shopify Webhook: `https://lcsw.dpdns.org/api/webhook/shopify`
- WhatsApp Webhook: `https://lcsw.dpdns.org/api/webhook/whatsapp`

## Starting the Application

1. Start the development server:
   ```
   start-project.bat
   ```
2. In a separate terminal/command prompt, start the Cloudflare tunnel:
   ```
   start-tunnel.bat
   ```

## Configuration

### WhatsApp Integration

1. Go to the Facebook Developer Portal
2. Create or configure your WhatsApp application
3. Note your:
   - App ID
   - App Secret
   - Access Token
   - Phone Number ID
4. Configure these in the dashboard settings

### Shopify Integration

1. Create a private app in your Shopify store
2. Note your:
   - Store domain (e.g., yourstore.myshopify.com)
   - Access token
3. Configure these in the dashboard settings

## Testing

You can test various components using the provided scripts:

```
node test-db.js              # Test database connection
node test-webhook-access.js  # Test webhook endpoint accessibility
node test-whatsapp-api.js    # Test WhatsApp API connectivity
node check-webhook-logs.js   # Check recent webhook logs
```

## Support

If you continue to have issues, please run:
```
node check_webhook_logs.js
node check_whatsapp_logs.js
```

And share the output for further assistance.

For Cloudflare tunnel issues, check:
```
node check-webhook-subscription.js
```