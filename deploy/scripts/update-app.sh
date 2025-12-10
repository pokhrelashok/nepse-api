#!/bin/bash

# NEPSE API Update Script
cd APP_DIR_PLACEHOLDER

echo "🔄 Updating NEPSE API..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Reload PM2 processes
echo "🔄 Reloading application..."
pm2 reload ecosystem.config.js

echo "✅ Application updated successfully!"
echo "📊 Current status:"
pm2 status
