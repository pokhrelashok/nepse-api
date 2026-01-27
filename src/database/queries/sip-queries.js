const { pool } = require('../database');

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
