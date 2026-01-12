const { pool, savePrices } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { DateTime } = require('luxon');

async function getAllSecurityIds() {
  // Try Redis first as it's the new source of truth for active prices
  try {
    const redisPrices = await redis.hgetall('live:stock_prices');
    if (redisPrices && Object.keys(redisPrices).length > 0) {
      const results = Object.values(redisPrices).map(p => {
        const data = JSON.parse(p);
        return {
          security_id: data.security_id || data.securityId,
          symbol: data.symbol
        };
      }).filter(s => {
        // Filter out invalid security_ids and log them
        if (!s.security_id || s.security_id <= 0) {
          logger.warn(`⚠️ Skipping ${s.symbol} with invalid security_id: ${s.security_id}`);
          return false;
        }
        return true;
      });
      logger.info(`📊 Loaded ${results.length} companies from Redis (${Object.keys(redisPrices).length - results.length} filtered out)`);
      return results;
    }
  } catch (error) {
    logger.error('❌ Redis error in getAllSecurityIds:', error);
  }

  // Fallback to MySQL - use company_details as the primary source now
  // stock_prices is being phased out as it contains redundant/duplicate rows
  const [rows] = await pool.execute(
    "SELECT DISTINCT security_id, symbol FROM company_details WHERE security_id > 0"
  );
  return rows;
}

async function getSecurityIdsFromRedis() {
  try {
    const redisPrices = await redis.hgetall('live:stock_prices');
    if (!redisPrices || Object.keys(redisPrices).length === 0) {
      return [];
    }

    return Object.values(redisPrices).map(p => {
      const data = JSON.parse(p);
      return {
        security_id: data.security_id || data.securityId,
        symbol: data.symbol
      };
    }).filter(s => s.security_id > 0);
  } catch (error) {
    logger.error('❌ Redis error in getSecurityIdsFromRedis:', error);
    return [];
  }
}

async function getSecurityIdsWithoutDetails() {
  let activeSecurities = await getSecurityIdsFromRedis();

  // If Redis is empty, fallback to company_details for current active securities
  if (activeSecurities.length === 0) {
    const [rows] = await pool.execute(
      "SELECT DISTINCT security_id, symbol FROM company_details WHERE security_id > 0"
    );
    activeSecurities = rows;
  }

  if (activeSecurities.length === 0) return [];

  // Get symbols that already have details
  const [existingDetails] = await pool.execute("SELECT symbol FROM company_details");
  const existingSymbols = new Set(existingDetails.map(d => d.symbol));

  // Filter out those that already have details
  return activeSecurities.filter(s => !existingSymbols.has(s.symbol));
}

async function getSecurityIdsBySymbols(symbols) {
  if (!symbols || symbols.length === 0) {
    return [];
  }

  const placeholders = symbols.map(() => '?').join(',');
  const sql = `
    SELECT DISTINCT security_id, symbol 
    FROM company_details 
    WHERE security_id > 0 AND symbol IN (${placeholders})
    ORDER BY symbol
  `;
  const [rows] = await pool.execute(sql, symbols);
  return rows;
}

async function searchStocks(query) {
  const pattern = `%${query}%`;
  // Optimized to use company_details directly, eliminating dependency on stock_prices
  const [rows] = await pool.execute(
    `SELECT symbol, company_name AS name, nepali_company_name, 
            sector_name as sector, nepali_sector_name, 
            security_id, status, last_traded_price as ltp,
            close_price
     FROM company_details
     WHERE symbol LIKE ? OR company_name LIKE ? 
     ORDER BY symbol LIMIT 20`,
    [pattern, pattern]
  );
  return rows;
}

async function getScriptDetails(symbol) {
  const sql = `
    SELECT 
      cd.*
    FROM company_details cd
    WHERE cd.symbol = ?
  `;

  const [rows] = await pool.execute(sql, [symbol]);

  if (rows.length > 0) {
    const details = rows[0];
    const securityId = details.security_id;

    // Try Redis first, then the data already in `details` (from company_details table)
    try {
      const livePriceJson = await redis.hget('live:stock_prices', symbol);
      if (livePriceJson) {
        const livePrice = JSON.parse(livePriceJson);
        details.business_date = livePrice.business_date;
        details.open_price = livePrice.open_price;
        details.ltp = livePrice.close_price;
        details.price_change = livePrice.change;
        details.percentage_change = livePrice.percentage_change;
        details.high_price = livePrice.high_price;
        details.low_price = livePrice.low_price;
        details.total_traded_quantity = livePrice.total_traded_quantity;
        details.total_traded_value = livePrice.total_traded_value;
        details.source = 'REDIS_LIVE';
      } else {
        // Fallback to the persistent data already in `details` (from company_details)
        // This is now kept up-to-date by savePrices
        details.ltp = details.close_price;
        details.source = 'MYSQL_PERSISTENT';
      }
    } catch (error) {
      logger.error('❌ Redis error in getScriptDetails:', error);
    }

    const [dividends] = await pool.execute(
      `SELECT id, security_id, fiscal_year, bonus_share, cash_dividend, total_dividend, 
              DATE_FORMAT(published_date, '%Y-%m-%d') as published_date, updated_at 
       FROM dividends WHERE security_id = ? ORDER BY fiscal_year DESC`,
      [securityId]
    );
    details.dividends = dividends;

    const [financials] = await pool.execute(
      "SELECT * FROM company_financials WHERE security_id = ? ORDER BY fiscal_year DESC, quarter DESC",
      [securityId]
    );
    details.financials = financials;

    return details;
  }

  // Fallback to stock_prices table if no company details found
  const [priceRows] = await pool.execute(
    "SELECT * FROM stock_prices WHERE symbol = ? ORDER BY business_date DESC LIMIT 1",
    [symbol]
  );
  return priceRows.length > 0 ? priceRows[0] : null;
}

