const { pool, savePrices, saveCompanyDetails, saveDividends, saveFinancials } = require('./database');
const logger = require('../utils/logger');

// Wrapper functions for database operations
function insertTodayPrices(prices) {
  return savePrices(prices);
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
    `SELECT DISTINCT sp.symbol, sp.security_name, sp.security_id, cd.sector_name as sector, cd.status 
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
      cd.*,
      sp.business_date
    FROM company_details cd
    LEFT JOIN stock_prices sp ON cd.symbol = sp.symbol
    WHERE cd.symbol = ?
  `;

  const [rows] = await pool.execute(sql, [symbol]);

  if (rows.length > 0) {
    const details = rows[0];
    const securityId = details.security_id;

    // Fetch dividends
    const [dividends] = await pool.execute(
      "SELECT * FROM dividends WHERE security_id = ? ORDER BY fiscal_year DESC",
      [securityId]
    );
    details.dividends = dividends;

    // Fetch financials
    const [financials] = await pool.execute(
      "SELECT * FROM company_financials WHERE security_id = ? ORDER BY fiscal_year DESC, quarter DESC",
      [securityId]
    );
    details.financials = financials;

    return details;
  }

  // Fallback to stock_prices if no company details found
  const [priceRows] = await pool.execute(
    "SELECT * FROM stock_prices WHERE symbol = ?",
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

  // If symbols array is provided, use the original logic
  if (symbols && Array.isArray(symbols) && symbols.length > 0) {
    const placeholders = symbols.map(() => '?').join(',');
    const sql = `
      SELECT sp.*, cd.company_name, cd.sector_name 
      FROM stock_prices sp
      LEFT JOIN company_details cd ON sp.symbol = cd.symbol
      WHERE sp.symbol IN (${placeholders})
      ORDER BY sp.symbol
    `;

    const [rows] = await pool.execute(sql, symbols);
    return rows;
  }

  // Enhanced query for getting all latest prices with options
  let sql = `
    SELECT 
      sp.*,
      cd.company_name,
      cd.sector_name,
      cd.market_capitalization as company_market_cap
    FROM stock_prices sp
    LEFT JOIN company_details cd ON sp.symbol = cd.symbol
    WHERE sp.business_date = (
      SELECT MAX(sp2.business_date) FROM stock_prices sp2 WHERE sp2.symbol = sp.symbol
    )
  `;

  // Add filter conditions
  if (filter === 'gainers') {
    sql += ' AND sp.`change` > 0';
  } else if (filter === 'losers') {
    sql += ' AND sp.`change` < 0';
  }

  // Add sorting
  const allowedSortColumns = ['symbol', 'close_price', 'change', 'percentage_change', 'volume', 'turnover', 'market_capitalization'];
  let sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'symbol';
  const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  // Map friendly names to DB columns
  const columnMapping = {
    'volume': 'total_traded_quantity',
    'turnover': 'total_traded_value',
    'change': '`change`' // Reserved word
  };

  // Get the actual column name (default to sp.columnName if not mapped)
  const dbColumn = columnMapping[sortColumn] || sortColumn;

  // Construct the order clause
  // Note: sp. prefix is needed for unmapped columns that belong to stock_prices, 
  // but mapped columns like `change` might not need it if they are already quoted or specific.
  // Ideally, total_traded_quantity is in sp.

  let orderClause;
  if (sortColumn === 'market_capitalization') {
    orderClause = 'cd.market_capitalization';
  } else if (columnMapping[sortColumn]) {
    // mapped columns
    orderClause = sortColumn === 'change' ? 'sp.`change`' : `sp.${columnMapping[sortColumn]}`;
  } else {
    // direct columns
    orderClause = `sp.${sortColumn}`;
  }

  sql += ` ORDER BY ${orderClause} ${sortOrder}`;

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;

  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);
  return rows;
}

