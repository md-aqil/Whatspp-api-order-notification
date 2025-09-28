@echo off
title WhatsApp Commerce Hub - Cloudflare Tunnel Setup

echo ==========================================
echo   WhatsApp Commerce Hub - Cloudflare Tunnel Setup
echo ==========================================
echo.

echo This script will help you set up Cloudflare Tunnel for your WhatsApp Commerce Hub.
echo.

echo Prerequisites:
echo 1. Cloudflare account with Argo Tunnel enabled
echo 2. Cloudflared installed on your system
echo 3. Your tunnel credentials file (credentials.json)
echo.

echo Setup Instructions:
echo 1. Install cloudflared if not already installed:
echo    Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
echo.
echo 2. Place your tunnel credentials file in the tunnel-config directory
echo    The file should be named 'credentials.json'
echo.
echo 3. Update the config.yaml file with the correct path to your credentials file
echo.
echo 4. Run the tunnel with the following command:
echo    cloudflared tunnel --config tunnel-config\config.yaml run
echo.
echo 5. Your webhook URL will be:
echo    https://lcsw.dpdns.org/api/webhook/shopify
echo    or
echo    https://lcsw.dpdns.org/api/webhook/whatsapp
echo.

echo Note: Make sure your domain (lcsw.dpdns.org) is configured in your Cloudflare dashboard
echo and points to your tunnel.

echo.
echo Troubleshooting Cloudflare Tunnel Error 1033:
echo If you encounter Error 1033:
echo 1. Check that credentials.json exists in tunnel-config directory
echo 2. Verify the tunnel ID in config.yaml matches credentials.json
echo 3. Refer to CLOUDFLARE_ERROR_1033_TROUBLESHOOTING.md for detailed steps
echo.

echo Press any key to continue...
pause >nul