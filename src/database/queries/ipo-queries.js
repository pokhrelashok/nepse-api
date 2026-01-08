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

async function getIpos(limit = 100, offset = 0, startDate = null, endDate = null, offeringType = null) {
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
      offering_type,
      price_per_unit,
      rating,
      units,
      min_units,
      max_units,
      total_amount,
      DATE_FORMAT(opening_date, '%Y-%m-%d') as opening_date,
      DATE_FORMAT(closing_date, '%Y-%m-%d') as closing_date,
      status
    FROM ipos
    WHERE 1 = 1
      `;

  const params = [];

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

module.exports = {
  insertIpo,
  getIpos
};
