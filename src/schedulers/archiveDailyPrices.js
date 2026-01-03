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

    logger.info(`📦 Archiving stock prices for ${todayStr} from Redis...`);

    // 1. Get data from Redis
    const { default: redis } = require('../config/redis');
    const livePricesMap = await redis.hgetall('live:stock_prices');

    if (!livePricesMap || Object.keys(livePricesMap).length === 0) {
      logger.warn('⚠️ No stock prices found in Redis to archive');
      return { success: false, reason: 'NO_REDIS_DATA' };
    }

    const prices = Object.values(livePricesMap).map(p => JSON.parse(p));

    // 2. Insert into MySQL history table
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        close_price = VALUES(close_price),
        total_traded_quantity = VALUES(total_traded_quantity),
        total_traded_value = VALUES(total_traded_value),
        updated_at = CURRENT_TIMESTAMP
    `;

    let archivedCount = 0;
    for (const p of prices) {
      await connection.execute(sql, [
        p.security_id || 0,
        p.symbol,
        p.business_date || todayStr,
        p.high_price || 0,
        p.low_price || 0,
        p.close_price || 0,
        0, // total_trades not always available in live data
        p.total_traded_quantity || 0,
        p.total_traded_value || 0
      ]);
      archivedCount++;
    }

    await connection.commit();

    logger.info(`✅ Successfully archived ${archivedCount} stock prices to history`);

    return {
      success: true,
      date: todayStr,
      recordsArchived: archivedCount
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
