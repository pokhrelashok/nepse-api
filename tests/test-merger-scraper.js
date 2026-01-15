#!/usr/bin/env bun

const { scrapeMergers } = require('../src/scrapers/merger-scraper');
const logger = require('../src/utils/logger');

async function testMergerScraper() {
  try {
    logger.info('🧪 Starting merger scraper test...');
    logger.info('Fetching first page of merger data...');

    const count = await scrapeMergers(false);

    logger.info(`✅ Test completed! Processed ${count} merger records.`);

    // Now test the query function
    logger.info('\n📋 Testing getRecentMergersForSymbols...');
    const { getRecentMergersForSymbols } = require('../src/database/queries');

    // Test with a symbol that might have mergers
    const testSymbols = ['GBLBS', 'SAMAJ', 'NABIL'];
    const mergerData = await getRecentMergersForSymbols(testSymbols);

    logger.info('\n📊 Query Results:');
    Object.entries(mergerData).forEach(([symbol, mergers]) => {
      logger.info(`\n${symbol}:`);
      mergers.forEach(m => {
        logger.info(`  - ${m.action}: ${m.new_company_name}`);
        logger.info(`    Companies: ${m.companies.map(c => c.symbol).join(', ')}`);
        logger.info(`    Joint Date: ${m.joint_date_ad}`);
      });
    });

    if (Object.keys(mergerData).length === 0) {
      logger.info('No mergers found for test symbols');
    }

    process.exit(0);
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testMergerScraper();
