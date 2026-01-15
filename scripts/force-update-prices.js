#!/usr/bin/env node

/**
 * Force update prices and market data
 * Fetches latest data and updates both database and Redis cache
 * Works even when market is closed or on holidays
 * 
 * Usage: node scripts/force-update-prices.js
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
const { insertTodayPrices, saveMarketIndex, saveMarketSummary } = require('../src/database/queries');
const { formatPricesForDatabase } = require('../src/utils/formatter');
const { pool, savePrices } = require('../src/database/database');
const redis = require('../src/config/redis');

async function forceUpdatePrices() {
  console.log('🚀 FORCE UPDATE - Fetching latest market data...\n');
  console.log('⚠️  This will update data even if market is closed or it\'s a holiday\n');

  const scraper = new NepseScraper({ headless: true });

  try {
    // Step 1: Fetch and save market summary (includes index and status)
    console.log('📊 Step 1/3: Fetching market summary...');
    const summary = await scraper.scrapeMarketSummary();
    await saveMarketSummary(summary);
    console.log(`✅ Market Status: ${summary.status}`);
    console.log(`   Index: ${summary.indexData.nepseIndex} (${summary.indexData.indexChange > 0 ? '+' : ''}${summary.indexData.indexChange})\n`);

    // Step 2: Fetch and save stock prices
    console.log('📈 Step 2/3: Fetching stock prices...');
    const prices = await scraper.scrapeTodayPrices();

    if (prices.length === 0) {
      console.log('⚠️  No prices available from NEPSE');
    } else {
      console.log(`✅ Scraped ${prices.length} stock prices`);

      console.log('💾 Saving to database and Redis (live prices only)...');
      const formattedPrices = formatPricesForDatabase(prices);

      // Update Redis live prices only (no intraday snapshots)
      const timestamp = new Date().toISOString();
      const pipeline = redis.pipeline();
      for (const p of formattedPrices) {
        const data = JSON.stringify({
          ...p,
          last_updated: timestamp
        });
        pipeline.hset('live:stock_prices', p.symbol, data);
      }
      pipeline.hset('live:metadata', 'last_price_update', timestamp);
      await pipeline.exec();

      // Save to database
      await savePrices(formattedPrices);

      console.log(`✅ SUCCESS: Saved ${prices.length} stock prices to database and Redis\n`);
    }

    // Step 3: Verify Redis cache
    console.log('🔍 Step 3/3: Verifying Redis cache...');
    const redisPrices = await redis.hgetall('live:stock_prices');
    const redisCount = redisPrices ? Object.keys(redisPrices).length : 0;
    console.log(`✅ Redis cache contains ${redisCount} stocks`);

    const metadata = await redis.hgetall('live:metadata');
    if (metadata && metadata.last_price_update) {
      console.log(`   Last update: ${metadata.last_price_update}`);
      console.log(`   Last date: ${metadata.last_price_date}`);
    }

    console.log('\n✨ Force update completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during force update:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await scraper.close();
    await pool.end();
    await redis.quit();
  }
}

forceUpdatePrices();
