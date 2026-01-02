#!/usr/bin/env node

/**
 * Stock Price History Scraper (UI Interaction)
 * Fetches historical stock price data by interacting with the Nepal Stock Exchange
 * web interface - filling forms and clicking buttons like a real user.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const puppeteer = require('puppeteer');
const { pool, saveStockPriceHistory } = require('../src/database/database');
const logger = require('../src/utils/logger');

// ... (rest of file)

// Main execution function
async function main() {
  console.log('🚀 Stock Price History Scraper (UI Interaction)');
  console.log('================================================');
  console.log(`Date Range: ${START_DATE} to ${END_DATE}`);
  console.log(`Test Mode: ${isTestMode ? 'YES (limit: ' + testLimit + ')' : 'NO'}`);
  console.log('');

  let browser;
  let userDataDir = null;

  try {
    logger.info('Launching browser...');

    // Create a unique temp directory for this session
    const tmpDir = os.tmpdir();
    userDataDir = fs.mkdtempSync(path.join(tmpDir, 'nepse-history-'));
    logger.info(`📂 Created temp user data dir: ${userDataDir}`);

    const launchOptions = {
      headless: true,
      userDataDir: userDataDir,
      pipe: true,
      timeout: 60000,
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--disable-background-networking',
        '--disable-background-mode',
        '--disable-http2',
        '--aggressive-cache-discard',
        '--disable-cache',
        '--media-cache-size=0',
        '--disk-cache-size=0',
        '--ignore-certificate-errors'
      ]
    };

    // Use system Chrome in production
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      logger.info(`🔧 Using Chrome executable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      logger.info('📦 Using bundled Chromium');
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    logger.info('Navigating to Stock Trading History page...');

    // Go directly to the stock trading history page
    await page.goto('https://www.nepalstock.com/stock-trading', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    logger.info('Page loaded. Waiting for UI elements...');
    await sleep(3000);

    // Fetch all companies
    logger.info('Fetching companies from database...');
    let companies = await getAllCompanies();

    if (isTestMode) {
      companies = companies.slice(0, testLimit);
      logger.info(`Test mode: Processing only ${companies.length} companies`);
    }

    logger.info(`Found ${companies.length} companies to process\n`);

    const results = [];
    const totalCompanies = companies.length;

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const result = await processCompany(page, company, i, totalCompanies);
      results.push(result);

      // Reset the form for the next company
      const resetButton = await page.$('button.box__filter--reset');
      if (resetButton) {
        await resetButton.click();
        await sleep(1000);
      }

      if (i < companies.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }

      if ((i + 1) % 10 === 0) {
        const successful = results.filter(r => r.success).length;
        const totalRecords = results.reduce((sum, r) => sum + (r.count || 0), 0);
        console.log('');
        logger.info(`Progress: ${i + 1}/${totalCompanies} companies | ${successful} successful | ${totalRecords} total records`);
        console.log('');
      }
    }

    console.log('');
    console.log('================================================');
    console.log('📊 Summary');
    console.log('================================================');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalRecords = results.reduce((sum, r) => sum + (r.count || 0), 0);

    console.log(`Total Companies: ${totalCompanies}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Total Records Saved: ${totalRecords}`);

    if (failed.length > 0) {
      console.log('');
      console.log('Failed Companies:');
      failed.forEach(f => {
        console.log(`  - ${f.symbol}: ${f.error}`);
      });
    }

    console.log('');
    logger.info('✅ Stock price history scraper completed!');

  } catch (error) {
    logger.error('Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    await pool.end();

    if (userDataDir) {
      try {
        logger.info(`🧹 Cleaning up temp dir: ${userDataDir}`);
        fs.rmSync(userDataDir, { recursive: true, force: true });
        logger.info('✅ Temp dir cleaned up');
      } catch (err) {
        logger.warn(`⚠️ Failed to clean up temp dir: ${err.message}`);
      }
    }
  }
}

main();
