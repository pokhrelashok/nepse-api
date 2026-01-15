const { pool } = require('../database');
const logger = require('../../utils/logger');

/**
 * Insert or update merger/acquisition data
 */
async function insertMergers(mergerData) {
  const sql = `
    INSERT INTO merger_acquisitions (
      merger_acquisition_id, sector_id, sector_name, nepali_sector_name,
      new_company_name, nepali_new_company_name, new_company_stock_symbol,
      companies, swap_ratio, mou_date_ad, mou_date_bs, final_approval_date_ad, final_approval_date_bs,
      joint_date_ad, joint_date_bs, action, is_completed, is_trading
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      sector_name = VALUES(sector_name),
      nepali_sector_name = VALUES(nepali_sector_name),
      new_company_name = VALUES(new_company_name),
      nepali_new_company_name = VALUES(nepali_new_company_name),
      new_company_stock_symbol = VALUES(new_company_stock_symbol),
      companies = VALUES(companies),
      swap_ratio = VALUES(swap_ratio),
      mou_date_ad = VALUES(mou_date_ad),
      mou_date_bs = VALUES(mou_date_bs),
      final_approval_date_ad = VALUES(final_approval_date_ad),
      final_approval_date_bs = VALUES(final_approval_date_bs),
      joint_date_ad = VALUES(joint_date_ad),
      joint_date_bs = VALUES(joint_date_bs),
      action = VALUES(action),
      is_completed = VALUES(is_completed),
      is_trading = VALUES(is_trading),
      updated_at = CURRENT_TIMESTAMP
  `;

  const values = [
    mergerData.merger_acquisition_id,
    mergerData.sector_id,
    mergerData.sector_name,
    mergerData.nepali_sector_name,
    mergerData.new_company_name,
    mergerData.nepali_new_company_name,
    mergerData.new_company_stock_symbol,
    mergerData.companies,
    mergerData.swap_ratio,
    mergerData.mou_date_ad,
    mergerData.mou_date_bs,
    mergerData.final_approval_date_ad,
    mergerData.final_approval_date_bs,
    mergerData.joint_date_ad,
    mergerData.joint_date_bs,
    mergerData.action,
    mergerData.is_completed,
    mergerData.is_trading
  ];

  try {
    const [result] = await pool.execute(sql, values);
    return result;
  } catch (error) {
    logger.error('Error inserting merger data:', error);
    throw error;
  }
}

/**
 * Get recent mergers for the specified symbols
 * Returns mergers where one of the involved companies matches the requested symbol
 * and joint_date_ad is before or on today
 */
async function getRecentMergersForSymbols(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const sqlWithSymbols = `
    SELECT 
      id, merger_acquisition_id, sector_id, sector_name, nepali_sector_name,
      new_company_name, nepali_new_company_name, new_company_stock_symbol,
      companies, swap_ratio, 
      DATE_FORMAT(mou_date_ad, '%Y-%m-%d') as mou_date_ad,
      mou_date_bs, 
      DATE_FORMAT(final_approval_date_ad, '%Y-%m-%d') as final_approval_date_ad,
      final_approval_date_bs,
      DATE_FORMAT(joint_date_ad, '%Y-%m-%d') as joint_date_ad,
      joint_date_bs, action, is_completed, is_trading,
      DATE_FORMAT(updated_at, '%Y-%m-%d') as updated_at
    FROM merger_acquisitions 
    WHERE joint_date_ad IS NOT NULL AND joint_date_ad <= CURDATE()
    ORDER BY updated_at DESC
  `;

  try {
    const [rows] = await pool.execute(sqlWithSymbols);

    // Filter rows where any symbol in companies array matches
    // Exclude if user holds the merged company (new_company_stock_symbol)
    const filteredRows = rows.filter(row => {
      try {
        // MySQL JSON columns are returned as objects/arrays, not strings
        const companies = Array.isArray(row.companies) ? row.companies : JSON.parse(row.companies || '[]');
        return companies.some(c => symbols.includes(c.symbol));
      } catch (e) {
        return false;
      }
    });

    // Create a map indexed by symbol
    const mergerMap = {};
    for (const row of filteredRows) {
      const matchingSymbols = new Set();

      try {
        const companies = Array.isArray(row.companies) ? row.companies : JSON.parse(row.companies || '[]');
        companies.forEach(c => {
          if (symbols.includes(c.symbol) && c.symbol !== row.new_company_stock_symbol) {
            matchingSymbols.add(c.symbol);
          }
        });
      } catch (e) {
        // Continue if JSON parsing fails
      }

      for (const symbol of matchingSymbols) {
        if (!mergerMap[symbol]) {
          mergerMap[symbol] = [];
        }
        // Parse companies JSON for response
        const companies = Array.isArray(row.companies) ? row.companies : JSON.parse(row.companies || '[]');
        const mergerWithParsedCompanies = {
          ...row,
          companies: companies
        };
        mergerMap[symbol].push(mergerWithParsedCompanies);
      }
    }

    return mergerMap;
  } catch (error) {
    logger.error('Error fetching recent mergers:', error);
    return {};
  }
}

/**
 * Get all mergers for admin dashboard
 */
async function getAllMergersForAdmin(limit = 20, offset = 0) {
  const sql = `
    SELECT 
      id, merger_acquisition_id, sector_name, nepali_sector_name,
      new_company_name, nepali_new_company_name, new_company_stock_symbol,
      companies, action, is_completed, is_trading,
      DATE_FORMAT(final_approval_date_ad, '%Y-%m-%d') as final_approval_date_ad,
      DATE_FORMAT(joint_date_ad, '%Y-%m-%d') as joint_date_ad,
      DATE_FORMAT(updated_at, '%Y-%m-%d') as updated_at
    FROM merger_acquisitions 
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const [rows] = await pool.execute(sql, [String(limit), String(offset)]);
    // Parse companies JSON in response (MySQL JSON columns return as objects)
    return rows.map(row => ({
      ...row,
      companies: Array.isArray(row.companies) ? row.companies : (row.companies ? JSON.parse(row.companies) : [])
    }));
  } catch (error) {
    logger.error('Error fetching mergers for admin:', error);
    return [];
  }
}

/**
 * Get total count of mergers
 */
async function getMergerCount() {
  const sql = 'SELECT COUNT(*) as count FROM merger_acquisitions';

  try {
    const [rows] = await pool.execute(sql);
    return rows[0]?.count || 0;
  } catch (error) {
    logger.error('Error fetching merger count:', error);
    return 0;
  }
}

module.exports = {
  insertMergers,
  getRecentMergersForSymbols,
  getAllMergersForAdmin,
  getMergerCount
};
