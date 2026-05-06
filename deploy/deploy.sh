#!/bin/bash
set -e

# Detect if we are in lcsw or whatsapp-commerce-hub
CURRENT_DIR=$(pwd)
APP_DIR="$CURRENT_DIR"
SERVICE_NAME="lcsw"

echo "=== Deploying WhatsApp Commerce Hub at $APP_DIR ==="

# Code is already updated by the deploy script wrapper
echo "[1/6] Code up to date."

# Install dependencies (need devDeps for build)
echo "[2/6] Installing dependencies..."
npm install

# Build
echo "[3/6] Building..."
npm run build

# Run database migrations
echo "[4/6] Migrating database..."
if [ -f "/etc/lcsw/.env" ]; then
  # Use sudo to read it if needed, but aqil might not have perms to export directly
  # Better to load it into the node process
  export $(sudo grep -v '^#' /etc/lcsw/.env | xargs)
  node scripts/setup-mysql-tables.js
else
  echo "Warning: /etc/lcsw/.env not found, using existing environment for migration"
  node scripts/setup-mysql-tables.js
fi

# Copy standalone output (DO THIS BEFORE CLEANING)
echo "[5/6] Preparing standalone output..."
node scripts/prepare-standalone.js

# Restart app with systemd
echo "[6/6] Restarting app..."
sudo systemctl restart "$SERVICE_NAME"

echo "=== Deployment complete! ==="
systemctl status "$SERVICE_NAME" --no-pager

