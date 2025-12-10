const { db } = require('./database');

function getAllSecurityIds() {
  return new Promise((resolve, reject) => {
    db.all("SELECT DISTINCT security_id, symbol FROM stock_prices WHERE security_id > 0", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function searchStocks(query) {
  return new Promise((resolve, reject) => {
    const pattern = `%${query}%`;
    db.all(
      `SELECT DISTINCT symbol, security_name, security_id FROM stock_prices 
       WHERE symbol LIKE ? OR security_name LIKE ? 
       ORDER BY symbol LIMIT 20`,
      [pattern, pattern],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getScriptDetails(symbol) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        cd.*,
        sp.business_date
      FROM company_details cd
      LEFT JOIN stock_prices sp ON cd.symbol = sp.symbol
      WHERE cd.symbol = ?
    `;

    db.get(sql, [symbol], (err, row) => {
      if (err) reject(err);
      else if (row) {
        resolve(row);
      } else {
        db.get("SELECT * FROM stock_prices WHERE symbol = ?", [symbol], (err, priceRow) => {
          if (err) reject(err);
          else resolve(priceRow);
        });
      }
    });
  });
}

function getLatestPrices(symbols, options = {}) {
  return new Promise((resolve, reject) => {
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

      db.all(sql, symbols, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
      return;
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
        SELECT MAX(business_date) FROM stock_prices sp2 WHERE sp2.symbol = sp.symbol
      )
    `;

    // Add filter conditions
    if (filter === 'gainers') {
      sql += ' AND sp.change > 0';
    } else if (filter === 'losers') {
      sql += ' AND sp.change < 0';
    }

    // Add sorting
    const allowedSortColumns = ['symbol', 'close_price', 'change', 'percentage_change', 'volume', 'turnover', 'market_capitalization'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'symbol';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    sql += ` ORDER BY sp.${sortColumn} ${sortOrder}`;

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;

    db.all(sql, [limit, offset], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAllCompanies(limit = 100, offset = 0) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM company_details 
      ORDER BY company_name 
      LIMIT ? OFFSET ?
    `;

    db.all(sql, [limit, offset], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getCompaniesBySector(sector, limit = 50) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM company_details 
      WHERE sector_name LIKE ?
      ORDER BY market_capitalization DESC NULLS LAST, company_name
      LIMIT ?
    `;

    db.all(sql, [`%${sector}%`, limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getTopCompaniesByMarketCap(limit = 20) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM company_details 
      WHERE market_capitalization IS NOT NULL AND market_capitalization > 0
      ORDER BY market_capitalization DESC
      LIMIT ?
    `;

    db.all(sql, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getCompanyStats() {
  return new Promise((resolve, reject) => {
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

    db.get(sql, [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

module.exports = {
  getAllSecurityIds,
  searchStocks,
  getScriptDetails,
  getLatestPrices,
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getCompanyStats
};