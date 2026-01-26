const { pool, saveMarketIndexHistory: saveMarketIndexHistoryDB } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { DateTime } = require('luxon');

// Market status functions - UNIFIED
async function saveMarketSummary(summary) {
  const { status, isOpen, indexData } = summary;

  // Ensure we have a valid date
  const tradingDate = indexData.tradingDate || DateTime.now().setZone('Asia/Kathmandu').toISODate();

  // 1. Save to Redis (Primary Live Store)
  try {
    const now = new Date();
    const timestamp = now.toISOString();
    const timestampScore = now.getTime();

    const statusData = {
      status,
      is_open: isOpen ? '1' : '0',
      trading_date: tradingDate,
      last_updated: timestamp
    };

    const indexDataToSave = {
      nepse_index: (indexData.nepseIndex || 0).toString(),
      index_change: (indexData.indexChange || 0).toString(),
      index_percentage_change: (indexData.indexPercentageChange || 0).toString(),
      total_turnover: (indexData.totalTurnover || 0).toString(),
      total_traded_shares: (indexData.totalTradedShares || 0).toString(),
      advanced: (indexData.advanced || 0).toString(),
      declined: (indexData.declined || 0).toString(),
      unchanged: (indexData.unchanged || 0).toString(),
      status_date: (indexData.marketStatusDate || '').toString(),
      status_time: (indexData.marketStatusTime || '').toString(),
      last_updated: timestamp
    };

    const pipeline = redis.pipeline();
    pipeline.hset('live:market_status', statusData);
    pipeline.hset('live:market_index', indexDataToSave);

    // Store intraday market index snapshot (with deduplication)
    const intradayKey = `intraday:market_index:${tradingDate}`;
    const snapshotData = JSON.stringify({
      ...indexData,
      status,
      isOpen,
      timestamp
    });

    // Check if this data is different from the last entry to avoid duplicates
    const lastSnapshot = await redis.zrange(intradayKey, -1, -1);
    let shouldStore = true;

    if (lastSnapshot && lastSnapshot.length > 0) {
      const lastData = JSON.parse(lastSnapshot[0]);
      // Compare key fields to detect if data has actually changed
      if (lastData.nepseIndex === indexData.nepseIndex &&
        lastData.marketStatusTime === indexData.marketStatusTime &&
        lastData.totalTradedShares === indexData.totalTradedShares &&
        lastData.totalTurnover === indexData.totalTurnover) {
        shouldStore = false;
      }
    }

    // Validate that marketStatusTime is not in the future (stale data from yesterday)
    // If the scraped time is ahead of current Nepal time, skip storing intraday snapshot
    if (shouldStore && indexData.marketStatusTime) {
      const timeMatch = indexData.marketStatusTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        const period = timeMatch[3].toUpperCase();

        // Convert to 24-hour format
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Skip if the marketStatusTime is in the future (stale data from yesterday)
        if (hour > currentHour || (hour === currentHour && minute > currentMinute)) {
          logger.warn(`⚠️ Skipping stale intraday data: marketStatusTime ${indexData.marketStatusTime} is ahead of current time ${currentHour}:${currentMinute}`);
          shouldStore = false;
        }
      }
    }

    if (shouldStore) {
      pipeline.zadd(intradayKey, timestampScore, snapshotData);
    }

    // Set expiry for intraday data (expire at end of today, not tomorrow)
    // This ensures we only keep today's data
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const ttlSeconds = Math.floor((endOfToday.getTime() - now.getTime()) / 1000);

    // Only set expiry if TTL is positive (i.e., we're not past midnight)
    if (ttlSeconds > 0) {
      pipeline.expire(intradayKey, ttlSeconds);
    }

    await pipeline.exec();
    logger.info(`🚀 Market summary saved to Redis for ${tradingDate} (live + ${shouldStore ? 'new' : 'duplicate skipped'} intraday snapshot)`);
  } catch (error) {
    logger.error('❌ Redis error in saveMarketSummary:', error);
  }

  // 2. Save to MySQL (Legacy/Backup for now)
  const sql = `

    INSERT INTO market_index (
      trading_date, market_status_date, market_status_time, 
      nepse_index, index_change, index_percentage_change, 
      total_turnover, total_traded_shares, 
      advanced, declined, unchanged,
      status, is_open, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      market_status_date = VALUES(market_status_date),
      market_status_time = VALUES(market_status_time),
      nepse_index = VALUES(nepse_index),
      index_change = VALUES(index_change),
      index_percentage_change = VALUES(index_percentage_change),
      total_turnover = VALUES(total_turnover),
      total_traded_shares = VALUES(total_traded_shares),
      advanced = VALUES(advanced),
      declined = VALUES(declined),
      unchanged = VALUES(unchanged),
      status = VALUES(status),
      is_open = VALUES(is_open),
      last_updated = CURRENT_TIMESTAMP
  `;

  const values = [
    tradingDate,
    indexData.marketStatusDate,
    indexData.marketStatusTime,
    indexData.nepseIndex || 0,
    indexData.indexChange || 0,
    indexData.indexPercentageChange || 0,
    indexData.totalTurnover || 0,
    indexData.totalTradedShares || 0,
    indexData.advanced || 0,
    indexData.declined || 0,
    indexData.unchanged || 0,
    status,
    isOpen ? 1 : 0
  ];

  try {
    const [result] = await pool.execute(sql, values);
    logger.info(`💾 Market summary saved to MySQL for ${tradingDate} (Status: ${status})`);
    return result.insertId;
  } catch (error) {
    console.error('❌ Error saving market summary to MySQL:', error.message);
    throw error;
  }
}

