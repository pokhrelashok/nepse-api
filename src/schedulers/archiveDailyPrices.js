/**
 * Daily Price History Archiver
 * Copies today's stock prices from stock_prices table to stock_price_history table
 * This should run a few minutes after market closes (around 3:05 PM Nepal time)
 */

const { pool } = require('../database/database');
const logger = require('../utils/logger');

async function archiveTodaysPrices() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get today's date in Nepal timezone
    const today = new Date();
    const nepaliDate = new Date(today.getTime() + (5.75 * 60 * 60 * 1000));
    const todayStr = nepaliDate.toISOString().split('T')[0];

    logger.info(`📦 Archiving stock prices for ${todayStr}...`);

    // Copy data from stock_prices to stock_price_history
    const sql = `
      INSERT INTO stock_price_history (
        security_id,
        symbol,
        business_date,
        high_price,
        low_price,
        close_price,
        total_trades,
        total_traded_quantity,
        total_traded_value
      )
      SELECT 
        security_id,
        symbol,
        business_date,
        high_price,
        low_price,
        close_price,
        0 as total_trades,
        total_traded_quantity,
        total_traded_value
      FROM stock_prices
      WHERE security_id > 0
      ON DUPLICATE KEY UPDATE
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        close_price = VALUES(close_price),
        total_traded_quantity = VALUES(total_traded_quantity),
        total_traded_value = VALUES(total_traded_value),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await connection.execute(sql);

    await connection.commit();

    const affectedRows = result.affectedRows;
    const insertedRows = Math.floor(affectedRows / 2); // Approximate new inserts

    logger.info(`✅ Successfully archived ${insertedRows} stock prices to history`);
    logger.info(`   Total affected rows: ${affectedRows}`);

    return {
      success: true,
      date: todayStr,
      recordsArchived: insertedRows,
      totalAffected: affectedRows
    };

  } catch (error) {
    await connection.rollback();
    logger.error(`❌ Error archiving stock prices: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  archiveTodaysPrices()
    .then(result => {
      console.log('\n✅ Archive completed successfully');
      console.log(`   Date: ${result.date}`);
      console.log(`   Records: ${result.recordsArchived}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Archive failed:', error.message);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { archiveTodaysPrices };
