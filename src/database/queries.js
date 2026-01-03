const { pool, savePrices, saveCompanyDetails, saveDividends, saveFinancials, saveMarketIndexHistory, saveStockPriceHistory } = require('./database');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { normalizeShareType, formatShareType } = require('../utils/share-type-utils');

// Wrapper functions for database operations
async function insertTodayPrices(prices) {
  if (!prices || prices.length === 0) return;

  try {
    const pipeline = redis.pipeline();
    const today = new Date();
    const nepaliDate = new Date(today.getTime() + (5.75 * 60 * 60 * 1000));
    const todayStr = nepaliDate.toISOString().split('T')[0];

    for (const p of prices) {
      const symbol = p.symbol;
      const data = JSON.stringify({
        ...p,
        last_updated: new Date().toISOString()
      });
      pipeline.hset('live:stock_prices', symbol, data);
    }

    // Also store by date for cold cache if needed or history reference
    pipeline.hset('live:metadata', 'last_price_update', new Date().toISOString());
    pipeline.hset('live:metadata', 'last_price_date', todayStr);

    await pipeline.exec();
    logger.info(`🚀 Saved ${prices.length} stock prices to Redis`);

    // Maintain MySQL for now as per user request
    return savePrices(prices);
  } catch (error) {
    logger.error('❌ Redis error in insertTodayPrices:', error);
    return savePrices(prices); // Fallback to MySQL
  }
}

function insertCompanyDetails(details) {
  return saveCompanyDetails(details);
}

function insertDividends(dividends) {
  return saveDividends(dividends);
}

