#!/bin/bash

# Messaging Module - Dashboard Restart Script
# This script helps restart the Vite dev server with cache clearing

echo "🔄 Restarting Dashboard Dev Server..."
echo ""

cd "$(dirname "$0")/dashboard"

# Check if dev server is running
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⏹️  Stopping existing dev server on port 5173..."
    # Kill process on port 5173
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 1
fi

# Clear Vite cache
if [ -d "node_modules/.vite" ]; then
    echo "🗑️  Clearing Vite cache..."
    rm -rf node_modules/.vite
fi

# Start dev server
echo "▶️  Starting dev server..."
npm run dev

