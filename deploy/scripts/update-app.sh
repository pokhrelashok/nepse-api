#!/bin/bash
set -e

cd APP_DIR_PLACEHOLDER
echo "🔄 Updating NEPSE API..."
echo "Node Version: $(node -v)"
echo "NPM Version: $(npm -v)"

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing/Updating dependencies..."
# Install using npm install to ensure devDependencies (vite, etc) are available for build
npm install

echo "🗄️ Running Database Migrations..."
npm run migrate

echo "🏗️ Building Frontend..."
npm run build

echo "🔄 Reloading application..."
export PM2_HOME="/home/$USER/.pm2"
pm2 reload ecosystem.config.js || pm2 restart ecosystem.config.js

echo "✅ Application updated successfully!"
echo "📊 Current status:"
pm2 status
