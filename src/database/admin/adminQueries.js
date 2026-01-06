const { pool } = require('../database');
const crypto = require('crypto');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { generateUuid } = require('../../utils/uuid');

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
      cd.market_capitalization
    FROM company_details cd
    ORDER BY cd.company_name
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);

  // Try to merge with live price changes from Redis
  try {
    const livePrices = await redis.hgetall('live:stock_prices');
    if (livePrices) {
      return rows.map(r => {
        const live = livePrices[r.symbol] ? JSON.parse(livePrices[r.symbol]) : null;
        return {
          ...r,
          ltp: live ? live.close_price : r.ltp,
          todays_change: live ? live.percentage_change : r.todays_change,
          price_change: live ? live.change : r.price_change,
          source: live ? 'REDIS_LIVE' : 'MYSQL_CACHE'
        };
      });
    }
  } catch (error) {
    logger.error('❌ Redis error in getCompaniesForAdmin:', error);
  }

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
  try {
    const livePricesMap = await redis.hgetall('live:stock_prices');
    if (livePricesMap && Object.keys(livePricesMap).length > 0) {
      let prices = Object.values(livePricesMap).map(p => JSON.parse(p));

      if (filters.symbol) {
        const pattern = filters.symbol.toUpperCase();
        prices = prices.filter(p => p.symbol.includes(pattern));
      }

      const paged = prices.slice(offset, offset + limit);
      const symbols = paged.map(p => p.symbol);

      if (symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        const [meta] = await pool.execute(
          `SELECT symbol, company_name, sector_name FROM company_details WHERE symbol IN (${placeholders})`,
          symbols
        );
        const metaMap = meta.reduce((acc, curr) => ({ ...acc, [curr.symbol]: curr }), {});

        return paged.map(p => ({
          ...p,
          ...metaMap[p.symbol],
          source: 'REDIS_LIVE'
        }));
      }
    }
  } catch (error) {
    logger.error('❌ Redis error in getPricesForAdmin:', error);
  }

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
  const id = generateUuid();
  const apiKey = 'npt_' + crypto.randomBytes(32).toString('hex');

  const sql = `
    INSERT INTO api_keys (id, name, api_key, status)
    VALUES (?, ?, ?, 'active')
  `;

  const [result] = await pool.execute(sql, [id, name, apiKey]);

  return {
    id,
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

// ==================== USERS ====================

async function getUsersForAdmin(limit = 20, offset = 0) {
  const sql = `
    SELECT 
      u.id, u.google_id, u.email, u.display_name, u.avatar_url, u.created_at,
      (SELECT COUNT(*) FROM portfolios WHERE user_id = u.id) as portfolio_count,
      (SELECT COUNT(*) FROM price_alerts WHERE user_id = u.id) as alert_count
    FROM users u
    ORDER BY u.created_at DESC 
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);
  return rows;
}

async function getUserCountForAdmin() {
  const sql = 'SELECT COUNT(*) as total FROM users';
  const [rows] = await pool.execute(sql);
  return rows[0].total;
}

async function getUserStatsForAdmin() {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as users_this_week,
      (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as users_today,
      (SELECT COUNT(*) FROM notification_tokens) as total_active_devices,
      (SELECT COUNT(*) FROM price_alerts WHERE triggered_at >= CURDATE()) as alerts_triggered_today,
      (SELECT COUNT(*) FROM price_alerts WHERE is_active = TRUE) as total_active_alerts
  `;
  const [rows] = await pool.execute(sql);
  return rows[0];
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

  // Users
  getUsersForAdmin,
  getUserCountForAdmin,
  getUserStatsForAdmin
};
