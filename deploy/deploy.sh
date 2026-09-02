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
node scripts/setup-mysql-tables.js || true

# Copy standalone output (DO THIS BEFORE RESTARTING)
echo "[5/6] Preparing standalone output..."
node scripts/prepare-standalone.js

# Restart app and worker with systemd
echo "[6/6] Restarting app and worker..."
if [ -n "$SUDO_PASS" ]; then
  echo "$SUDO_PASS" | sudo -S systemctl restart "$SERVICE_NAME" || true
  echo "$SUDO_PASS" | sudo -S systemctl restart "$SERVICE_NAME-worker" || true
else
  sudo systemctl restart "$SERVICE_NAME" || true
  sudo systemctl restart "$SERVICE_NAME-worker" || true
fi

echo "=== Deployment complete! ==="
