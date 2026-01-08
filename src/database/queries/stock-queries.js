const { pool, savePrices } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { DateTime } = require('luxon');

async function getAllSecurityIds() {
  const [rows] = await pool.execute(
    "SELECT DISTINCT security_id, symbol FROM stock_prices WHERE security_id > 0"
  );
  return rows;
}

async function getSecurityIdsWithoutDetails() {
  const sql = `
    SELECT DISTINCT sp.security_id, sp.symbol 
    FROM stock_prices sp
    LEFT JOIN company_details cd ON sp.symbol = cd.symbol
    WHERE sp.security_id > 0 AND cd.symbol IS NULL
    ORDER BY sp.symbol
  `;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function getSecurityIdsBySymbols(symbols) {
  if (!symbols || symbols.length === 0) {
    return [];
  }

  const placeholders = symbols.map(() => '?').join(',');
  const sql = `
    SELECT DISTINCT security_id, symbol 
    FROM stock_prices 
    WHERE security_id > 0 AND symbol IN (${placeholders})
    ORDER BY symbol
  `;
  const [rows] = await pool.execute(sql, symbols);
  return rows;
}

async function searchStocks(query) {
  const pattern = `%${query}%`;
  const [rows] = await pool.execute(
    `SELECT DISTINCT sp.symbol, sp.security_name, sp.security_id, 
            cd.sector_name as sector, cd.nepali_sector_name, 
            cd.company_name AS name, cd.nepali_company_name, cd.status 
     FROM stock_prices sp
     LEFT JOIN company_details cd ON sp.symbol = cd.symbol
     WHERE sp.symbol LIKE ? OR sp.security_name LIKE ? 
     ORDER BY sp.symbol LIMIT 20`,
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

    // Try Redis first, fallback to MySQL
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
        const [priceRows] = await pool.execute(
          "SELECT * FROM stock_prices WHERE symbol = ? ORDER BY business_date DESC LIMIT 1",
          [symbol]
        );
        if (priceRows.length > 0) {
          const sp = priceRows[0];
          details.business_date = sp.business_date;
          details.open_price = sp.open_price;
          details.ltp = sp.close_price;
          details.price_change = sp.change;
          details.percentage_change = sp.percentage_change;
          details.source = 'MYSQL_CACHE';
        }
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
      source = 'MYSQL_CACHE';
      let sql = `
        SELECT sp.* FROM stock_prices sp
        WHERE sp.business_date = (SELECT MAX(business_date) FROM stock_prices)
      `;
      if (symbols && Array.isArray(symbols) && symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        sql += ` AND sp.symbol IN (${placeholders})`;
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
      `SELECT symbol, company_name, nepali_company_name, sector_name, nepali_sector_name, market_capitalization 
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
  searchStocks,
  getScriptDetails,
  getLatestPrices,
  getIntradayData,
  insertTodayPrices,
  getStockHistory
};
