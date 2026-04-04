#!/bin/bash
set -e

APP_DIR="/var/www/whatsapp-commerce-hub"
APP_NAME="whatsapp-commerce-hub"

echo "=== Deploying WhatsApp Commerce Hub ==="

# Pull latest code
echo "[1/5] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# Install dependencies
echo "[2/5] Installing dependencies..."
npm ci --production

# Build
echo "[3/5] Building..."
npm run build

# Copy standalone output
echo "[4/5] Preparing standalone output..."
node scripts/prepare-standalone.js

# Restart app with PM2
echo "[5/5] Restarting app..."
pm2 restart "$APP_NAME" || pm2 start ecosystem.config.js

echo "=== Deployment complete! ==="
echo "App running on port 3000"
pm2 status
