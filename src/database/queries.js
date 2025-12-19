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
      sp.percentage_change AS todays_change,
      sp.\`change\` AS price_change
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

// Market status functions - UNIFIED
async function saveMarketSummary(summary) {
  const { status, isOpen, indexData } = summary;

  // Ensure we have a valid date
  const tradingDate = indexData.tradingDate || (() => {
    const now = new Date();
    const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
    return nepaliDate.toISOString().split('T')[0];
  })();

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
    logger.info(`💾 Market summary saved for ${tradingDate} (Status: ${status})`);
    return result.insertId;
  } catch (error) {
    console.error('❌ Error saving market summary:', error.message);
    throw error;
  }
}

// Deprecated: Only logs warning
async function updateMarketStatus(status) {
  console.warn('⚠️ updateMarketStatus is deprecated. Use saveMarketSummary.');
  return Promise.resolve();
}

// Legacy adapter
async function saveMarketIndex(indexData) {
  return saveMarketSummary({
    status: (indexData.nepseIndex > 0) ? 'OPEN' : 'CLOSED',
    isOpen: (indexData.nepseIndex > 0),
    indexData
  });
}

async function getCurrentMarketStatus() {
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
        lastUpdated: rows[0].last_updated
      };
    }
    return { status: 'CLOSED', isOpen: false };
  } catch (error) {
    console.error('❌ Error fetching market status:', error.message);
    return { status: 'CLOSED', isOpen: false };
  }
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

async function getIpos(limit = 100, offset = 0, startDate = null, endDate = null) {
  let sql = `
    SELECT 
      ipo_id,
      company_name,
      symbol,
      share_registrar,
      sector_name,
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
  return rows;
}
// Announced Dividend functions
async function insertAnnouncedDividends(dividendData) {
  const sql = `
    INSERT INTO announced_dividends (
      symbol, company_name, bonus_share, cash_dividend, total_dividend, 
      book_close_date, fiscal_year, right_share, right_book_close_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      bonus_share = VALUES(bonus_share),
      cash_dividend = VALUES(cash_dividend),
      total_dividend = VALUES(total_dividend),
      right_share = VALUES(right_share),
      right_book_close_date = VALUES(right_book_close_date),
      updated_at = CURRENT_TIMESTAMP
  `;

  const {
    symbol, company_name, bonus_share, cash_dividend, total_dividend,
    book_close_date, fiscal_year, right_share, right_book_close_date
  } = dividendData;

  const [result] = await pool.execute(sql, [
    symbol, company_name, bonus_share, cash_dividend, total_dividend,
    book_close_date, fiscal_year, right_share, right_book_close_date
  ]);
  return result;
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

async function getRecentBonusForSymbols(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const placeholders = symbols.map(() => '?').join(',');
  const sql = `
    SELECT symbol, company_name, bonus_share, cash_dividend, 
           total_dividend, book_close_date, fiscal_year
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
  getCurrentMarketStatus,
  getMarketIndexData,
  getMarketIndexHistory,
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
  // Price Alerts
  createPriceAlert,
  getUserPriceAlerts,
  updatePriceAlert,
  deletePriceAlert,
  getActivePriceAlerts,
  markAlertTriggered,
  updateAlertState
};
