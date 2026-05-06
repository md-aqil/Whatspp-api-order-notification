#!/bin/bash

# WhatsApp Commerce Hub - Start Dev Server and Cloudflare Tunnel
# Usage: ./start-tunnel.sh

echo "=========================================="
echo "  Starting Next.js Server & Tunnel"
echo "=========================================="
echo ""

# Start Next.js in the background
echo "Starting local Next.js server on port 3000..."
npm run dev &
NEXT_PID=$!

# Start the Automation Queue Worker in the background
echo "Starting background Automation Queue Worker..."
npx tsx scripts/worker.js &
WORKER_PID=$!

# Give the server a few seconds to initialize
sleep 4

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "ERROR: cloudflared is not installed"
    echo "Please install: brew install cloudflared"
    kill $NEXT_PID
    kill $WORKER_PID
    exit 1
fi

echo "✅ cloudflared is installed"
echo ""
echo "Connecting Tunnel to http://localhost:3000..."
echo "Press Ctrl+C to stop the server, worker, and tunnel"
echo ""

# Start permanent Cloudflare tunnel (mapped to lcsw.dpdns.org)
cloudflared tunnel run --url http://localhost:3000 whatsapp-tunnel

# When tunnel exits (or Ctrl+C is pressed), kill the background processes
echo "Stopping background processes..."
kill $NEXT_PID
kill $WORKER_PID
echo ""
echo "Server, Worker, and Tunnel have been successfully stopped."


