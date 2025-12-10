#!/usr/bin/env node

/**
 * Puppeteer Test Script for Ubuntu 24.04 Server
 * 
 * This script tests basic Puppeteer functionality to diagnose issues
 * Run with: node puppeteer-test.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testPuppeteer() {
  console.log('🚀 Starting Puppeteer test...');
  console.log('📋 System Information:');
  console.log(`- Node.js version: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Architecture: ${process.arch}`);
  console.log(`- Working directory: ${process.cwd()}`);

  let browser = null;

  try {
    // Test 1: Check Puppeteer version
    console.log('\n📦 Checking Puppeteer installation...');
    const puppeteerVersion = require('puppeteer/package.json').version;
    console.log(`✅ Puppeteer version: ${puppeteerVersion}`);

    // Test 2: Check Chrome executable paths
    console.log('\n🔍 Checking Chrome executables...');
    const possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/opt/google/chrome/chrome',
      process.env.PUPPETEER_EXECUTABLE_PATH
    ].filter(Boolean);

    let foundExecutable = null;
    for (const execPath of possiblePaths) {
      if (fs.existsSync(execPath)) {
        console.log(`✅ Found Chrome executable: ${execPath}`);
        foundExecutable = execPath;
        break;
      } else {
        console.log(`❌ Not found: ${execPath}`);
      }
    }

    // Test 3: Launch browser with different configurations
    console.log('\n🌐 Testing browser launch...');

    const launchConfigs = [
      {
        name: 'Bundled Chromium',
        options: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security'
          ]
        }
      },
      {
        name: 'System Chrome (if available)',
        options: foundExecutable ? {
          headless: true,
          executablePath: foundExecutable,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security'
          ]
        } : null
      },
      {
        name: 'Minimal Configuration',
        options: {
          headless: true,
          args: ['--no-sandbox']
        }
      }
    ];

    for (const config of launchConfigs) {
      if (!config.options) {
        console.log(`⏭️  Skipping ${config.name} - not available`);
        continue;
      }

      console.log(`\n🧪 Testing: ${config.name}`);
      try {
        console.log('   Launching browser...');
        browser = await puppeteer.launch(config.options);
        console.log('   ✅ Browser launched successfully');

        console.log('   Creating new page...');
        const page = await browser.newPage();
        console.log('   ✅ Page created successfully');

        console.log('   Setting user agent...');
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        console.log('   ✅ User agent set successfully');

        console.log('   Testing navigation to Google...');
        await page.goto('https://www.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        console.log('   ✅ Navigation successful');

        console.log('   Testing page evaluation...');
        const title = await page.evaluate(() => document.title);
        console.log(`   ✅ Page title: ${title}`);

        console.log('   Testing Nepal Stock Exchange...');
        await page.goto('https://www.nepalstock.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        const nepseTitle = await page.evaluate(() => document.title);
        console.log(`   ✅ NEPSE title: ${nepseTitle}`);

        await browser.close();
        browser = null;
        console.log(`   ✅ ${config.name} test PASSED`);

        // If we reach here, this configuration works
        console.log(`\n🎉 SUCCESS: ${config.name} works perfectly!`);
        console.log('📋 Recommended configuration:');
        console.log(JSON.stringify(config.options, null, 2));
        return;

      } catch (error) {
        console.log(`   ❌ ${config.name} test FAILED: ${error.message}`);
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.log(`   ⚠️  Error closing browser: ${closeError.message}`);
          }
          browser = null;
        }
      }
    }

    console.log('\n❌ All browser configurations failed');

  } catch (error) {
    console.error('\n💥 Test script error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.log(`⚠️  Error closing browser in cleanup: ${closeError.message}`);
      }
    }
  }

  // Test 4: Check system dependencies
  console.log('\n🔧 Checking system dependencies...');
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  const commands = [
    'which google-chrome',
    'which chromium-browser',
    'google-chrome --version',
    'chromium-browser --version',
    'ldd --version',
    'which xvfb-run'
  ];

  for (const cmd of commands) {
    try {
      const { stdout, stderr } = await execPromise(cmd);
      console.log(`✅ ${cmd}: ${stdout.trim()}`);
    } catch (error) {
      console.log(`❌ ${cmd}: ${error.message}`);
    }
  }

  // Test 5: Environment variables
  console.log('\n🌍 Environment variables:');
  const envVars = [
    'PUPPETEER_EXECUTABLE_PATH',
    'DISPLAY',
    'CHROME_BIN',
    'CHROMIUM_BIN',
    'NODE_ENV'
  ];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: ${value}`);
    } else {
      console.log(`❌ ${envVar}: not set`);
    }
  }

  console.log('\n📊 Test completed. Check the output above for issues.');
  console.log('\n💡 Common fixes for Ubuntu 24.04:');
  console.log('1. Install Chrome: wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add - && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list && sudo apt update && sudo apt install google-chrome-stable');
  console.log('2. Install dependencies: sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils');
  console.log('3. Set executable path: export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable');
  console.log('4. For headless servers: sudo apt-get install xvfb');
}

// Run the test
testPuppeteer().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});