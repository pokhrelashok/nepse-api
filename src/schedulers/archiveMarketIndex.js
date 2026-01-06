/**
 * Daily Market Index History Archiver
 * Copies today's market index from Redis (live:market_index) to market_indices_history table
 * This should run a few minutes after market closes (around 3:05 PM Nepal time)
 */

const { pool } = require('../database/database');
const logger = require('../utils/logger');

async function archiveTodaysMarketIndex() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get today's date in Nepal timezone
    const today = new Date();
    const nepaliDate = new Date(today.getTime() + (5.75 * 60 * 60 * 1000));
    const todayStr = nepaliDate.toISOString().split('T')[0];

    logger.info(`📊 Archiving market index for ${todayStr} from Redis...`);

    // Get data from Redis
    const redis = require('../config/redis');
    let indexData = await redis.hgetall('live:market_index');

    // Debug: Log what we got from Redis
    logger.info(`📋 Redis data: nepse_index=${indexData?.nepse_index}, index_change=${indexData?.index_change}`);

    // Check if Redis has valid data (closing_index should never be 0 for NEPSE)
    const redisClosingIndex = parseFloat(indexData?.nepse_index);
    const hasValidRedisData = indexData &&
      Object.keys(indexData).length > 0 &&
      !isNaN(redisClosingIndex) &&
      redisClosingIndex > 0;

    // Fallback to MySQL if Redis has no valid data
    if (!hasValidRedisData) {
      logger.warn('⚠️ Redis has no valid market index data, falling back to MySQL...');

      const [rows] = await connection.execute(`
        SELECT nepse_index, index_change, index_percentage_change, 
               total_turnover, total_traded_shares
        FROM market_index 
        WHERE trading_date = ?
        ORDER BY last_updated DESC
        LIMIT 1
      `, [todayStr]);

      if (rows.length > 0 && rows[0].nepse_index && parseFloat(rows[0].nepse_index) > 0) {
        // Convert MySQL data to same format as Redis
        indexData = {
          nepse_index: String(rows[0].nepse_index),
          index_change: String(rows[0].index_change || 0),
          index_percentage_change: String(rows[0].index_percentage_change || 0),
          total_turnover: String(rows[0].total_turnover || 0),
          total_traded_shares: String(rows[0].total_traded_shares || 0)
        };
        logger.info(`📋 MySQL fallback data: nepse_index=${indexData.nepse_index}`);
      } else {
        logger.warn('⚠️ No valid market index found in Redis or MySQL to archive');
        return { success: false, reason: 'NO_VALID_DATA' };
      }
    }

    // Final validation: closing_index must be > 0 (NEPSE Index is never 0)
    const closingIndex = parseFloat(indexData.nepse_index);
    if (isNaN(closingIndex) || closingIndex <= 0) {
      logger.error(`❌ Invalid closing_index value: ${indexData.nepse_index} (parsed: ${closingIndex})`);
      return { success: false, reason: 'INVALID_CLOSING_INDEX', value: indexData.nepse_index };
    }

    // NEPSE Index has exchange_index_id = 58
    const record = {
      business_date: todayStr,
      exchange_index_id: 58,
      index_name: 'NEPSE Index',
      closing_index: closingIndex,
      open_index: 0, // Not available in live data
      high_index: 0, // Not available in live data
      low_index: 0,  // Not available in live data
      fifty_two_week_high: 0,
      fifty_two_week_low: 0,
      turnover_value: parseFloat(indexData.total_turnover) || 0,
      turnover_volume: parseFloat(indexData.total_traded_shares) || 0,
      total_transaction: 0,
      abs_change: parseFloat(indexData.index_change) || 0,
      percentage_change: parseFloat(indexData.index_percentage_change) || 0
    };

    const sql = `
      INSERT INTO market_indices_history (
        business_date, exchange_index_id, index_name, closing_index, 
        open_index, high_index, low_index, fifty_two_week_high, 
        fifty_two_week_low, turnover_value, turnover_volume, 
        total_transaction, abs_change, percentage_change
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        index_name = VALUES(index_name),
        closing_index = VALUES(closing_index),
        turnover_value = VALUES(turnover_value),
        turnover_volume = VALUES(turnover_volume),
        abs_change = VALUES(abs_change),
        percentage_change = VALUES(percentage_change),
        updated_at = CURRENT_TIMESTAMP
    `;

    await connection.execute(sql, [
      record.business_date,
      record.exchange_index_id,
      record.index_name,
      record.closing_index,
      record.open_index,
      record.high_index,
      record.low_index,
      record.fifty_two_week_high,
      record.fifty_two_week_low,
      record.turnover_value,
      record.turnover_volume,
      record.total_transaction,
      record.abs_change,
      record.percentage_change
    ]);

    await connection.commit();

    logger.info(`✅ Successfully archived market index to history: ${record.closing_index} (${record.abs_change})`);

    return {
      success: true,
      date: todayStr,
      index: record.closing_index,
      change: record.abs_change
    };

  } catch (error) {
    await connection.rollback();
    logger.error(`❌ Error archiving market index: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  archiveTodaysMarketIndex()
    .then(result => {
      console.log('\n✅ Market index archive completed successfully');
      console.log(`   Date: ${result.date}`);
      console.log(`   Index: ${result.index} (${result.change})`);
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

module.exports = { archiveTodaysMarketIndex };
