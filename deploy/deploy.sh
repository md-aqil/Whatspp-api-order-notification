#!/bin/bash
set -e

APP_DIR="/var/www/whatsapp-commerce-hub"
APP_NAME="whatsapp-commerce-hub"

echo "=== Deploying WhatsApp Commerce Hub ==="

# Pull latest code
echo "[1/6] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# Install dependencies
echo "[2/6] Installing dependencies..."
npm ci --production

# Build
echo "[3/6] Building..."
npm run build

# Clean old static files before copying new ones
echo "[4/6] Cleaning old static files..."
rm -rf "$APP_DIR/.next/static"
rm -rf "$APP_DIR/public"

# Copy standalone output
echo "[5/6] Preparing standalone output..."
node scripts/prepare-standalone.js

# Restart app with PM2
echo "[6/6] Restarting app..."
pm2 restart "$APP_NAME" || pm2 start ecosystem.config.js

echo "=== Deployment complete! ==="
echo "App running on port 3000"
pm2 status