// Deprecated: Only logs warning
async function updateMarketStatus(status) {
  console.warn('⚠️ updateMarketStatus is deprecated. Use saveMarketSummary.');
  return Promise.resolve();
}

// Legacy adapter - now accepts optional status parameter
async function saveMarketIndex(indexData, status = null) {
  // If status is explicitly provided, use it; otherwise infer from index
  const finalStatus = status || ((indexData.nepseIndex > 0) ? 'OPEN' : 'CLOSED');
  const isOpen = finalStatus === 'OPEN' || finalStatus === 'PRE_OPEN';

  return saveMarketSummary({
    status: finalStatus,
    isOpen: isOpen,
    indexData
  });
}

async function getCurrentMarketStatus() {
  try {
    // 1. Try Redis
    const status = await redis.hgetall('live:market_status');
    if (status && status.status) {
      return {
        status: status.status,
        isOpen: status.is_open === '1',
        tradingDate: status.trading_date,
        lastUpdated: status.last_updated
      };
    }
  } catch (error) {
    logger.error('❌ Redis error in getCurrentMarketStatus:', error);
  }

  // 2. Fallback to MySQL
  const sql = `
    SELECT status, is_open, trading_date, last_updated 
    FROM market_index 
    ORDER BY trading_date DESC, last_updated DESC 
    LIMIT 1
  `;
  try {
    const [rows] = await pool.execute(sql);
    if (rows.length > 0) {
      return {
        status: rows[0].status || 'CLOSED',
        isOpen: !!rows[0].is_open,
        tradingDate: rows[0].trading_date,
        lastUpdated: rows[0].last_updated
      };
    }
    return { status: 'CLOSED', isOpen: false, tradingDate: null };
  } catch (error) {
    console.error('❌ Error fetching market status from MySQL:', error.message);
    return { status: 'CLOSED', isOpen: false, tradingDate: null };
  }
}

async function getMarketIndexData(tradingDate = null) {
  // Get today's date in Nepal timezone if not provided
  const todayStr = DateTime.now().setZone('Asia/Kathmandu').toISODate();
  const targetDate = tradingDate || todayStr;

  // 1. If looking for today, try Redis
  if (targetDate === todayStr) {
    try {
      const index = await redis.hgetall('live:market_index');
      if (index && index.nepse_index) {
        return {
          nepse_index: parseFloat(index.nepse_index),
          index_change: parseFloat(index.index_change),
          index_percentage_change: parseFloat(index.index_percentage_change),
          total_turnover: parseFloat(index.total_turnover),
          total_traded_shares: parseFloat(index.total_traded_shares),
          advanced: parseInt(index.advanced),
          declined: parseInt(index.declined),
          unchanged: parseInt(index.unchanged),
          market_status_date: index.status_date,
          market_status_time: index.status_time,
          trading_date: targetDate,
          last_updated: index.last_updated
        };
      }
    } catch (error) {
      logger.error('❌ Redis error in getMarketIndexData:', error);
    }
  }

  // 2. Fallback to MySQL
  const sql = `
    SELECT
    nepse_index,
      index_change,
      index_percentage_change,
      total_turnover,
      total_traded_shares,
      advanced,
      declined,
      unchanged,
      market_status_date,
      market_status_time,
      trading_date,
      last_updated
    FROM market_index 
    WHERE trading_date = ?
      ORDER BY last_updated DESC
    LIMIT 1
      `;

  const [rows] = await pool.execute(sql, [targetDate]);
  return rows.length > 0 ? rows[0] : null;
}

async function getLatestMarketIndexData() {
  // 1. Try Redis first (Live)
  try {
    const index = await redis.hgetall('live:market_index');
    if (index && index.nepse_index) {
      return {
        nepse_index: parseFloat(index.nepse_index),
        index_change: parseFloat(index.index_change),
        index_percentage_change: parseFloat(index.index_percentage_change),
        total_turnover: parseFloat(index.total_turnover),
        total_traded_shares: parseFloat(index.total_traded_shares),
        advanced: parseInt(index.advanced),
        declined: parseInt(index.declined),
        unchanged: parseInt(index.unchanged),
        market_status_date: index.status_date,
        market_status_time: index.status_time,
        trading_date: DateTime.now().setZone('Asia/Kathmandu').toISODate(), // Approximation for live
        last_updated: index.last_updated
      };
    }
  } catch (error) {
    logger.error('❌ Redis error in getLatestMarketIndexData:', error);
  }

  // 2. Fallback to MySQL
  const sql = `
    SELECT
    nepse_index,
      index_change,
      index_percentage_change,
      total_turnover,
      total_traded_shares,
      advanced,
      declined,
      unchanged,
      market_status_date,
      market_status_time,
      trading_date,
      last_updated
    FROM market_index 
    ORDER BY trading_date DESC, last_updated DESC
    LIMIT 1
      `;

  const [rows] = await pool.execute(sql);
  return rows.length > 0 ? rows[0] : null;
}

