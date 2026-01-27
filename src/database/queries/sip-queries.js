const { pool } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');

/**
 * Generate a deterministic negative security ID for SIPs based on symbol
 */
function getSipSecurityId(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Ensure negative and within integer range, preventing collision with small negative numbers if any
  return -Math.abs(hash) - 100000;
}

/**
 * Insert or update SIPs
 * @param {Array} sips Array of SIP objects
 */
async function insertSips(sips) {
  if (!sips || sips.length === 0) return 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const query = `
      INSERT INTO sips 
      (symbol, company_name, category, nav, nav_date, authorized_fund_size, net_asset_value, return_since_inception, inception_date, expense_ratio)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      category = VALUES(category),
      nav = VALUES(nav),
      nav_date = VALUES(nav_date),
      authorized_fund_size = VALUES(authorized_fund_size),
      net_asset_value = VALUES(net_asset_value),
      return_since_inception = VALUES(return_since_inception),
      inception_date = VALUES(inception_date),
      expense_ratio = VALUES(expense_ratio),
      updated_at = CURRENT_TIMESTAMP
    `;

    const values = sips.map(sip => [
      sip.symbol,
      sip.company_name,
      sip.category,
      sip.nav,
      sip.nav_date,
      sip.authorized_fund_size,
      sip.net_asset_value,
      sip.return_since_inception,
      sip.inception_date,
      sip.expense_ratio
    ]);

    const [result] = await connection.query(query, [values]);

    // 2. Insert/Update company_details
    const companyDetailsQuery = `
      INSERT INTO company_details 
      (security_id, symbol, company_name, sector_name, status, last_traded_price, close_price, open_price, high_price, low_price, previous_close, total_traded_quantity, total_trades, updated_at)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name),
      last_traded_price = VALUES(last_traded_price),
      close_price = VALUES(close_price),
      updated_at = CURRENT_TIMESTAMP
    `;

    const companyDetailsValues = sips.map(sip => {
      const securityId = getSipSecurityId(sip.symbol);
      return [
        securityId,
        sip.symbol,
        sip.company_name,
        'SIP',
        'A',
        sip.nav || 0,
        sip.nav || 0,
        0, 0, 0, 0, 0, 0, // open, high, low, prev, qty, trades
        new Date()
      ];
    });

    await connection.query(companyDetailsQuery, [companyDetailsValues]);

    // 3. Push to Redis live:stock_prices
    const pipeline = redis.pipeline();
    const now = new Date().toISOString();

    for (const sip of sips) {
      const securityId = getSipSecurityId(sip.symbol);
      const data = {
        security_id: securityId,
        symbol: sip.symbol,
        security_name: sip.company_name,
        company_name: sip.company_name,
        sector_name: 'SIP',
        business_date: sip.nav_date,
        open_price: 0,
        high_price: 0,
        low_price: 0,
        close_price: sip.nav || 0,
        total_traded_quantity: 0,
        total_traded_value: 0,
        previous_close: 0,
        change: 0,
        percentage_change: 0,
        last_updated: now,
        status: 'A',
        is_sip: true
      };
      pipeline.hset('live:stock_prices', sip.symbol, JSON.stringify(data));
    }

    // Also add to active keys list or similar if needed, but live:stock_prices is standard
    await pipeline.exec();
    logger.info(`✅ Synced ${sips.length} SIPs to company_details and Redis`);

    await connection.commit();
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all SIPs
 */
async function getAllSips() {
  const query = `
    SELECT 
      id, symbol, company_name, category, nav, 
      DATE_FORMAT(nav_date, '%Y-%m-%d') as nav_date, 
      authorized_fund_size, net_asset_value, return_since_inception, 
      inception_date, expense_ratio, created_at, updated_at
    FROM sips 
    ORDER BY company_name ASC
  `;
  const [rows] = await pool.query(query);
  return rows;
}

module.exports = {
  insertSips,
  getAllSips
};