function insertFinancials(financials) {
  return saveFinancials(financials);
}

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
            cd.company_name, cd.nepali_company_name, cd.status 
     FROM stock_prices sp
     LEFT JOIN company_details cd ON sp.symbol = cd.symbol
     WHERE sp.symbol LIKE ? OR sp.security_name LIKE ? 
     ORDER BY sp.symbol LIMIT 20`,
    [pattern, pattern]
  );
  return rows;
}

async function getScriptDetails(symbol) {
  // 1. Get company details from MySQL (Static/Metadata)
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

    // 2. Try to get live price from Redis
    try {
      const livePriceJson = await redis.hget('live:stock_prices', symbol);
      if (livePriceJson) {
        const livePrice = JSON.parse(livePriceJson);
        details.business_date = livePrice.business_date;
        details.ltp = livePrice.close_price;
        details.price_change = livePrice.change;
        details.percentage_change = livePrice.percentage_change;
        details.high_price = livePrice.high_price;
        details.low_price = livePrice.low_price;
        details.total_traded_quantity = livePrice.total_traded_quantity;
        details.total_traded_value = livePrice.total_traded_value;
        details.source = 'REDIS_LIVE';
      } else {
        // Fallback to MySQL if not in Redis
        const [priceRows] = await pool.execute(
          "SELECT * FROM stock_prices WHERE symbol = ? ORDER BY business_date DESC LIMIT 1",
          [symbol]
        );
        if (priceRows.length > 0) {
          const sp = priceRows[0];
          details.business_date = sp.business_date;
          details.ltp = sp.close_price;
          details.price_change = sp.change;
          details.percentage_change = sp.percentage_change;
          details.source = 'MYSQL_CACHE';
        }
      }
    } catch (error) {
      logger.error('❌ Redis error in getScriptDetails:', error);
    }

    // 3. Fetch dividends and financials independently
    const [dividends] = await pool.execute(
      "SELECT * FROM dividends WHERE security_id = ? ORDER BY fiscal_year DESC",
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
    filter = null
  } = options;

  let allPrices = [];
  let source = 'REDIS_LIVE';

  try {
    // 1. Try to get all prices from Redis
    const redisPrices = await redis.hgetall('live:stock_prices');
    if (redisPrices && Object.keys(redisPrices).length > 0) {
      allPrices = Object.values(redisPrices).map(p => JSON.parse(p));

      // If specific symbols requested, filter them
      if (symbols && Array.isArray(symbols) && symbols.length > 0) {
        allPrices = allPrices.filter(p => symbols.includes(p.symbol));
      }
    } else {
      // 2. Fallback to MySQL if Redis is empty
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
    // Extreme fallback omitted for brevity, usually MySQL
  }

  // 3. Apply filters (gainers/losers)
  if (filter === 'gainers') {
    allPrices = allPrices.filter(p => p.change > 0);
  } else if (filter === 'losers') {
    allPrices = allPrices.filter(p => p.change < 0);
  }

  // 4. Join with metadata (company details)
  // To keep it efficient, we only fetch what we need for the current page if it's the full list
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

    // Merge
    const metaMap = metadata.reduce((acc, curr) => ({ ...acc, [curr.symbol]: curr }), {});
    return pagedList.map(p => ({
      ...p,
      ...metaMap[p.symbol],
      source
    })).sort((a, b) => {
      const field = sortBy === 'change' ? 'change' : sortBy;
      const valA = a[field];
      const valB = b[field];
      if (order.toUpperCase() === 'DESC') return valB > valA ? 1 : -1;
      return valA > valB ? 1 : -1;
    });
  }

  return [];
}

async function getAllCompanies() {
  const sql = `
    SELECT 
      cd.symbol,
      cd.company_name AS name,
      cd.nepali_company_name,
      cd.logo_url AS logo,
      cd.sector_name AS sector,
      cd.nepali_sector_name,
      cd.status
    FROM company_details cd
    ORDER BY cd.company_name
  `;

  const [rows] = await pool.execute(sql);

  // Try to merge with live price changes from Redis
  try {
    const livePrices = await redis.hgetall('live:stock_prices');
    if (livePrices) {
      return rows.map(r => {
        const live = livePrices[r.symbol] ? JSON.parse(livePrices[r.symbol]) : null;
        return {
          ...r,
          todays_change: live ? live.percentage_change : 0,
          price_change: live ? live.change : 0,
          ltp: live ? live.close_price : null
        };
      });
    }
  } catch (error) {
    logger.error('❌ Redis error in getAllCompanies:', error);
  }

  return rows;
}

async function getCompaniesBySector(sector, limit = 50) {
  const sql = `
    SELECT * FROM company_details 
    WHERE sector_name LIKE ?
    ORDER BY CASE WHEN market_capitalization IS NULL THEN 1 ELSE 0 END, 
             market_capitalization DESC, 
             company_name
    LIMIT ?
  `;

  const [rows] = await pool.execute(sql, [`%${sector}%`, String(limit)]);
  return rows;
}

async function getTopCompaniesByMarketCap(limit = 20) {
  const sql = `
    SELECT * FROM company_details 
    WHERE market_capitalization IS NOT NULL AND market_capitalization > 0
    ORDER BY market_capitalization DESC
    LIMIT ?
  `;

  const [rows] = await pool.execute(sql, [String(limit)]);
  return rows;
}

async function getCompanyStats() {
  const sql = `
    SELECT 
      COUNT(*) as total_companies,
      COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_companies,
      COUNT(CASE WHEN logo_url IS NOT NULL AND is_logo_placeholder = 0 THEN 1 END) as companies_with_real_logos,
      COUNT(DISTINCT sector_name) as total_sectors,
      SUM(market_capitalization) as total_market_cap,
      AVG(market_capitalization) as avg_market_cap,
      MAX(market_capitalization) as max_market_cap
    FROM company_details
  `;

  const [rows] = await pool.execute(sql);
  return rows[0];
}

// Market status functions - UNIFIED
async function saveMarketSummary(summary) {
  const { status, isOpen, indexData } = summary;

  // Ensure we have a valid date
  const tradingDate = indexData.tradingDate || (() => {
    const now = new Date();
    const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
    return nepaliDate.toISOString().split('T')[0];
  })();

  // 1. Save to Redis (Primary Live Store)
  try {
    const statusData = {
      status,
      is_open: isOpen ? '1' : '0',
      trading_date: tradingDate,
      last_updated: new Date().toISOString()
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
      last_updated: new Date().toISOString()
    };

    const pipeline = redis.pipeline();
    pipeline.hset('live:market_status', statusData);
    pipeline.hset('live:market_index', indexDataToSave);
    await pipeline.exec();
    logger.info(`🚀 Market summary saved to Redis for ${tradingDate}`);
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
  const now = new Date();
  const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
  const todayStr = nepaliDate.toISOString().split('T')[0];
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
        trading_date: new Date().toISOString().split('T')[0], // Approximation for live
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


// IPO functions
async function insertIpo(ipoData) {
  const sql = `
    INSERT INTO ipos (
      ipo_id, company_name, nepali_company_name, symbol, share_registrar, 
      sector_name, nepali_sector_name, share_type, price_per_unit, rating, 
      units, min_units, max_units, total_amount, opening_date, closing_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      nepali_company_name = COALESCE(VALUES(nepali_company_name), nepali_company_name),
      symbol = VALUES(symbol),
      share_registrar = VALUES(share_registrar),
      sector_name = VALUES(sector_name),
      nepali_sector_name = COALESCE(VALUES(nepali_sector_name), nepali_sector_name),
      share_type = VALUES(share_type),
      price_per_unit = VALUES(price_per_unit),
      rating = VALUES(rating),
      units = VALUES(units),
      min_units = VALUES(min_units),
      max_units = VALUES(max_units),
      total_amount = VALUES(total_amount),
      opening_date = VALUES(opening_date),
      closing_date = VALUES(closing_date),
      status = VALUES(status)
  `;

  const {
    ipoId, companyName, nepaliCompanyName, stockSymbol, shareRegistrar, sectorName, nepaliSectorName,
    shareType, pricePerUnit, rating, units, minUnits, maxUnits,
    totalAmount, openingDateAD, closingDateAD, status
  } = ipoData;

  // Normalize share_type to lowercase_underscore format for storage
  const normalizedShareType = normalizeShareType(shareType);

  const [result] = await pool.execute(sql, [
    ipoId, companyName, nepaliCompanyName || null, stockSymbol, shareRegistrar,
    sectorName, nepaliSectorName || null, normalizedShareType, pricePerUnit, rating,
    units, minUnits, maxUnits, totalAmount, openingDateAD, closingDateAD, status
  ]);
  return result;
}

async function getIpos(limit = 100, offset = 0, startDate = null, endDate = null) {
  let sql = `
    SELECT 
      ipo_id,
      company_name,
      nepali_company_name,
      symbol,
      share_registrar,
      sector_name,
      nepali_sector_name,
      share_type,
      price_per_unit,
      rating,
      units,
      min_units,
      max_units,
      total_amount,
      opening_date,
      closing_date,
      status
    FROM ipos
    WHERE 1=1
  `;

  const params = [];

  if (startDate) {
    sql += ` AND opening_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND opening_date <= ?`;
    params.push(endDate);
  }

  sql += ` ORDER BY opening_date DESC LIMIT ? OFFSET ?`;
  params.push(String(limit), String(offset));

  const [rows] = await pool.execute(sql, params);

  // Format share_type for display (Title Case)
  return rows.map(row => ({
    ...row,
    share_type: formatShareType(row.share_type)
  }));
}
// Announced Dividend functions
async function insertAnnouncedDividends(dividendData) {
  const sql = `
    INSERT INTO announced_dividends (
      symbol, company_name, nepali_company_name, bonus_share, cash_dividend, total_dividend, 
      book_close_date, published_date, fiscal_year, fiscal_year_bs, 
      book_close_date_bs, right_share, right_book_close_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      nepali_company_name = COALESCE(VALUES(nepali_company_name), nepali_company_name),
      bonus_share = VALUES(bonus_share),
      cash_dividend = VALUES(cash_dividend),
      total_dividend = VALUES(total_dividend),
      book_close_date = VALUES(book_close_date),
      published_date = VALUES(published_date),
      fiscal_year_bs = VALUES(fiscal_year_bs),
      book_close_date_bs = VALUES(book_close_date_bs),
      right_share = VALUES(right_share),
      right_book_close_date = VALUES(right_book_close_date),
      updated_at = CURRENT_TIMESTAMP
  `;

  const {
    symbol, company_name, nepali_company_name, bonus_share, cash_dividend, total_dividend,
    book_close_date, published_date, fiscal_year, fiscal_year_bs,
    book_close_date_bs, right_share, right_book_close_date
  } = dividendData;

  const [result] = await pool.execute(sql, [
    symbol, company_name, nepali_company_name || null, bonus_share, cash_dividend, total_dividend,
    book_close_date, published_date, fiscal_year, fiscal_year_bs,
    book_close_date_bs, right_share, right_book_close_date
  ]);
  return result;
}

/**
 * Finds published_date (announcement date) from dividends table
 * to sync it to announced_dividends
 */
async function findPublishedDate(symbol, fiscalYearAD, fiscalYearBS) {
  // Normalize fiscal years for matching
  // Source examples: 2080/81, 2080/2081, 2023/2024
  // Target in dividends: 2080-2081 or 2079/80 etc.

  const fyAD_hyphen = fiscalYearAD ? fiscalYearAD.replace('/', '-') : null;
  const fyBS_hyphen = fiscalYearBS ? fiscalYearBS.replace('/', '-') : null;

  const sql = `
    SELECT published_date 
    FROM dividends d
    JOIN stock_prices sp ON d.security_id = sp.security_id
    WHERE sp.symbol = ? AND (
      d.fiscal_year = ? OR d.fiscal_year = ? OR 
      d.fiscal_year = ? OR d.fiscal_year = ? OR
      d.fiscal_year LIKE ? OR d.fiscal_year LIKE ?
    )
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [
    symbol,
    fiscalYearAD, fyAD_hyphen,
    fiscalYearBS, fyBS_hyphen,
    `%${fyAD_hyphen}%`, `%${fyBS_hyphen}%`
  ]);

  return rows.length > 0 ? rows[0].published_date : null;
}

