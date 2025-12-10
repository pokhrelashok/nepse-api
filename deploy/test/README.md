# Puppeteer Testing for Ubuntu 24.04

This directory contains testing scripts to diagnose Puppeteer issues on Ubuntu 24.04 servers.

## Files

- `puppeteer-test.js` - Comprehensive Puppeteer test script
- `run-puppeteer-test.sh` - Shell script wrapper with system checks
- `README.md` - This file

## Quick Start

### Option 1: Run the shell script (recommended)

```bash
# From project root directory
./deploy/test/run-puppeteer-test.sh
```

### Option 2: Run the Node.js script directly

```bash
# From project root directory
node deploy/test/puppeteer-test.js
```

## What the Test Does

The test script performs the following checks:

1. **System Information** - Node.js version, platform, architecture
2. **Puppeteer Installation** - Verifies Puppeteer is installed and gets version
3. **Chrome Executable Detection** - Searches for Chrome/Chromium binaries
4. **Browser Launch Tests** - Tries different configurations:
   - Bundled Chromium
   - System Chrome (if available)
   - Minimal configuration
5. **Navigation Tests** - Tests loading Google and Nepal Stock Exchange
6. **System Dependencies** - Checks for required libraries and tools
7. **Environment Variables** - Displays relevant environment settings

## Common Issues and Solutions

### Issue: Chrome not found

```bash
# Install Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install google-chrome-stable
```

### Issue: Missing dependencies

```bash
# Install Chrome dependencies
sudo apt-get update
sudo apt-get install -y \
  gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
  libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
  libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
  libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
  fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

### Issue: Headless server (no display)

```bash
# Install virtual display
sudo apt-get install xvfb

# Set executable path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

## Understanding the Output

### ✅ Success indicators

- Browser launches without errors
- Pages load successfully
- Page evaluation works

### ❌ Failure indicators

- Chrome executable not found
- Browser launch fails
- Navigation timeouts
- Missing dependencies

## Integration with Your App

Once you identify a working configuration, update your main scraper to use the same launch options:

```javascript
const launchOptions = {
  headless: true,
  executablePath: '/usr/bin/google-chrome-stable', // Use the path that works
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
    // Add other args that work from the test
  ]
};
```

## Troubleshooting Tips

1. **Run as non-root user** - Puppeteer should not run as root
2. **Check disk space** - Chrome needs temporary space
3. **Verify permissions** - Ensure Chrome executable has proper permissions
4. **Test network connectivity** - Ensure the server can reach external websites
5. **Check memory** - Chrome requires sufficient RAM (at least 512MB available)

## Environment Variables

Set these in your production environment if needed:

```bash
# Chrome executable path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Skip Chromium download (if using system Chrome)
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set display for headless
export DISPLAY=:99
```
