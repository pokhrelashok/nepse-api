#!/usr/bin/env node

/**
 * Scrape today's prices and save to database
 * Usage: node scripts/scrape-and-save.js
 */

// Set Chrome path for production server
if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
  const fs = require('fs');
  const chromePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];

  for (const path of chromePaths) {
    if (fs.existsSync(path)) {
      process.env.PUPPETEER_EXECUTABLE_PATH = path;
      console.log(`🔧 Using Chrome at: ${path}\n`);
      break;
    }
  }
}

const { NepseScraper } = require('../src/scrapers/nepse-scraper');
const { insertTodayPrices } = require('../src/database/queries');
const { formatPricesForDatabase } = require('../src/utils/formatter');
const { pool } = require('../src/database/database');

async function scrapeAndSave() {
  console.log('📊 Scraping and saving today\'s prices...\n');

  const scraper = new NepseScraper({ headless: true });

  try {
    console.log('🔍 Fetching prices from NEPSE...');
    const prices = await scraper.scrapeTodayPrices();

    console.log(`✅ Scraped ${prices.length} stock prices`);

    if (prices.length === 0) {
      console.log('⚠️  No prices to save');
      return;
    }

    console.log('💾 Saving to database...');
    const formattedPrices = formatPricesForDatabase(prices);
    await insertTodayPrices(formattedPrices);

    console.log(`✅ SUCCESS: Saved ${prices.length} stock prices to database`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await scraper.close();
    await pool.end();
  }
}

scrapeAndSave();