async function getAllCompanies() {
  const sql = `
    SELECT 
      cd.symbol,
      cd.company_name AS name,
      cd.logo_url AS logo,
      cd.sector_name AS sector,
      cd.status,
      sp.percentage_change AS todaysChange,
      sp.\`change\` AS priceChange
    FROM company_details cd
    LEFT JOIN stock_prices sp ON cd.symbol = sp.symbol
    ORDER BY cd.company_name
  `;

  const [rows] = await pool.execute(sql);
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

// Market status functions
async function insertMarketStatus(status, tradingDate, openTime = null, closeTime = null, additionalInfo = null) {
  const sql = `
    INSERT INTO market_status (id, is_open, trading_date, last_updated)
    VALUES (1, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      is_open = VALUES(is_open),
      trading_date = VALUES(trading_date),
      last_updated = CURRENT_TIMESTAMP
  `;

  const isOpen = status === 'OPEN' ? 1 : 0;
  const [result] = await pool.execute(sql, [isOpen, tradingDate]);
  return result.insertId;
}

async function getCurrentMarketStatus() {
  const sql = `SELECT is_open, status, last_updated, trading_date FROM market_status WHERE id = 1`;

  const [rows] = await pool.execute(sql);

  if (rows.length > 0) {
    const row = rows[0];
    return {
      isOpen: Boolean(row.is_open),
      status: row.status || (Boolean(row.is_open) ? 'OPEN' : 'CLOSED'),
      lastUpdated: row.last_updated,
      tradingDate: row.trading_date
    };
  }
  return null;
}

async function getMarketStatusHistory(days = 7) {
  // Note: MySQL date functions differ from SQLite
  const sql = `
    SELECT 
      trading_date,
      is_open as status_bool,
      status,
      last_updated
    FROM market_status 
    WHERE trading_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    ORDER BY trading_date DESC, last_updated DESC
  `;

  const [rows] = await pool.execute(sql, [String(days)]);
  return rows;
}

// Market status functions
async function updateMarketStatus(isOpenOrStatus) {
  let isOpen = false;
  let status = 'CLOSED';

  // Handle both boolean (legacy) and string inputs
  if (typeof isOpenOrStatus === 'boolean') {
    isOpen = isOpenOrStatus;
    status = isOpen ? 'OPEN' : 'CLOSED';
  } else if (typeof isOpenOrStatus === 'string') {
    status = isOpenOrStatus.toUpperCase();
    // Consider PRE_OPEN as 'open' for scraping purposes, or strict 'OPEN'
    // To match user request: "price scraping in the preopen session as well"
    // So isOpen should probably be true for PRE_OPEN to trigger logic that depends on isOpen
    isOpen = status === 'OPEN' || status === 'PRE_OPEN' || status === 'PRE-OPEN';
  }

  // Get today's date in Nepal timezone
  const now = new Date();
  const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
  const tradingDate = nepaliDate.toISOString().split('T')[0];

  const sql = `
    INSERT INTO market_status (id, is_open, status, trading_date, last_updated)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      is_open = VALUES(is_open),
      status = VALUES(status),
      trading_date = VALUES(trading_date),
      last_updated = CURRENT_TIMESTAMP
  `;

  const [result] = await pool.execute(sql, [isOpen ? 1 : 0, status, tradingDate]);
  return result.insertId;
}

// Market index functions
async function saveMarketIndex(indexData) {
  const {
    nepseIndex,
    indexChange,
    indexPercentageChange,
    totalTurnover,
    totalTradedShares,
    advanced,
    declined,
    unchanged,
    marketStatusDate = null,
    marketStatusTime = null,
    tradingDate = null
  } = indexData;

  // Get today's date in Nepal timezone if not provided
  const date = tradingDate || (() => {
    const now = new Date();
    const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
    return nepaliDate.toISOString().split('T')[0];
  })();

  const sql = `
    INSERT INTO market_index (
      trading_date, market_status_date, market_status_time, nepse_index, index_change, index_percentage_change,
      total_turnover, total_traded_shares, advanced, declined, unchanged,
      last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      last_updated = CURRENT_TIMESTAMP
  `;

  const [result] = await pool.execute(sql, [
    date, marketStatusDate, marketStatusTime, nepseIndex, indexChange, indexPercentageChange,
    totalTurnover, totalTradedShares, advanced, declined, unchanged
  ]);

  logger.info('Market index saved successfully');
  return result.insertId;
}

async function getMarketIndexData(tradingDate = null) {
  // Get today's date in Nepal timezone if not provided
  const date = tradingDate || (() => {
    const now = new Date();
    const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
    return nepaliDate.toISOString().split('T')[0];
  })();

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

  const [rows] = await pool.execute(sql, [date]);
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

module.exports = {
  searchStocks,
  getScriptDetails,
  getLatestPrices,
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getCompanyStats,
  getAllSecurityIds,
  getSecurityIdsWithoutDetails,
  getSecurityIdsBySymbols,
  insertTodayPrices,
  insertCompanyDetails,
  insertDividends,
  insertFinancials,
  updateMarketStatus,
  getCurrentMarketStatus,
  saveMarketIndex,
  getMarketIndexData,
  getMarketIndexHistory,
  insertIpo,
  getIpos
};

// IPO functions
async function insertIpo(ipoData) {
  const sql = `
    INSERT INTO ipos (
      ipo_id, company_name, symbol, share_registrar, sector_name, 
      share_type, price_per_unit, rating, units, min_units, max_units, 
      total_amount, opening_date, closing_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      symbol = VALUES(symbol),
      share_registrar = VALUES(share_registrar),
      sector_name = VALUES(sector_name),
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
    ipoId, companyName, stockSymbol, shareRegistrar, sectorName,
    shareType, pricePerUnit, rating, units, minUnits, maxUnits,
    totalAmount, openingDateAD, closingDateAD, status
  } = ipoData;

  const [result] = await pool.execute(sql, [
    ipoId, companyName, stockSymbol, shareRegistrar, sectorName,
    shareType, pricePerUnit, rating, units, minUnits, maxUnits,
    totalAmount, openingDateAD, closingDateAD, status
  ]);
  return result;
}

async function getIpos(limit = 100, offset = 0) {
  const sql = `
    SELECT 
      ipo_id as ipoId,
      company_name as companyName,
      symbol as stockSymbol,
      share_registrar as shareRegistrar,
      sector_name as sectorName,
      share_type as shareType,
      price_per_unit as pricePerUnit,
      rating,
      units,
      min_units as minUnits,
      max_units as maxUnits,
      total_amount as totalAmount,
      opening_date as openingDateAD,
      closing_date as closingDateAD,
      status
    FROM ipos
    ORDER BY opening_date DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);
  return rows;
}