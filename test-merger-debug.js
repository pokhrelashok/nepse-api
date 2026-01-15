#!/usr/bin/env bun

const logger = require('./src/utils/logger');

async function debugMergers() {
  try {
    logger.info('🧪 Debugging merger data...');

    const { pool } = require('./src/database/database');

    // Get all mergers and show their companies
    const [mergers] = await pool.execute(`
      SELECT 
        id, new_company_stock_symbol, new_company_name, 
        companies, joint_date_ad, action
      FROM merger_acquisitions 
      WHERE joint_date_ad IS NOT NULL AND joint_date_ad <= CURDATE()
      LIMIT 10
    `);

    logger.info(`\n📊 Found ${mergers.length} mergers in database\n`);

    mergers.forEach((m, idx) => {
      logger.info(`${idx + 1}. Merged into: ${m.new_company_stock_symbol} (${m.new_company_name})`);
      logger.info(`   Joint Date: ${m.joint_date_ad}`);
      logger.info(`   Action: ${m.action}`);

      try {
        const companies = JSON.parse(m.companies || '[]');
        logger.info(`   Companies being merged (${companies.length}):`);
        companies.forEach(c => {
          logger.info(`     - ${c.symbol}: ${c.name}`);
        });
      } catch (e) {
        logger.info(`   Companies (RAW): ${m.companies}`);
      }
      logger.info('');
    });

    // Now test getRecentMergersForSymbols
    logger.info('\n--- Testing getRecentMergersForSymbols ---\n');
    const { getRecentMergersForSymbols } = require('./src/database/queries');

    // Get all company symbols from mergers
    const allSymbols = new Set();
    mergers.forEach(m => {
      try {
        const companies = JSON.parse(m.companies || '[]');
        companies.forEach(c => allSymbols.add(c.symbol));
      } catch (e) {
        // skip
      }
    });

    const testSymbols = Array.from(allSymbols).slice(0, 5);
    logger.info(`Testing with symbols: ${testSymbols.join(', ')}\n`);

    const result = await getRecentMergersForSymbols(testSymbols);

    logger.info(`Result: ${JSON.stringify(result, null, 2)}`);

    process.exit(0);
  } catch (error) {
    logger.error('Debug failed:', error);
    process.exit(1);
  }
}

debugMergers();
