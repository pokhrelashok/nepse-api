/**
 * Sync Company Details from Redis
 * Updates company_details table with latest price data from Redis after market close
 * This ensures company_details has the most recent price information
 */

const { pool } = require('../../database/database');
const logger = require('../../utils/logger');
const redis = require('../../config/redis');

async function syncCompanyDetailsFromRedis() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    logger.info('📊 Syncing company_details with Redis price data...');

    // Get all live prices from Redis
    const livePricesMap = await redis.hgetall('live:stock_prices');

    if (!livePricesMap || Object.keys(livePricesMap).length === 0) {
      logger.warn('⚠️ No stock prices found in Redis to sync');
      return { success: false, reason: 'NO_REDIS_DATA' };
    }

    const prices = Object.values(livePricesMap).map(p => JSON.parse(p));

    // Update company_details with latest price data
    const sql = `
      UPDATE company_details
      SET 
        last_traded_price = ?,
        open_price = ?,
        close_price = ?,
        high_price = ?,
        low_price = ?,
        previous_close = ?,
        fifty_two_week_high = ?,
        fifty_two_week_low = ?,
        total_traded_quantity = ?,
        updated_at = NOW()
      WHERE symbol = ?
    `;

    let updatedCount = 0;
    for (const p of prices) {
      // Use closePrice if available, otherwise fall back to lastTradedPrice
      const closePrice = (p.close_price || p.closePrice || 0) > 0
        ? (p.close_price || p.closePrice)
        : (p.last_traded_price || p.lastTradedPrice || 0);

      const result = await connection.execute(sql, [
        p.last_traded_price || p.lastTradedPrice || 0,
        p.open_price || p.openPrice || 0,
        closePrice,
        p.high_price || p.highPrice || 0,
        p.low_price || p.lowPrice || 0,
        p.previous_close || p.previousClose || 0,
        p.fifty_two_week_high || p.fiftyTwoWeekHigh || 0,
        p.fifty_two_week_low || p.fiftyTwoWeekLow || 0,
        p.total_traded_quantity || p.totalTradedQuantity || 0,
        p.symbol
      ]);

      if (result[0].affectedRows > 0) {
        updatedCount++;
      }
    }

    await connection.commit();

    logger.info(`✅ Successfully synced ${updatedCount} company records from Redis`);

    return {
      success: true,
      recordsUpdated: updatedCount,
      totalPrices: prices.length
    };

  } catch (error) {
    await connection.rollback();
    logger.error(`❌ Error syncing company details from Redis: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  syncCompanyDetailsFromRedis()
    .then(result => {
      console.log('\n✅ Sync completed successfully');
      console.log(`   Records Updated: ${result.recordsUpdated}`);
      console.log(`   Total Prices: ${result.totalPrices}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Sync failed:', error.message);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { syncCompanyDetailsFromRedis };
