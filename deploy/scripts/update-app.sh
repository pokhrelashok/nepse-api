#!/bin/bash
set -e

cd APP_DIR_PLACEHOLDER
echo "🔄 Updating NEPSE API with Bun..."
echo "Bun Version: $(bun -v)"

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing/Updating dependencies with Bun..."
# Install using bun install (20-40x faster than npm!)
bun install

echo "🗄️ Running Database Migrations..."
bun run bun:migrate

echo "🏗️ Building Frontend..."
bun run build

echo "🔄 Reloading application..."
export PM2_HOME="/home/$USER/.pm2"
pm2 reload ecosystem.config.bun.js || pm2 restart ecosystem.config.bun.js

echo "✅ Application updated successfully!"
echo "📊 Current status:"
pm2 status
