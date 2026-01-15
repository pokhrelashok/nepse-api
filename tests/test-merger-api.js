#!/usr/bin/env bun

const logger = require('../src/utils/logger');
const { getRecentMergersForSymbols } = require('../src/database/queries');

async function testMergerAPI() {
  try {
    logger.info('🧪 Starting Merger API test...');

    // Test with sample symbols
    const testSymbols = ['GBLBS', 'NMFBS', 'ABC'];
    logger.info(`\nTesting getRecentMergersForSymbols with symbols: ${testSymbols.join(', ')}`);

    const mergers = await getRecentMergersForSymbols(testSymbols);

    if (Object.keys(mergers).length === 0) {
      logger.info('\n❌ No mergers found for test symbols');
      logger.info('\nAvailable symbols with mergers (checking database):');

      // Show all companies in database mergers
      const pool = require('./src/database/connection').pool;
      const [allMergers] = await pool.execute(`
        SELECT new_company_stock_symbol, companies 
        FROM merger_acquisitions 
        WHERE joint_date_ad IS NOT NULL AND joint_date_ad <= CURDATE()
        LIMIT 5
      `);

      allMergers.forEach(m => {
        logger.info(`\nMerged into: ${m.new_company_stock_symbol}`);
        try {
          const companies = JSON.parse(m.companies || '[]');
          companies.forEach(c => {
            logger.info(`  - ${c.symbol}: ${c.name}`);
          });
        } catch (e) {
          logger.info(`  Companies: ${m.companies}`);
        }
      });
    } else {
      logger.info('\n✅ Mergers found!');
      for (const [symbol, symbolMergers] of Object.entries(mergers)) {
        logger.info(`\n${symbol}:`);
        symbolMergers.forEach(merger => {
          logger.info(`  📋 ${merger.new_company_name}`);
          logger.info(`     Action: ${merger.action}`);
          logger.info(`     Joint Date: ${merger.joint_date_ad}`);
          logger.info(`     Companies (PARSED):`);
          if (Array.isArray(merger.companies)) {
            merger.companies.forEach(c => {
              logger.info(`       - ${c.symbol}: ${c.name} (${c.nepali_name})`);
            });
          } else {
            logger.info(`       ${merger.companies}`);
          }
        });
      }
    }

    logger.info('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testMergerAPI();
