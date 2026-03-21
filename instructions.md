# WhatsApp Commerce Hub - Setup Instructions

## Prerequisites

1. Node.js (version 18 or higher)
2. PostgreSQL (local or remote instance)
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
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=whatsapp_api
   DB_USER=mdaqil
   DB_PASSWORD=
   DB_URL=postgresql://mdaqil@localhost:5432/whatsapp_api
   NEXT_PUBLIC_BASE_URL=https://lcsw.dpdns.org
   CORS_ORIGINS=*
   ```
4. Initialize the database:
   ```
   node setup-postgres-tables.js
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

## Support

If you continue to have issues, verify:
- PostgreSQL is reachable with the credentials in `.env`
- `node setup-postgres-tables.js` completes successfully
- the app loads at `http://localhost:3000`

For Cloudflare tunnel issues, check:
```
start-tunnel.bat
```
