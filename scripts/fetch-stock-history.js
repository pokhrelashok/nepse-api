#!/usr/bin/env node

/**
 * Stock Price History Scraper (UI Interaction)
 * Fetches historical stock price data by interacting with the Nepal Stock Exchange
 * web interface - filling forms and clicking buttons like a real user.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const puppeteer = require('puppeteer');
const { pool, saveStockPriceHistory } = require('../src/database/database');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const testLimit = limitArg ? parseInt(limitArg.split('=')[1]) : 3;

// Date range for historical data (MM/DD/YYYY format)
const START_DATE = '01/02/2025';
const END_DATE = '01/02/2026';

// Flags and Filters
const symbolsArg = args.find(arg => arg.startsWith('--symbols='));
const targetSymbols = symbolsArg ? symbolsArg.split('=')[1].split(',').map(s => s.trim().toUpperCase()) : null;
const isMissingOnly = args.includes('--missing');
const isAffectedOnly = args.includes('--affected');

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find Chrome/Chromium executable on the system
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

/**
 * Fetch all companies from database with optional filters
 */
async function getAllCompanies(options = {}) {
  let sql = 'SELECT security_id, symbol, company_name FROM company_details';
  const params = [];
  const conditions = [];

  if (options.targetSymbols && options.targetSymbols.length > 0) {
    conditions.push(`symbol IN (${options.targetSymbols.map(() => '?').join(',')})`);
    params.push(...options.targetSymbols);
  }

  if (options.missingOnly) {
    conditions.push(`security_id NOT IN (SELECT DISTINCT security_id FROM stock_price_history)`);
  }

  if (options.affectedOnly) {
    // Find symbols that could be confused in autocomplete:
    // 1. Symbols that are prefixes of other symbols (e.g., JBLB vs JBLBP)
    // 2. Companies with similar names that could match in search (e.g., SANIMA vs SNMAPO)
    conditions.push(`EXISTS (
      SELECT 1 FROM company_details cd2 
      WHERE cd2.symbol != company_details.symbol 
      AND (
        cd2.symbol LIKE CONCAT(company_details.symbol, '%') 
        OR company_details.symbol LIKE CONCAT(cd2.symbol, '%')
        OR (
          -- Check if company names share significant common words
          LENGTH(company_details.company_name) > 10 
          AND LENGTH(cd2.company_name) > 10
          AND (
            cd2.company_name LIKE CONCAT('%', SUBSTRING_INDEX(company_details.company_name, ' ', 2), '%')
            OR company_details.company_name LIKE CONCAT('%', SUBSTRING_INDEX(cd2.company_name, ' ', 2), '%')
          )
        )
      )
    )`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY symbol';

  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Fetch historical price data by intercepting the API response
 */
async function fetchStockHistory(page, securityId, symbol) {
  try {
    logger.info(`  🔍 Searching for ${symbol}...`);

    // Set up API response interception
    let apiResponse = null;

    page.on('response', async (response) => {
      const url = response.url();
      // Intercept the market history API call
      if (url.includes('/api/nots/market/history/security/')) {
        try {
          const data = await response.json();
          if (data && data.content && Array.isArray(data.content)) {
            apiResponse = data.content;
            logger.info(`  � Intercepted API response with ${data.content.length} records`);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    });

    // Fill in the symbol search field
    const symbolInput = await page.$('input.symbol-search');
    if (!symbolInput) {
      logger.error(`  ❌ Could not find symbol search input`);
      return [];
    }

    await symbolInput.click({ clickCount: 3 }); // Select all existing text
    await symbolInput.type(symbol, { delay: 100 });
    await sleep(1000); // Wait for autocomplete

    // Wait for and click the exact autocomplete result
    logger.info(`  ⏳ Waiting for dropdown for ${symbol}...`);
    try {
      // Use a broader selector and longer timeout
      await page.waitForSelector('.dropdown-item', { timeout: 5000 });
      const items = await page.$$('.dropdown-item');

      let matched = false;
      for (const item of items) {
        const text = await page.evaluate(el => el.innerText, item);
        const trimmedText = text.trim();
        const match = trimmedText.match(/^\((.*?)\)/);

        if (match && match[1].trim() === symbol.trim()) {
          logger.info(`  ✅ Found exact match: ${trimmedText}`);
          // Use JS click for better stability in certain components
          await page.evaluate(el => el.click(), item);
          matched = true;
          break;
        }
      }

      if (matched) {
        // Wait for input to be updated
        await sleep(500);
        const newValue = await page.evaluate(el => el.value, symbolInput);
        logger.info(`  📝 Selected in UI: ${newValue}`);

        // Final sanity check: does the selected value actually contain our symbol?
        if (!newValue.includes(`(${symbol})`)) {
          logger.warn(`  ⚠️  Selected value "${newValue}" does not match expected symbol "(${symbol})". Retrying with Enter...`);
          await symbolInput.press('Enter');
        }
      } else {
        logger.warn(`  ⚠️  No exact match found in dropdown for ${symbol}, falling back to Enter...`);
        await symbolInput.press('Enter');
      }
    } catch (e) {
      logger.warn(`  ⚠️  Dropdown did not appear or timed out for ${symbol}, falling back to Enter...`);
      await symbolInput.press('Enter');
    }
    await sleep(500);

    // Fill in the date fields
    const dateInputs = await page.$$('input[bsdatepicker]');
    if (dateInputs.length >= 2) {
      // From date
      await dateInputs[0].click({ clickCount: 3 }); // Select all
      await sleep(200);
      await dateInputs[0].type(START_DATE, { delay: 50 });
      await sleep(500);

      // To date
      await dateInputs[1].click({ clickCount: 3 }); // Select all
      await sleep(200);
      await dateInputs[1].type(END_DATE, { delay: 50 });
      await sleep(500);
    }

    // Set items per page to 500
    logger.info(`  📄 Setting items per page to 500...`);
    const selectElement = await page.$('select');
    if (selectElement) {
      await selectElement.select('500');
      await sleep(500);
      logger.info(`  ✅ Items per page set to 500`);
    } else {
      logger.warn(`  ⚠️  Could not find items per page selector`);
    }

    // Click the Filter button
    const filterButton = await page.$('button.box__filter--search');
    if (!filterButton) {
      logger.error(`  ❌ Could not find Filter button`);
      return [];
    }

    logger.info(`  🔘 Clicking Filter button...`);
    await filterButton.click();

    // Wait for the API response
    await sleep(3000);

    if (!apiResponse || apiResponse.length === 0) {
      logger.warn(`  ⚠️  No data received from API for ${symbol}`);
      return [];
    }

    logger.info(`  ✅ Received ${apiResponse.length} records from API`);
    return apiResponse;

  } catch (error) {
    logger.error(`  ❌ Error fetching ${symbol}: ${error.message}`);
    return [];
  }
}

/**
 * Parse date from table format to MySQL format (YYYY-MM-DD)
 * Table format could be: "12/20/2025", "2025-12-20", or other formats
 */
function parseTableDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Try to parse MM/DD/YYYY format
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }

    // If already in YYYY-MM-DD format, return as is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }

    // Try parsing as a Date object
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  } catch (error) {
    logger.error(`Error parsing date: ${dateStr} - ${error.message}`);
    return null;
  }
}

/**
 * Transform API response to database format
 */
function transformPriceData(apiData, securityId, symbol) {
  return apiData.map(record => ({
    security_id: securityId,
    symbol: symbol,
    business_date: record.businessDate, // Already in YYYY-MM-DD format from API
    high_price: parseFloat(record.highPrice) || null,
    low_price: parseFloat(record.lowPrice) || null,
    close_price: parseFloat(record.closePrice) || null,
    total_trades: parseInt(record.totalTrades) || null,
    total_traded_quantity: parseInt(record.totalTradedQuantity) || null,
    total_traded_value: parseFloat(record.totalTradedValue) || null
  }));
}

/**
 * Process a single company
 */
async function processCompany(page, company, index, total) {
  const { security_id, symbol, company_name } = company;

  logger.info(`\n[${index + 1}/${total}] Processing ${symbol} (${company_name})`);

  try {
    const tableData = await fetchStockHistory(page, security_id, symbol);

    if (tableData.length === 0) {
      logger.warn(`  ⚠️  No historical data found for ${symbol}`);
      return { symbol, success: true, count: 0 };
    }

    if (isAffectedOnly) {
      logger.info(`  🗑️  Clearing existing historical data for ${symbol}...`);
      try {
        await pool.execute('DELETE FROM stock_price_history WHERE security_id = ?', [security_id]);
        logger.info(`  ✅ Cleared existing data for ${symbol}`);
      } catch (e) {
        logger.error(`  ❌ Failed to clear data for ${symbol}: ${e.message}`);
      }
    }

    const transformedData = transformPriceData(tableData, security_id, symbol);
    const savedCount = await saveStockPriceHistory(transformedData);

    logger.info(`  � Saved ${savedCount} records for ${symbol}`);
    return { symbol, success: true, count: savedCount };

  } catch (error) {
    logger.error(`  ❌ Failed to process ${symbol}: ${error.message}`);
    return { symbol, success: false, error: error.message };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Stock Price History Scraper (UI Interaction)');
  console.log('================================================');
  console.log(`Date Range: ${START_DATE} to ${END_DATE}`);
  console.log(`Test Mode: ${isTestMode ? 'YES (limit: ' + testLimit + ')' : 'NO'}`);
  console.log('');

  let browser;

  try {
    logger.info('Launching browser...');

    const launchOptions = {
      headless: true,
      pipe: true, // Use pipe instead of websocket for better stability
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
        '--disable-application-cache',
        '--disable-gpu-shader-disk-cache',
        '--media-cache-size=0',
        '--disk-cache-size=0',
        '--blink-settings=imagesEnabled=false',
        '--blink-settings=stylesheetEnabled=false',
        '--ignore-certificate-errors'
      ]
    };

    // Use system Chrome in production - try multiple approaches
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      logger.info(`🔧 Using Chrome from env var: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      // Try to find Chrome automatically
      const systemChrome = findChromeExecutable();
      if (systemChrome) {
        logger.info(`🔧 Using system Chrome: ${systemChrome}`);
        launchOptions.executablePath = systemChrome;
      } else {
        logger.info('📦 Using bundled Chromium');
      }
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
    let companies = await getAllCompanies({
      targetSymbols: targetSymbols,
      missingOnly: isMissingOnly,
      affectedOnly: isAffectedOnly
    });

    if (isTestMode && !isAffectedOnly) {
      companies = companies.slice(0, testLimit);
      logger.info(`Test mode: Processing only ${companies.length} companies`);
    } else if (isAffectedOnly) {
      logger.info(`Affected mode: Processing all ${companies.length} conflicted symbols`);
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
  }
}

main();
