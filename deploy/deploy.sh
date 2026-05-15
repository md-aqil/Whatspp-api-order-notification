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
  export $(grep -v 	'^#' /etc/lcsw/.env | xargs)
  node scripts/setup-mysql-tables.js
else
  echo "Warning: /etc/lcsw/.env not found, using existing environment for migration"
  node scripts/setup-mysql-tables.js
fi

# Copy standalone output (DO THIS BEFORE CLEANING)
echo "[5/6] Preparing standalone output..."
node scripts/prepare-standalone.js

# Restart app and worker with systemd
echo "[6/6] Restarting app and worker..."
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME-worker" || sudo pm2 restart "$SERVICE_NAME-worker" || true

echo "=== Deployment complete! ==="
sudo systemctl status "$SERVICE_NAME" --no-pager
sudo systemctl status "$SERVICE_NAME-worker" --no-pager || true
