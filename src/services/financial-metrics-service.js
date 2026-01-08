/**
 * Financial Metrics Service
 * Handles calculation and updating of financial metrics for companies
 */

const { pool } = require('../database/database');
const { calculateAllMetrics, roundMetrics } = require('../utils/financial-calculations');
const logger = require('../utils/logger');

/**
 * Update financial metrics for a single company
 * @param {number} securityId - Security ID
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object|null>} Updated metrics or null if failed
 */
async function updateMetricsForCompany(securityId, symbol) {
  try {
    // Get company details (price, shares)
    const [companyRows] = await pool.execute(
      'SELECT last_traded_price, total_listed_shares FROM company_details WHERE security_id = ?',
      [securityId]
    );

    if (companyRows.length === 0) {
      logger.warn(`Company ${symbol} not found`);
      return null;
    }

    const companyData = companyRows[0];

    // Get latest financial data
    const [financialRows] = await pool.execute(
      `SELECT earnings_per_share, net_worth_per_share 
       FROM company_financials 
       WHERE security_id = ? 
       ORDER BY fiscal_year DESC, quarter DESC 
       LIMIT 1`,
      [securityId]
    );

    const latestFinancial = financialRows.length > 0 ? financialRows[0] : null;

    // Get latest dividend data
    const [dividendRows] = await pool.execute(
      `SELECT total_dividend 
       FROM dividends 
       WHERE security_id = ? 
       ORDER BY fiscal_year DESC 
       LIMIT 1`,
      [securityId]
    );

    const latestDividend = dividendRows.length > 0 ? dividendRows[0] : null;

    // Calculate metrics
    const rawMetrics = calculateAllMetrics(companyData, latestFinancial, latestDividend);
    const metrics = roundMetrics(rawMetrics);

    // Update database
    await pool.execute(
      `UPDATE company_details 
       SET market_capitalization = ?, 
           pe_ratio = ?, 
           pb_ratio = ?, 
           dividend_yield = ?,
           eps = ?,
           metrics_updated_at = NOW()
       WHERE security_id = ?`,
      [
        metrics.market_capitalization,
        metrics.pe_ratio,
        metrics.pb_ratio,
        metrics.dividend_yield,
        metrics.eps,
        securityId
      ]
    );

    logger.info(`✅ Updated metrics for ${symbol}: PE=${metrics.pe_ratio}, PB=${metrics.pb_ratio}, EPS=${metrics.eps}, DivYield=${metrics.dividend_yield}%, MCap=${metrics.market_capitalization}`);
    return metrics;
  } catch (error) {
    logger.error(`Failed to update metrics for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Update metrics for all active companies
 * @returns {Promise<Object>} Summary of updates
 */
async function updateMetricsForAll() {
  try {
    // Get all companies with price data (status might be NULL)
    const [companies] = await pool.execute(
      `SELECT security_id, symbol 
       FROM company_details 
       WHERE last_traded_price > 0
       ORDER BY symbol`
    );

    logger.info(`📊 Updating metrics for ${companies.length} companies...`);

    let successCount = 0;
    let failCount = 0;

    for (const company of companies) {
      const result = await updateMetricsForCompany(company.security_id, company.symbol);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
    }

    const summary = {
      total: companies.length,
      success: successCount,
      failed: failCount
    };

    logger.info(`✅ Metrics update complete: ${successCount} success, ${failCount} failed`);
    return summary;
  } catch (error) {
    logger.error('Failed to update metrics for all companies:', error);
    throw error;
  }
}

/**
 * Calculate metrics for a company after scraping (without saving to DB)
 * This is used right after fetching company details, dividends, and financials
 * @param {Object} companyData - Company details
 * @param {Array} financials - Array of financial records
 * @param {Array} dividends - Array of dividend records
 * @returns {Object} Calculated metrics to be saved with company details
 */
function calculateMetricsAfterScrape(companyData, financials = [], dividends = []) {
  const latestFinancial = financials && financials.length > 0 ? financials[0] : null;
  const latestDividend = dividends && dividends.length > 0 ? dividends[0] : null;

  const rawMetrics = calculateAllMetrics(companyData, latestFinancial, latestDividend);
  return roundMetrics(rawMetrics);
}

module.exports = {
  updateMetricsForCompany,
  updateMetricsForAll,
  calculateMetricsAfterScrape
};
