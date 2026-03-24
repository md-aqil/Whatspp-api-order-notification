# WhatsApp Commerce Hub

A comprehensive solution for integrating WhatsApp with Shopify for order notifications and customer communication.

## Features

- Real-time Shopify order notifications via WhatsApp
- Customer communication through WhatsApp
- Dashboard for managing conversations
- Product catalog integration with WhatsApp

## Prerequisites

- Node.js (v18+)
- PostgreSQL
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

### 3. Initialize Database

```bash
node setup-postgres-tables.js
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
