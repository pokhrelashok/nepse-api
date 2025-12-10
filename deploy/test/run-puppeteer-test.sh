#!/bin/bash

# Puppeteer Test Runner for Ubuntu 24.04
# This script runs the Puppeteer test and provides additional system information

echo "🚀 Puppeteer Test Runner for Ubuntu 24.04"
echo "=========================================="
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Error: node_modules not found. Please run 'npm install' first."
    exit 1
fi

# Display system information
echo "📋 System Information:"
echo "- OS: $(lsb_release -d 2>/dev/null | cut -f2 || echo 'Unknown')"
echo "- Kernel: $(uname -r)"
echo "- Memory: $(free -h | grep '^Mem:' | awk '{print $2 " total, " $3 " used, " $7 " available"}')"
echo "- Disk space: $(df -h . | tail -1 | awk '{print $4 " available"}')"
echo

# Check if Chrome is installed
echo "🔍 Checking Chrome installation..."
if command -v google-chrome >/dev/null 2>&1; then
    echo "✅ Google Chrome found: $(google-chrome --version)"
elif command -v chromium-browser >/dev/null 2>&1; then
    echo "✅ Chromium found: $(chromium-browser --version)"
else
    echo "❌ No Chrome/Chromium found"
    echo "💡 Install Chrome with:"
    echo "   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -"
    echo "   echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' | sudo tee /etc/apt/sources.list.d/google-chrome.list"
    echo "   sudo apt update && sudo apt install google-chrome-stable"
    echo
fi

# Check display
if [ -z "$DISPLAY" ]; then
    echo "⚠️  No DISPLAY variable set (headless environment)"
else
    echo "✅ DISPLAY variable: $DISPLAY"
fi

# Check if Xvfb is available for headless environments
if command -v xvfb-run >/dev/null 2>&1; then
    echo "✅ Xvfb available for virtual display"
else
    echo "❌ Xvfb not found (install with: sudo apt-get install xvfb)"
fi

echo
echo "🧪 Running Puppeteer test..."
echo "================================"

# Run the test
node deploy/test/puppeteer-test.js

# Check exit code
if [ $? -eq 0 ]; then
    echo
    echo "🎉 Test completed successfully!"
else
    echo
    echo "❌ Test failed. Check the output above for details."
    echo
    echo "💡 Quick troubleshooting steps:"
    echo "1. Install Chrome dependencies:"
    echo "   sudo apt-get update"
    echo "   sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils"
    echo
    echo "2. Install Chrome browser:"
    echo "   sudo apt-get install google-chrome-stable"
    echo
    echo "3. For headless servers:"
    echo "   sudo apt-get install xvfb"
    echo
    echo "4. Set executable path in environment:"
    echo "   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable"
    exit 1
fi