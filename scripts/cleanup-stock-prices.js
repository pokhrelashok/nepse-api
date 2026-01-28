/**
 * Script to cleanup duplicate entries in stock_prices table
 * Identifies duplicates by (symbol, business_date) and keeps only the latest one (highest ID)
 */

const { pool } = require('../src/database/database');
const logger = require('../src/utils/logger');


async function cleanupDuplicates() {
  logger.info('🔍 Starting cleanup of duplicate stock prices...');

  try {
    // 1. Get total count before cleanup
    const [countBefore] = await pool.execute('SELECT COUNT(*) as total FROM stock_prices');
    logger.info(`📊 Total rows before cleanup: ${countBefore[0].total}`);

    // 2. Identify duplicates and delete them
    // We keep the row with the highest ID for each (symbol, business_date) pair
    logger.info('🧹 Identifying and removing duplicates... (This may take a moment)');

    const deleteSql = `
      DELETE t1 FROM stock_prices t1
      INNER JOIN stock_prices t2 
      ON t1.symbol = t2.symbol 
      AND t1.business_date = t2.business_date
      WHERE t1.id < t2.id
    `;

    const [result] = await pool.execute(deleteSql);

    logger.info(`✅ Cleanup complete!`);
    logger.info(`🗑️ Rows deleted: ${result.affectedRows}`);

    // 3. Get total count after cleanup
    const [countAfter] = await pool.execute('SELECT COUNT(*) as total FROM stock_prices');
    logger.info(`📊 Total rows after cleanup: ${countAfter[0].total}`);

    const reduction = countBefore[0].total - countAfter[0].total;
    const reductionPercent = ((reduction / countBefore[0].total) * 100).toFixed(2);
    logger.info(`✨ Database reduced by ${reduction} rows (${reductionPercent}%)`);

  } catch (error) {
    logger.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupDuplicates();
