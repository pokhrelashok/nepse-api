#!/usr/bin/env node

/**
 * Manual Mutual Fund Scraper
 * 
 * This script scrapes mutual fund NAV data from ShareSansar.
 * It fetches weekly/monthly NAV prices and updates maturity dates for all mutual funds.
 * 
 * Usage:
 *   bun scripts/scrape-mutual-funds.js
 *   or
 *   docker-compose exec backend bun scripts/scrape-mutual-funds.js
 */

const BrowserManager = require('../src/scrapers/nepse/browser-manager');
const MutualFundScraper = require('../src/scrapers/nepse/mutual-fund-scraper');
const logger = require('../src/utils/logger');

async function main() {
  console.log('🚀 Starting Manual Mutual Fund NAV Scrape...\n');

  const browserManager = new BrowserManager();
  const scraper = new MutualFundScraper(browserManager);

  try {
    await browserManager.init();
    console.log('✅ Browser initialized\n');

    const result = await scraper.scrape();

    console.log('\n🎉 Mutual Fund scrape completed successfully!');
    console.log(`📊 Total records processed: ${result.length}`);

  } catch (error) {
    console.error('\n❌ Mutual Fund scrape failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await browserManager.close();
    console.log('\n🔒 Browser closed');
    process.exit(0);
  }
}

main();
