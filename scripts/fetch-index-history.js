#!/usr/bin/env node

/**
 * Historical Market Indices Scraper
 * Fetches historical market indices data by interacting with the NEPSE website
 * and intercepting the API response.
 * Uses the robust NepseScraper class for browser management.
 */

const { NepseScraper } = require('../src/scrapers/nepse-scraper');
const { saveMarketIndexHistory } = require('../src/database/database');
const logger = require('../src/utils/logger');
const { pool } = require('../src/database/database');

// Parse command line arguments
const args = process.argv.slice(2);
const isHeadless = !args.includes('--no-headless');

/**
 * Find Chrome/Chromium executable on the system
 * Matches logic from fetch-stock-history.js
 */
function findChromeExecutable() {
  const fs = require('fs');
  const { execSync } = require('child_process');

  // Common Chrome/Chromium paths on different systems
  const possiblePaths = [
    // Linux paths
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    // macOS paths
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Windows paths (if running under WSL or similar)
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  // Check each path
  for (const chromePath of possiblePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        logger.info(`✅ Found Chrome at: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // Continue to next path
    }
  }

  // Try using 'which' command on Unix-like systems
  try {
    const whichChrome = execSync('which google-chrome-stable || which google-chrome || which chromium || which chromium-browser', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    if (whichChrome && fs.existsSync(whichChrome)) {
      logger.info(`✅ Found Chrome via 'which': ${whichChrome}`);
      return whichChrome;
    }
  } catch (e) {
    // 'which' command failed or not available
  }

  return null;
}

async function fetchIndexHistory() {
  // Configure Chrome path before initializing scraper
  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    const systemChrome = findChromeExecutable();
    if (systemChrome) {
      console.log(`🔧 Setting PUPPETEER_EXECUTABLE_PATH to ${systemChrome}`);
      process.env.PUPPETEER_EXECUTABLE_PATH = systemChrome;
    } else {
      console.log('📦 Using bundled Chromium (no system Chrome found)');
    }
  }

  logger.info(`🚀 Starting Market Indices History Scraper (Headless: ${isHeadless})...`);

  const scraper = new NepseScraper({ headless: isHeadless });

  try {
    const data = await scraper.scrapeMarketIndicesHistory();

    if (!data || data.length === 0) {
      throw new Error('No data received from scraper');
    }

    // Map of known index IDs to names
    const indexNames = {
      58: 'NEPSE Index',
      57: 'Sensitive Index',
      59: 'Float Index',
      60: 'Sensitive Float Index',
    };

    const formattedData = data.map(record => ({
      business_date: record.businessDate,
      exchange_index_id: record.exchangeIndexId,
      index_name: indexNames[record.exchangeIndexId] || `Index ${record.exchangeIndexId}`,
      closing_index: parseFloat(record.closingIndex) || 0,
      open_index: parseFloat(record.openIndex) || 0,
      high_index: parseFloat(record.highIndex) || 0,
      low_index: parseFloat(record.lowIndex) || 0,
      fifty_two_week_high: parseFloat(record.fiftyTwoWeekHigh) || 0,
      fifty_two_week_low: parseFloat(record.fiftyTwoWeekLow) || 0,
      turnover_value: parseFloat(record.turnoverValue) || 0,
      turnover_volume: parseFloat(record.turnoverVolume) || 0,
      total_transaction: parseInt(record.totalTransaction) || 0,
      abs_change: parseFloat(record.absChange) || 0,
      percentage_change: parseFloat(record.percentageChange) || 0
    }));

    logger.info(`💾 Saving ${formattedData.length} records to database...`);
    const count = await saveMarketIndexHistory(formattedData);
    logger.info(`✅ Successfully saved ${count} historical index records`);

  } catch (error) {
    logger.error(`❌ Scraper failed: ${error.message}`);
    process.exit(1);
  } finally {
    await scraper.close();
    await pool.end();
  }
}

if (require.main === module) {
  fetchIndexHistory();
}