async function getLatestPrices(symbols, options = {}) {
  const {
    limit = 100,
    offset = 0,
    sortBy = 'symbol',
    order = 'ASC',
    filter = null,
    search = null
  } = options;

  let allPrices = [];
  let source = 'REDIS_LIVE';

  try {
    const redisPrices = await redis.hgetall('live:stock_prices');
    if (redisPrices && Object.keys(redisPrices).length > 0) {
      allPrices = Object.values(redisPrices).map(p => JSON.parse(p));

      if (symbols && Array.isArray(symbols) && symbols.length > 0) {
        allPrices = allPrices.filter(p => symbols.includes(p.symbol));
      }
    } else {
      source = 'MYSQL_PERSISTENT';
      // Use company_details as the database source of truth
      let sql = `
        SELECT 
          symbol, 
          company_name AS security_name,
          close_price,
          last_traded_price,
          open_price,
          high_price,
          low_price,
          previous_close,
          percentage_change,
          (close_price - previous_close) as \`change\`,
          total_traded_quantity,
          updated_at as business_date
        FROM company_details
      `;
      if (symbols && Array.isArray(symbols) && symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        sql += ` WHERE symbol IN (${placeholders})`;
        const [rows] = await pool.execute(sql, symbols);
        allPrices = rows;
      } else {
        const [rows] = await pool.execute(sql);
        allPrices = rows;
      }
    }
  } catch (error) {
    logger.error('❌ Redis error in getLatestPrices:', error);
  }

  // Apply filters
  if (filter === 'gainers') {
    allPrices = allPrices.filter(p => p.change > 0);
  } else if (filter === 'losers') {
    allPrices = allPrices.filter(p => p.change < 0);
  }

  if (search && search.trim()) {
    const searchTerm = search.trim().toUpperCase();
    allPrices = allPrices.filter(p =>
      (p.symbol && p.symbol.toUpperCase().includes(searchTerm)) ||
      (p.security_name && p.security_name.toUpperCase().includes(searchTerm))
    );
  }

  // Sort before pagination
  allPrices.sort((a, b) => {
    const valA = a[sortBy] ?? 0;
    const valB = b[sortBy] ?? 0;
    if (order.toUpperCase() === 'DESC') {
      return valB - valA;
    }
    return valA - valB;
  });

  const pagedList = allPrices.slice(offset, offset + limit);
  const pagedSymbols = pagedList.map(p => p.symbol);

  if (pagedSymbols.length > 0) {
    const placeholders = pagedSymbols.map(() => '?').join(',');
    const [metadata] = await pool.execute(
      `SELECT symbol, company_name, nepali_company_name, sector_name, nepali_sector_name, 
              market_capitalization, pe_ratio, pb_ratio, eps, dividend_yield
       FROM company_details 
       WHERE symbol IN (${placeholders})`,
      pagedSymbols
    );

    const metaMap = metadata.reduce((acc, curr) => ({ ...acc, [curr.symbol]: curr }), {});
    return pagedList.map(p => ({
      ...p,
      ...metaMap[p.symbol],
      source
    }));
  }

  return [];
}

