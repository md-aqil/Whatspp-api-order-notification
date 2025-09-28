# Cloudflare Tunnel Setup for WhatsApp Commerce Hub

This document explains how to set up Cloudflare Tunnel as a replacement for ngrok in your WhatsApp Commerce Hub.

## Prerequisites

1. A Cloudflare account with Argo Tunnel enabled
2. `cloudflared` CLI tool installed
3. Your domain (lcsw.dpdns.org) configured in Cloudflare
4. Your Cloudflare tunnel credentials

## Setup Instructions

### 1. Install cloudflared

Download and install cloudflared from the official Cloudflare website:
https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

### 2. Configure Your Tunnel

The tunnel configuration is already set up in `tunnel-config/config.yaml`:
```yaml
tunnel: whatsapptunnel
credentials-file: tunnel-config\credentials.json

ingress:
  - hostname: lcsw.dpdns.org
    service: http://localhost:3001
  - service: http_status:404
```

### 3. Add Your Credentials

The credentials file has been automatically created from your existing tunnel. If you need to recreate it:

1. Run `cloudflared tunnel run --config tunnel-config\config.yaml 0df27a77-c611-40aa-aaaa-70aadc020244`
2. The credentials file will be automatically generated in `tunnel-config/credentials.json`

### 4. Start the Tunnel

Run the tunnel using one of these methods:

#### Method 1: Using the provided script
```bash
start-tunnel.bat
```

#### Method 2: Manual command
```bash
cloudflared tunnel --config tunnel-config\config.yaml run
```

## Webhook URLs

Once the tunnel is running, your webhook URLs will be:
- Shopify Webhook: `https://lcsw.dpdns.org/api/webhook/shopify`
- WhatsApp Webhook: `https://lcsw.dpdns.org/api/webhook/whatsapp`

## Benefits of Cloudflare Tunnel over ngrok

1. **Persistent URLs**: No more changing URLs every time you restart
2. **Better Performance**: Direct integration with Cloudflare's global network
3. **Enhanced Security**: Traffic is encrypted end-to-end
4. **Custom Domains**: Use your own domain name
5. **No Rate Limits**: Unlike ngrok's free tier limitations

## Troubleshooting

### Tunnel Won't Start
- Verify cloudflared is installed and in your PATH
- Check that your credentials file exists in the correct location
- Ensure your domain is properly configured in Cloudflare

### Webhooks Not Receiving
- Verify the tunnel is running
- Check that your domain DNS is pointing to Cloudflare
- Confirm the webhook URLs are correctly configured in your Shopify/WhatsApp settings

### Error 1033 Ray ID
This error typically indicates an issue with the tunnel connection. To resolve:
1. Ensure the credentials file is valid
2. Verify the tunnel ID in config.yaml matches your actual tunnel
3. Check that cloudflared is properly installed
4. Restart both the tunnel and your application

## Need Help?

If you continue to have issues, please check:
1. Cloudflare dashboard for tunnel status
2. Run the diagnostic scripts:
   ```
   node check-webhook-logs.js
   node check-webhook-subscription.js
   ```