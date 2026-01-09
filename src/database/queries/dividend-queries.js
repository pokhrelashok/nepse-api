const { pool, saveDividends } = require('../database');
const { formatDividendsForDatabase } = require('../../utils/formatter');

// Announced Dividend functions
async function insertAnnouncedDividends(dividendData) {
  const sql = `
    INSERT INTO announced_dividends(
        symbol, company_name, nepali_company_name, bonus_share, cash_dividend, total_dividend,
        book_close_date, published_date, fiscal_year, fiscal_year_bs,
        book_close_date_bs, right_share, right_book_close_date
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    SELECT DATE_FORMAT(published_date, '%Y-%m-%d') as published_date 
    FROM dividends d
    JOIN stock_prices sp ON d.security_id = sp.security_id
    WHERE sp.symbol = ? AND(
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
    `% ${fyAD_hyphen}% `, ` % ${fyBS_hyphen}% `
  ]);

  return rows.length > 0 ? rows[0].published_date : null;
}

async function getAnnouncedDividends(limit = 100, offset = 0, startDate = null, endDate = null) {
  let sql = `
    SELECT
    symbol, company_name, nepali_company_name, bonus_share, cash_dividend, total_dividend,
      DATE_FORMAT(book_close_date, '%Y-%m-%d') as book_close_date,
      DATE_FORMAT(published_date, '%Y-%m-%d') as published_date,
      fiscal_year, fiscal_year_bs, book_close_date_bs, right_share,
      DATE_FORMAT(right_book_close_date, '%Y-%m-%d') as right_book_close_date
    FROM announced_dividends 
    WHERE 1 = 1
      `;
  const params = [];

  if (startDate) {
    sql += ` AND book_close_date >= ? `;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND book_close_date <= ? `;
    params.push(endDate);
  }

  sql += ` ORDER BY book_close_date DESC, fiscal_year DESC LIMIT ? OFFSET ? `;
  params.push(String(limit), String(offset));

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getRecentBonusForSymbols(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const placeholders = symbols.map(() => '?').join(',');
  const sql = `
    SELECT symbol, company_name, nepali_company_name, bonus_share, cash_dividend,
      total_dividend, DATE_FORMAT(book_close_date, '%Y-%m-%d') as book_close_date,
      DATE_FORMAT(published_date, '%Y-%m-%d') as published_date, fiscal_year, fiscal_year_bs
    FROM announced_dividends 
    WHERE symbol IN(${placeholders})
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

function insertDividends(dividends) {
  const formatted = formatDividendsForDatabase(dividends);
  return saveDividends(formatted);
}

module.exports = {
  insertDividends,
  insertAnnouncedDividends,
  getAnnouncedDividends,
  getRecentBonusForSymbols,
  findPublishedDate
};
