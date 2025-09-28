# WhatsApp Commerce Hub

A comprehensive solution for integrating WhatsApp with Shopify for order notifications and customer communication.

## Features

- Real-time Shopify order notifications via WhatsApp
- Customer communication through WhatsApp
- Dashboard for managing conversations
- Product catalog integration with WhatsApp

## Prerequisites

- Node.js (v18+)
- MongoDB
- Facebook/WhatsApp Business Account
- Shopify Store
- Cloudflare Account with Argo Tunnel

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Configure Environment

Update the `.env` file with your configuration:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=WhatsApp_api
NEXT_PUBLIC_BASE_URL=https://lcsw.dpdns.org
CORS_ORIGINS=*
```

### 3. Initialize Database

```bash
node scripts/init-db.js
```

### 4. Cloudflare Tunnel Setup

This project uses Cloudflare Tunnel instead of ngrok for exposing your local server to the internet.

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
2. Run `setup-cloudflare-tunnel.bat` for setup instructions
3. Place your tunnel credentials in `tunnel-config/credentials.json`
4. Start the tunnel: `start-tunnel.bat`

### 5. Start the Application

```bash
# Terminal 1: Start the development server
start-project.bat

# Terminal 2: Start the Cloudflare tunnel
start-tunnel.bat
```

## Webhook URLs

- Shopify Webhook: `https://lcsw.dpdns.org/api/webhook/shopify`
- WhatsApp Webhook: `https://lcsw.dpdns.org/api/webhook/whatsapp`

## Documentation

- [Setup Instructions](instructions.md)
- [Cloudflare Tunnel Setup](CLOUDFLARE_TUNNEL_SETUP.md)
- [Dashboard Usage](DASHBOARD.md)
- [WhatsApp Integration Guide](WHATSAPP_CATALOG_INTEGRATION_GUIDE.md)

## Testing

Run the provided test scripts to verify your setup:

```bash
node test-db.js              # Test database connection
node test-webhook-access.js  # Test webhook accessibility
node check-webhook-logs.js   # Check recent webhook logs
```