async function getAnnouncedDividends(limit = 100, offset = 0, startDate = null, endDate = null) {
  let sql = `SELECT * FROM announced_dividends WHERE 1=1`;
  const params = [];

  if (startDate) {
    sql += ` AND book_close_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND book_close_date <= ?`;
    params.push(endDate);
  }

  sql += ` ORDER BY book_close_date DESC, fiscal_year DESC LIMIT ? OFFSET ?`;
  params.push(String(limit), String(offset));

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getStockHistory(symbol, startDate) {
  const sql = `
    SELECT 
      business_date,
      high_price,
      low_price,
      close_price,
      total_trades,
      total_traded_quantity,
      total_traded_value
    FROM stock_price_history
    WHERE symbol = ? AND business_date >= ?
    ORDER BY business_date ASC
  `;

  const [rows] = await pool.execute(sql, [symbol, startDate]);
  return rows;
}

async function getMarketIndicesHistory(options = {}) {
  const {
    indexId = null,
    startDate = null,
    endDate = null,
    limit = 1000
  } = options;

  let sql = `
    SELECT * FROM market_indices_history 
    WHERE 1=1
  `;
  const params = [];

  if (indexId) {
    sql += ` AND exchange_index_id = ?`;
    params.push(indexId);
  }

  if (startDate) {
    sql += ` AND business_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND business_date <= ?`;
    params.push(endDate);
  }

  sql += ` ORDER BY business_date ASC, exchange_index_id ASC LIMIT ?`;
  params.push(String(limit));

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getRecentBonusForSymbols(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const placeholders = symbols.map(() => '?').join(',');
  const sql = `
    SELECT symbol, company_name, nepali_company_name, bonus_share, cash_dividend, 
           total_dividend, book_close_date, published_date, fiscal_year, fiscal_year_bs
    FROM announced_dividends 
    WHERE symbol IN (${placeholders})
      AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
    ORDER BY updated_at DESC
  `;

  const [rows] = await pool.execute(sql, symbols);

  // Create a map by symbol (in case of multiple entries, take the most recent)
  const bonusMap = {};
  for (const row of rows) {
    if (!bonusMap[row.symbol]) {
      bonusMap[row.symbol] = row;
    }
  }
  return bonusMap;
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

// --- Price Alerts ---

async function createPriceAlert(userId, symbol, price, condition) {
  const sql = `
    INSERT INTO price_alerts (user_id, symbol, target_price, alert_condition)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [userId, symbol, price, condition]);
  return result.insertId;
}

async function getUserPriceAlerts(userId) {
  const sql = `
    SELECT * FROM price_alerts 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
}

async function updatePriceAlert(alertId, userId, data) {
  const { price, condition, is_active } = data;
  const updates = [];
  const params = [];

  if (price !== undefined) {
    updates.push('target_price = ?');
    params.push(price);
  }
  if (condition !== undefined) {
    updates.push('alert_condition = ?');
    params.push(condition);
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
    if (is_active) {
      updates.push('triggered_at = NULL');
      updates.push("last_state = 'NOT_MET'");
    }
  }

  if (updates.length === 0) return true;

  params.push(alertId, userId);
  const sql = `
    UPDATE price_alerts 
    SET ${updates.join(', ')} 
    WHERE id = ? AND user_id = ?
  `;
  const [result] = await pool.execute(sql, params);
  return result.affectedRows > 0;
}

async function deletePriceAlert(alertId, userId) {
  const sql = 'DELETE FROM price_alerts WHERE id = ? AND user_id = ?';
  const [result] = await pool.execute(sql, [alertId, userId]);
  return result.affectedRows > 0;
}

async function getActivePriceAlerts() {
  const sql = `
    SELECT pa.*, nt.fcm_token 
    FROM price_alerts pa
    JOIN notification_tokens nt ON nt.user_id = pa.user_id
    WHERE pa.is_active = TRUE
  `;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function markAlertTriggered(alertId) {
  const sql = `
    UPDATE price_alerts 
    SET triggered_at = CURRENT_TIMESTAMP, last_state = 'MET' 
    WHERE id = ?
  `;
  await pool.execute(sql, [alertId]);
}

async function updateAlertState(alertId, state) {
  const sql = 'UPDATE price_alerts SET last_state = ? WHERE id = ?';
  await pool.execute(sql, [state, alertId]);
}

module.exports = {
  getAllSecurityIds,
  getSecurityIdsWithoutDetails,
  getSecurityIdsBySymbols,
  searchStocks,
  getScriptDetails,
  getLatestPrices,
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getCompanyStats,
  saveMarketSummary,
  updateMarketStatus,
  saveMarketIndex,
  saveMarketIndexHistory,
  getCurrentMarketStatus,
  getMarketIndexData,
  getLatestMarketIndexData,
  getMarketIndexHistory,
  getMarketIndicesHistory,
  getMarketStatusHistory,
  insertTodayPrices,
  insertCompanyDetails,
  insertDividends,
  insertFinancials,
  insertIpo,
  getIpos,
  insertAnnouncedDividends,
  getAnnouncedDividends,
  getRecentBonusForSymbols,
  getStockHistory,
  findPublishedDate,
  // Price Alerts
  createPriceAlert,
  getUserPriceAlerts,
  updatePriceAlert,
  deletePriceAlert,
  getActivePriceAlerts,
  markAlertTriggered,
  updateAlertState
};
