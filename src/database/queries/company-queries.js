const { pool, saveCompanyDetails, saveFinancials } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { formatCompanyDetailsForDatabase, formatFinancialsForDatabase } = require('../../utils/formatter');

async function getAllCompanies() {
  const sql = `
    SELECT 
      cd.symbol,
      cd.company_name AS name,
      cd.nepali_company_name,
      cd.logo_url AS logo,
      cd.sector_name AS sector,
      cd.nepali_sector_name,
      cd.last_traded_price, 
      cd.status,
      cd.pe_ratio,
      cd.pb_ratio,
      cd.eps,
      cd.dividend_yield,
      cd.market_capitalization,
      cd.close_price,
      cd.previous_close
    FROM company_details cd
    ORDER BY cd.company_name
  `;

  const [rows] = await pool.execute(sql);

  // Try to merge with live price changes from Redis
  try {
    const livePrices = await redis.hgetall('live:stock_prices');
    if (livePrices) {
      return rows.map(r => {
        const live = livePrices[r.symbol] ? JSON.parse(livePrices[r.symbol]) : null;

        // Use live price if available, otherwise fall back to database
        let ltp = live && live.close_price ? parseFloat(live.close_price) : null;
        if (!ltp && (r.close_price || r.last_traded_price)) {
          ltp = parseFloat(r.close_price || r.last_traded_price);
        }

        // Calculate changes - potentially using DB data if live is missing
        let priceChange = live ? parseFloat(live.change) : 0;
        let percentageChange = 0;

        if (live && live.percentage_change) {
          percentageChange = parseFloat(live.percentage_change);
        } else if (ltp && r.previous_close) {
          // Calculate percentage change from current price and previous close
          priceChange = ltp - parseFloat(r.previous_close);
          percentageChange = (priceChange / parseFloat(r.previous_close)) * 100;
        }

        return {
          ...r,
          todays_change: Math.round(percentageChange * 100) / 100,
          price_change: Math.round(priceChange * 100) / 100,
          ltp: ltp ? Math.round(ltp * 100) / 100 : null
        };
      });
    }
  } catch (error) {
    logger.error('❌ Redis error in getAllCompanies:', error);
  }

  // Fallback when Redis is not available
  return rows.map(r => {
    const ltp = parseFloat(r.close_price || r.last_traded_price) || null;
    const previousClose = parseFloat(r.previous_close) || null;

    let priceChange = 0;
    let percentageChange = 0;

    if (ltp && previousClose) {
      priceChange = ltp - previousClose;
      percentageChange = (priceChange / previousClose) * 100;
    }

    return {
      ...r,
      todays_change: Math.round(percentageChange * 100) / 100,
      price_change: Math.round(priceChange * 100) / 100,
      ltp: ltp ? Math.round(ltp * 100) / 100 : null
    };
  });
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
      COUNT(CASE WHEN status = 'A' THEN 1 END) as active_companies,
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

function insertCompanyDetails(details) {
  const formatted = formatCompanyDetailsForDatabase(details);
  return saveCompanyDetails(formatted);
}

function insertFinancials(financials) {
  const formatted = formatFinancialsForDatabase(financials);
  return saveFinancials(formatted);
}

module.exports = {
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getCompanyStats,
  insertCompanyDetails,
  insertFinancials
};
