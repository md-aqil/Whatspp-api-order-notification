#!/bin/bash

# WhatsApp Commerce Hub - Stop All Tunnel Connections
# Usage: ./stop-tunnel.sh
# Stops Cloudflare tunnel and lcsw service

echo "=========================================="
echo "  Stop All Connections"
echo "=========================================="
echo ""

# Kill Cloudflare tunnel
echo "Stopping Cloudflare tunnel..."
pgrep -f cloudflared | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Cloudflare tunnel stopped"
else
    echo "ℹ️  No Cloudflare tunnel running"
fi
echo ""

# Stop lcsw service on server (if applicable)
echo "To stop the lcsw service on the remote server, run:"
echo "  ssh aqil@187.127.154.55 'echo \"aqil@noon\" | sudo -S systemctl stop lcsw'"
echo ""

# Kill any remaining Next.js processes
echo "Checking for remaining processes..."
pkill -f "next dev" 2>/dev/null
pkill -f "next dev --port 3015" 2>/dev/null

echo "✅ All local connections stopped"
echo ""
