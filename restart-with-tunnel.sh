#!/bin/bash

# WhatsApp Commerce Hub - Restart lcsw Service and Start Tunnel
# Usage: ./restart-with-tunnel.sh
# Restarts lcsw service on server and starts Cloudflare tunnel

echo "=========================================="
echo "  Restart lcsw + Start Tunnel"
echo "=========================================="
echo ""

# Ask for confirmation
echo "This will:"
echo "  1. Restart lcsw service on server (187.127.154.55)"
echo "  2. Start Cloudflare tunnel to localhost:3015"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "=========================================="
echo "  Step 1: Restart lcsw on server"
echo "=========================================="
echo ""

ssh -t aqil@187.127.154.55 'echo "aqil@noon" | sudo -S systemctl restart lcsw && echo "✅ lcsw restarted"'

echo ""
echo "Waiting for service to be ready..."
sleep 5

echo ""
echo "=========================================="
echo "  Step 2: Start Cloudflare Tunnel"
echo "=========================================="
echo ""

cloudflared tunnel --url http://localhost:3015
