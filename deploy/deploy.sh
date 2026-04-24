#!/bin/bash
set -e

APP_DIR="/var/www/whatsapp-commerce-hub"
APP_NAME="whatsapp-commerce-hub"

echo "=== Deploying WhatsApp Commerce Hub ==="

# Pull latest code
echo "[1/6] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# Install dependencies (need devDeps for build)
echo "[2/6] Installing dependencies..."
npm install

# Build
echo "[3/6] Building..."
npm run build

# Copy standalone output (DO THIS BEFORE CLEANING)
echo "[4/6] Preparing standalone output..."
node scripts/prepare-standalone.js

# Clean old static files from the ROOT (optional, but standalone now has its own copies)
# We should keep the root public folder as it's a source folder
echo "[5/6] Cleaning build artifacts..."
rm -rf "$APP_DIR/.next/cache"

# Restart app with PM2
echo "[6/6] Restarting app..."
pm2 restart "$APP_NAME" || pm2 start ecosystem.config.js

echo "=== Deployment complete! ==="
echo "App running on port 3000"
pm2 status

