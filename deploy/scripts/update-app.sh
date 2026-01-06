#!/bin/bash
set -e

cd APP_DIR_PLACEHOLDER
echo "🔄 Updating NEPSE API with Bun..."
echo "Bun Version: $(bun -v)"

echo "📥 Pulling latest code..."
git pull origin main

# Helper for global bun if in path, or use specific path
BUN_BIN="/usr/local/bin/bun"
if ! command -v $BUN_BIN &> /dev/null; then
    BUN_BIN="bun" # Fallback to PATH
fi

echo "📦 Installing/Updating dependencies with Bun..."
$BUN_BIN install

echo "🗄️ Running Database Migrations..."
$BUN_BIN run migrate

echo "🏗️ Building Frontend..."
cd frontend
$BUN_BIN install
$BUN_BIN run build
cd ..

# System Maintenance (Server only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🧹 Cleaning up system logs and caches..."
    sudo journalctl --vacuum-time=1d || true
    sudo apt-get clean || true
fi

echo "🔄 Reloading application..."
export PM2_HOME="/home/$USER/.pm2"
# Use ecosystem.config.js (renamed from bun version)
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

echo "✅ Application updated successfully!"
echo "📊 Current status:"
pm2 status
