#!/bin/bash

# WhatsApp Commerce Hub - Start Next.js and Cloudflare Tunnel
# Usage: ./start-tunnel.sh

echo "=========================================="
echo "  WhatsApp Commerce Hub - Starting Everything"
echo "=========================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "ERROR: cloudflared is not installed"
    echo "Please install: brew install cloudflared"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ npm and cloudflared are installed"
echo ""

echo "=========================================="
echo "Starting Next.js app and Cloudflare Tunnel"
echo "=========================================="
echo ""
echo "Next.js will start on http://localhost:3000"
echo "Tunnel: A temporary URL will be generated below..."
echo ""
echo "Press Ctrl+C to stop everything"
echo ""

# Start Next.js in background
echo "Starting Next.js..."
NODE_OPTIONS="--max-old-space-size=1024" npx next dev --hostname 0.0.0.0 --port 3000 &
NEXT_PID=$!

# Wait for Next.js to start
echo "Waiting for Next.js to start..."
sleep 10

# Start Cloudflare tunnel (Quick Tunnel for local dev)
echo "Starting Temporary Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:3000

# If tunnel stops, kill Next.js
kill $NEXT_PID 2>/dev/null

echo ""
echo "Both services have been stopped."
