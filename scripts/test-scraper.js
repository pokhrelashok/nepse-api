#!/usr/bin/env node

/**
 * Test script to manually run the scraper and verify pagination fix
 * Usage: node scripts/test-scraper.js
 */

const { NepseScraper } = require('../src/scrapers/nepse-scraper');

async function testScraper() {
  console.log('🧪 Testing NEPSE scraper with pagination fix...\n');

  const scraper = new NepseScraper({ headless: true });

  try {
    console.log('📊 Scraping today\'s prices...');
    const prices = await scraper.scrapeTodayPrices();

    console.log(`\n✅ SUCCESS: Scraped ${prices.length} stock prices`);

    if (prices.length > 100) {
      console.log('✅ Pagination fix is working! (> 100 records)');
    } else {
      console.log(`⚠️  WARNING: Only got ${prices.length} records (expected > 100)`);
    }

    // Show sample data
    if (prices.length > 0) {
      console.log('\n📋 Sample data (first 3 stocks):');
      prices.slice(0, 3).forEach(stock => {
        console.log(`   ${stock.symbol}: Rs. ${stock.closePrice} (${stock.percentageChange > 0 ? '+' : ''}${stock.percentageChange.toFixed(2)}%)`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

testScraper();