async function getIntradayData(symbol = null) {
  try {
    const todayStr = DateTime.now().setZone('Asia/Kathmandu').toISODate();
    const keyPrefix = process.env.REDIS_PREFIX || 'nepse:';

    if (symbol) {
      // Get intraday data for a specific symbol
      const intradayKey = `intraday:${todayStr}:${symbol}`;
      const snapshots = await redis.zrange(intradayKey, 0, -1, 'WITHSCORES');

      if (!snapshots || snapshots.length === 0) {
        return [];
      }

      // Parse snapshots (Redis returns [value1, score1, value2, score2, ...])
      const result = [];
      for (let i = 0; i < snapshots.length; i += 2) {
        const data = JSON.parse(snapshots[i]);
        const timestamp = parseInt(snapshots[i + 1]);
        result.push({
          ...data,
          timestamp: new Date(timestamp).toISOString()
        });
      }
      return result;
    } else {
      // Get all symbols that have intraday data today
      // Use SCAN instead of KEYS for better performance
      // Note: SCAN returns keys WITH the prefix, so we need to include it in the pattern
      const pattern = `${keyPrefix}intraday:${todayStr}:*`;
      const keys = [];
      let cursor = '0';

      do {
        const [newCursor, foundKeys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;
        keys.push(...foundKeys);
      } while (cursor !== '0');

      if (!keys || keys.length === 0) {
        return {};
      }

      // Get data for all symbols
      const result = {};
      for (const key of keys) {
        // Strip the prefix before extracting symbol
        const keyWithoutPrefix = key.replace(keyPrefix, '');
        const symbol = keyWithoutPrefix.split(':')[2]; // Extract symbol from key

        // Use the key without prefix for Redis operations (ioredis adds it automatically)
        const snapshots = await redis.zrange(keyWithoutPrefix, 0, -1, 'WITHSCORES');

        const symbolData = [];
        for (let i = 0; i < snapshots.length; i += 2) {
          const data = JSON.parse(snapshots[i]);
          const timestamp = parseInt(snapshots[i + 1]);
          symbolData.push({
            ...data,
            timestamp: new Date(timestamp).toISOString()
          });
        }
        result[symbol] = symbolData;
      }
      return result;
    }
  } catch (error) {
    logger.error('❌ Redis error in getIntradayData:', error);
    return symbol ? [] : {};
  }
}

async function insertTodayPrices(prices) {
  if (!prices || prices.length === 0) return;

  try {
    const now = new Date();
    const todayStr = DateTime.now().setZone('Asia/Kathmandu').toISODate();
    const timestamp = now.toISOString();
    const timestampScore = now.getTime(); // Unix timestamp in milliseconds

    // Check for duplicates and prepare data to store
    const pricesToStore = [];

    for (const p of prices) {
      const symbol = p.symbol;
      const data = JSON.stringify({
        ...p,
        last_updated: timestamp
      });

      // Check if this data is different from the last entry to avoid duplicates
      const intradayKey = `intraday:${todayStr}:${symbol}`;
      const lastSnapshot = await redis.zrange(intradayKey, -1, -1);
      let shouldStore = true;

      if (lastSnapshot && lastSnapshot.length > 0) {
        const lastData = JSON.parse(lastSnapshot[0]);
        // Compare key fields to detect if price data has actually changed
        if (lastData.current_price === p.current_price &&
          lastData.today_change === p.today_change &&
          lastData.today_percentage_change === p.today_percentage_change) {
          shouldStore = false;
        }
      }

      if (shouldStore) {
        pricesToStore.push({ symbol, data, intradayKey });
      }
    }

    // Execute pipeline with live prices and deduplicated intraday data
    const pipeline = redis.pipeline();

    // Update all live prices
    for (const p of prices) {
      const symbol = p.symbol;
      const data = JSON.stringify({
        ...p,
        last_updated: timestamp
      });
      pipeline.hset('live:stock_prices', symbol, data);
    }

    // Store only non-duplicate intraday data
    for (const item of pricesToStore) {
      pipeline.zadd(item.intradayKey, timestampScore, item.data);

      // Set expiry for intraday data (expire at end of next day)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      const ttlSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
      pipeline.expire(item.intradayKey, ttlSeconds);
    }

    // Update metadata
    pipeline.hset('live:metadata', 'last_price_update', timestamp);
    pipeline.hset('live:metadata', 'last_price_date', todayStr);

    await pipeline.exec();
    logger.info(`🚀 Saved ${prices.length} stock prices to Redis (${pricesToStore.length} new intraday snapshots, ${prices.length - pricesToStore.length} duplicates skipped)`);

    // Maintain MySQL for now as per user request
    return savePrices(prices);
  } catch (error) {
    logger.error('❌ Redis error in insertTodayPrices:', error);
    return savePrices(prices); // Fallback to MySQL
  }
}

async function getStockHistory(symbol, startDate) {
  const sql = `
    SELECT
    business_date,
      close_price,
      total_traded_quantity
    FROM stock_price_history
    WHERE symbol = ? AND business_date >= ?
      ORDER BY business_date ASC
        `;

  const [rows] = await pool.execute(sql, [symbol, startDate]);
  return rows;
}

module.exports = {
  getAllSecurityIds,
  getSecurityIdsWithoutDetails,
  getSecurityIdsBySymbols,
  getSecurityIdsFromRedis,
  searchStocks,
  getScriptDetails,
  getLatestPrices,
  getIntradayData,
  insertTodayPrices,
  getStockHistory
};
