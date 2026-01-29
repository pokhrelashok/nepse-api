const { pool } = require('../database');
const { normalizeShareType, formatShareType } = require('../../utils/share-type-utils');

// IPO functions
async function insertIpo(ipoData) {
  const sql = `
    INSERT INTO ipos(
        ipo_id, company_name, nepali_company_name, symbol, share_registrar,
        sector_name, nepali_sector_name, share_type, offering_type, price_per_unit, rating,
        units, min_units, max_units, total_amount, opening_date, closing_date, status
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    company_name = VALUES(company_name),
      nepali_company_name = COALESCE(VALUES(nepali_company_name), nepali_company_name),
      symbol = VALUES(symbol),
      share_registrar = VALUES(share_registrar),
      sector_name = VALUES(sector_name),
      nepali_sector_name = COALESCE(VALUES(nepali_sector_name), nepali_sector_name),
      share_type = VALUES(share_type),
      offering_type = VALUES(offering_type),
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
    shareType, offeringType, pricePerUnit, rating, units, minUnits, maxUnits,
    totalAmount, openingDateAD, closingDateAD, status
  } = ipoData;

  // Normalize share_type to lowercase_underscore format for storage
  const normalizedShareType = normalizeShareType(shareType);
  const finalOfferingType = (offeringType || 'ipo').toLowerCase();

  const [result] = await pool.execute(sql, [
    ipoId, companyName, nepaliCompanyName || null, stockSymbol, shareRegistrar,
    sectorName, nepaliSectorName || null, normalizedShareType, finalOfferingType, pricePerUnit, rating,
    units, minUnits, maxUnits, totalAmount, openingDateAD, closingDateAD, status
  ]);
  return result;
}

async function getIpos(arg1 = 100, arg2 = 0, arg3 = null, arg4 = null, arg5 = null) {
  let limit = 100;
  let offset = 0;
  let startDate = null;
  let endDate = null;
  let offeringType = null;
  let id = null;

  if (typeof arg1 === 'object' && arg1 !== null) {
    const options = arg1;
    limit = options.limit || 100;
    offset = options.offset || 0;
    startDate = options.startDate || null;
    endDate = options.endDate || null;
    offeringType = options.offeringType || null;
    id = options.id || null;
  } else {
    limit = arg1;
    offset = arg2;
    startDate = arg3;
    endDate = arg4;
    offeringType = arg5;
  }

  let sql = `
    SELECT
      id,
      ipo_id,
      company_name,
      nepali_company_name,
      symbol,
      share_registrar,
      sector_name,
      nepali_sector_name,
      share_type,
      offering_type,
      price_per_unit,
      rating,
      units,
      min_units,
      max_units,
      total_amount,
      DATE_FORMAT(opening_date, '%Y-%m-%d') as opening_date,
      DATE_FORMAT(closing_date, '%Y-%m-%d') as closing_date,
      status,
      published_in
    FROM ipos
    WHERE 1 = 1
  `;

  const params = [];

  if (id) {
    sql += ` AND id = ? `;
    params.push(id);
  }

  if (startDate) {
    sql += ` AND opening_date >= ? `;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND opening_date <= ? `;
    params.push(endDate);
  }

  if (offeringType) {
    sql += ` AND offering_type = ? `;
    params.push(offeringType);
  }

  sql += ` ORDER BY opening_date DESC LIMIT ? OFFSET ? `;
  params.push(String(limit), String(offset));

  const [rows] = await pool.execute(sql, params);

  // Format share_type for display
  return rows.map(row => ({
    ...row,
    share_type: formatShareType(row.share_type)
  }));
}

/**
 * Update IPO published_in status
 * @param {number} ipoId - IPO ID
 * @param {string} publishedIn - Provider ID (e.g., 'nabil-invest')
 * @returns {Promise} - Update result
 */
async function updateIpoPublishedStatus(ipoId, publishedIn) {
  const sql = `
    UPDATE ipos 
    SET published_in = ?, 
        status = 'Published',
        updated_at = NOW()
    WHERE ipo_id = ?
  `;

  const [result] = await pool.execute(sql, [publishedIn, ipoId]);
  return result;
}

/**
 * Get IPOs without published results (for scheduler)
 * @returns {Promise<Array>} - Array of unpublished IPOs
 */
async function getUnpublishedIpos() {
  const sql = `
    SELECT 
      ipo_id,
      company_name,
      share_type,
      symbol,
      status,
      closing_date
    FROM ipos
    WHERE published_in IS NULL
      AND status != 'cancelled'
      AND closing_date < NOW()
    ORDER BY closing_date DESC
  `;

  const [rows] = await pool.execute(sql);
  return rows;
}

/**
 * Find IPO by company name and share type with fuzzy matching
 * @param {string} companyName - Normalized company name
 * @param {string} shareType - Normalized share type
 * @returns {Promise<Object|null>} - Matching IPO or null
 */
async function findIpoByCompanyAndShareType(companyName, shareType) {
  // Normalize company name for matching (remove Ltd/Limited, lowercase)
  const normalizedName = companyName
    .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private)\s*$/i, '')
    .trim()
    .toLowerCase();

  const sql = `
    SELECT 
      ipo_id,
      company_name,
      share_type,
      symbol,
      status,
      published_in,
      DATE_FORMAT(closing_date, '%Y-%m-%d') as closing_date
    FROM ipos
    WHERE LOWER(REPLACE(REPLACE(REPLACE(company_name, ' Ltd.', ''), ' Limited', ''), ' Pvt.', '')) LIKE ?
      AND share_type = ?
      AND published_in IS NULL
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [`%${normalizedName}%`, shareType]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Insert or update IPO result from bank website
 * @param {Object} resultData - Result data (provider_id, company_name, share_type, value)
 * @returns {Promise<Object>} - Status of operation { affectedRows, isNew }
 */
async function insertIpoResult(resultData) {
  const sql = `
    INSERT INTO ipo_results (provider_id, company_name, share_type, value)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      value = VALUES(value),
      updated_at = NOW()
  `;

  const { providerId, companyName, shareType, value } = resultData;
  const [result] = await pool.execute(sql, [providerId, companyName, shareType, value]);

  // affectedRows is 1 for insert, 2 for update in MySQL ON DUPLICATE KEY UPDATE
  return {
    affectedRows: result.affectedRows,
    isNew: result.affectedRows === 1
  };
}

/**
 * Get published IPOs (from ipo_results table)
 * @param {number} limit - Maximum number of results
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} - Array of published IPOs
 */
async function getPublishedIpos(limit = 100, offset = 0) {
  const sql = `
    SELECT 
      id,
      provider_id,
      company_name,
      share_type,
      value,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as published_at
    FROM ipo_results
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(sql, [String(limit), String(offset)]);

  // Format share_type for display
  return rows.map(row => ({
    ...row,
    share_type_display: formatShareType(row.share_type)
  }));
}

/**
 * Find IPO result by raw company name and share type
 * @param {string} companyName - Raw company name from bank
 * @param {string} shareType - Normalized share type
 * @returns {Promise<Object|null>} - Matching result or null
 */
async function findIpoResult(companyName, shareType) {
  const sql = `
    SELECT provider_id, company_name, share_type, value
    FROM ipo_results
    WHERE company_name = ? AND share_type = ?
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [companyName, shareType]);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findIpoByCompanyAndShareType,
  getPublishedIpos,
  insertIpoResult,
  findIpoResult,
  insertIpo,
  getIpos,
  updateIpoPublishedStatus,
  getUnpublishedIpos
};
