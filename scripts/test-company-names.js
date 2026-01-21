#!/usr/bin/env node

/**
 * Test script to verify company name extraction for specific symbols
 */

const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');
const { pool } = require('../src/database/database');

async function testSymbols() {
  const symbols = ['GSY', 'GBIMESY2'];

  console.log('🧪 Testing company name extraction for:', symbols.join(', '), '\n');

  const scraper = new NepseScraper();
  await scraper.init();

  try {
    for (const symbol of symbols) {
      // Get security_id from database
      const [rows] = await pool.execute(
        'SELECT security_id, symbol, company_name as current_name FROM company_details WHERE symbol = ?',
        [symbol]
      );

      if (rows.length === 0) {
        console.log(`❌ ${symbol} not found in database\n`);
        continue;
      }

      const { security_id, current_name } = rows[0];
      console.log(`📊 ${symbol} (ID: ${security_id})`);
      console.log(`   Current name: ${current_name}`);

      // Scrape fresh data
      const results = await scraper.scrapeAllCompanyDetails([{ security_id, symbol }]);

      if (results && results.length > 0) {
        const scrapedName = results[0].companyName || results[0].company_name;
        console.log(`   Scraped name: ${scrapedName}`);
        console.log(`   ✅ ${scrapedName === current_name ? 'MATCH' : 'DIFFERENT'}\n`);
      } else {
        console.log(`   ❌ Failed to scrape\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
    await pool.end();
  }
}

testSymbols();
