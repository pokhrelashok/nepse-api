const { pool } = require('../database');
const logger = require('../../utils/logger');

/**
 * Admin-specific database queries
 * These are optimized for admin panel use cases and separate from app queries
 */

// ==================== COMPANIES ====================

async function getCompaniesForAdmin(limit = 20, offset = 0) {
  const sql = `
    SELECT 
      cd.symbol,
      cd.company_name AS name,
      cd.nepali_company_name,
      cd.logo_url AS logo,
      cd.sector_name AS sector,
      cd.nepali_sector_name,
      cd.status,
      cd.market_capitalization,
      sp.close_price AS ltp,
      sp.percentage_change AS todays_change,
      sp.\`change\` AS price_change
    FROM company_details cd
    LEFT JOIN stock_prices sp ON cd.symbol = sp.symbol
    ORDER BY cd.company_name
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);
  return rows;
}

async function getCompanyCountForAdmin() {
  const sql = 'SELECT COUNT(*) as total FROM company_details';
  const [rows] = await pool.execute(sql);
  return rows[0].total;
}

// ==================== IPOS ====================

async function getIposForAdmin(limit = 20, offset = 0, filters = {}) {
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

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY opening_date DESC LIMIT ? OFFSET ?';
  params.push(String(limit), String(offset));

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getIpoCountForAdmin(filters = {}) {
  let sql = 'SELECT COUNT(*) as total FROM ipos WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  const [rows] = await pool.execute(sql, params);
  return rows[0].total;
}

// ==================== DIVIDENDS ====================

async function getDividendsForAdmin(limit = 20, offset = 0) {
  const sql = `
    SELECT * FROM announced_dividends
    ORDER BY book_close_date DESC, fiscal_year DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);
  return rows;
}

async function getDividendCountForAdmin() {
  const sql = 'SELECT COUNT(*) as total FROM announced_dividends';
  const [rows] = await pool.execute(sql);
  return rows[0].total;
}

// ==================== PRICES ====================

async function getPricesForAdmin(limit = 20, offset = 0, filters = {}) {
  let sql = `
    SELECT 
      sp.*,
      cd.company_name,
      cd.sector_name
    FROM stock_prices sp
    LEFT JOIN company_details cd ON sp.symbol = cd.symbol
    WHERE sp.business_date = (
      SELECT MAX(sp2.business_date) FROM stock_prices sp2 WHERE sp2.symbol = sp.symbol
    )
  `;

  const params = [];

  if (filters.symbol) {
    sql += ' AND sp.symbol LIKE ?';
    params.push(`%${filters.symbol}%`);
  }

  sql += ' ORDER BY sp.symbol LIMIT ? OFFSET ?';
  params.push(String(limit), String(offset));

  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ==================== API KEYS ====================

async function getAllApiKeys() {
  const sql = `
    SELECT 
      id,
      name,
      api_key,
      status,
      created_at,
      last_used_at
    FROM api_keys
    ORDER BY created_at DESC
  `;

  const [rows] = await pool.execute(sql);
  return rows;
}

async function createApiKey(name) {
  const crypto = require('crypto');
  const apiKey = 'npt_' + crypto.randomBytes(32).toString('hex');

  const sql = `
    INSERT INTO api_keys (name, api_key, status)
    VALUES (?, ?, 'active')
  `;

  const [result] = await pool.execute(sql, [name, apiKey]);

  return {
    id: result.insertId,
    name,
    api_key: apiKey,
    status: 'active',
    created_at: new Date()
  };
}

async function deleteApiKey(id) {
  const sql = 'DELETE FROM api_keys WHERE id = ?';
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  // Companies
  getCompaniesForAdmin,
  getCompanyCountForAdmin,

  // IPOs
  getIposForAdmin,
  getIpoCountForAdmin,

  // Dividends
  getDividendsForAdmin,
  getDividendCountForAdmin,

  // Prices
  getPricesForAdmin,

  // API Keys
  getAllApiKeys,
  createApiKey,
  deleteApiKey,
};