async function getMarketIndexHistory(days = 7) {
  const sql = `
    SELECT
    nepse_index,
      index_change,
      index_percentage_change,
      total_turnover,
      total_traded_shares,
      advanced,
      declined,
      unchanged,
      market_status_date,
      market_status_time,
      trading_date,
      last_updated
    FROM market_index 
    WHERE trading_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    ORDER BY trading_date DESC, last_updated DESC
      `;

  const [rows] = await pool.execute(sql, [String(days)]);
  return rows;
}

async function getIntradayMarketIndex(date = null) {
  try {
    const now = new Date();
    const todayStr = DateTime.now().setZone('Asia/Kathmandu').toISODate();
    const targetDate = date || todayStr;

    // Get current Nepal time components for validation (server is in Nepal time)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isToday = targetDate === todayStr;

    // Get intraday market index snapshots for the specified date
    const intradayKey = `intraday:market_index:${targetDate}`;
    const snapshots = await redis.zrange(intradayKey, 0, -1, 'WITHSCORES');

    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    // Parse snapshots and return only valid data
    const result = [];
    const seen = new Set(); // Track unique snapshots to avoid duplicates

    for (let i = 0; i < snapshots.length; i += 2) {
      const data = JSON.parse(snapshots[i]);
      const timestamp = parseInt(snapshots[i + 1]);

      // Filter out invalid snapshots (nepse_index = 0 means pre-market or invalid data)
      if (!data.nepseIndex || data.nepseIndex === 0) {
        continue;
      }

      // For today's data, filter out snapshots with market_status_time in the future
      // This prevents stale data from yesterday showing up (e.g., "3:00 PM" when it's only 2:30 PM)
      if (isToday && data.marketStatusTime) {
        const timeMatch = data.marketStatusTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const minute = parseInt(timeMatch[2]);
          const period = timeMatch[3].toUpperCase();

          // Convert to 24-hour format
          if (period === 'PM' && hour !== 12) hour += 12;
          if (period === 'AM' && hour === 12) hour = 0;

          // Skip if the market_status_time is in the future
          if (hour > currentHour || (hour === currentHour && minute > currentMinute)) {
            logger.info(`Skipping future intraday data: ${data.marketStatusTime} (current: ${currentHour}:${currentMinute})`);
            continue;
          }
        }
      }

      // Create a unique key for deduplication
      const uniqueKey = `${data.nepseIndex}-${data.marketStatusTime}-${data.totalTradedShares}`;
      if (seen.has(uniqueKey)) {
        continue;
      }
      seen.add(uniqueKey);

      result.push({
        nepse_index: data.nepseIndex,
        market_status_time: data.marketStatusTime,
        total_traded_shares: data.totalTradedShares || 0,
        total_turnover: data.totalTurnover || 0,
        timestamp: new Date(timestamp).toISOString()
      });
    }

    // Sort by timestamp descending (most recent first)
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return result;
  } catch (error) {
    logger.error('❌ Redis error in getIntradayMarketIndex:', error);
    return [];
  }
}

async function getMarketIndicesHistory(options = {}) {
  const {
    indexId = null,
    startDate = null,
    endDate = null,
    limit = 1000
  } = options;

  let sql = `
    SELECT
      CAST(business_date AS CHAR) as business_date,
      closing_index,
      percentage_change,
      turnover_value,
      turnover_volume
    FROM market_indices_history 
    WHERE 1 = 1
      `;
  const params = [];

  if (indexId) {
    sql += ` AND exchange_index_id = ? `;
    params.push(indexId);
  }

  if (startDate) {
    sql += ` AND business_date >= ? `;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND business_date <= ? `;
    params.push(endDate);
  }

  sql += ` ORDER BY business_date ASC, exchange_index_id ASC LIMIT ? `;
  params.push(String(limit));

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getMarketStatusHistory(limit = 7) {
  const sql = `
    SELECT
    trading_date,
      is_open as isOpen,
      status,
      last_updated as lastUpdated
    FROM market_index 
    ORDER BY trading_date DESC
    LIMIT ?
      `;
  const [rows] = await pool.execute(sql, [String(limit)]);
  return rows.map(r => ({
    ...r,
    isOpen: !!r.isOpen
  }));
}

function saveMarketIndexHistory(historyData) {
  return saveMarketIndexHistoryDB(historyData);
}

module.exports = {
  saveMarketSummary,
  updateMarketStatus,
  saveMarketIndex,
  saveMarketIndexHistory,
  getCurrentMarketStatus,
  getMarketIndexData,
  getLatestMarketIndexData,
  getMarketIndexHistory,
  getIntradayMarketIndex,
  getMarketIndicesHistory,
  getMarketStatusHistory
};
