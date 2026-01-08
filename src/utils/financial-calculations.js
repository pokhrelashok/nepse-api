/**
 * Financial Calculations Utility
 * Pure functions for calculating stock metrics
 */

/**
 * Calculate Market Capitalization
 * @param {number} price - Current stock price
 * @param {number} totalShares - Total listed shares
 * @returns {number|null} Market cap or null if invalid inputs
 */
function calculateMarketCap(price, totalShares) {
  if (!price || !totalShares || price <= 0 || totalShares <= 0) {
    return null;
  }
  return price * totalShares;
}

/**
 * Calculate Price to Earnings Ratio
 * @param {number} price - Current stock price
 * @param {number} eps - Earnings per share
 * @returns {number|null} PE ratio or null if invalid inputs
 */
function calculatePERatio(price, eps) {
  if (!price || !eps || price <= 0 || eps <= 0) {
    return null;
  }
  return price / eps;
}

/**
 * Calculate Price to Book Ratio
 * @param {number} price - Current stock price
 * @param {number} bookValue - Net worth per share (book value)
 * @returns {number|null} PB ratio or null if invalid inputs
 */
function calculatePBRatio(price, bookValue) {
  if (!price || !bookValue || price <= 0 || bookValue <= 0) {
    return null;
  }
  return price / bookValue;
}

/**
 * Calculate Dividend Yield
 * @param {number} dividend - Total dividend per share
 * @param {number} price - Current stock price
 * @returns {number|null} Dividend yield % or null if invalid inputs
 */
function calculateDividendYield(dividend, price) {
  if (!price || price <= 0) {
    return null;
  }
  if (!dividend || dividend <= 0) {
    return 0; // No dividend = 0% yield (not null)
  }
  return (dividend / price) * 100;
}

/**
 * Calculate all financial metrics for a company
 * @param {Object} companyData - Company details with price and shares
 * @param {Object} latestFinancial - Latest financial data with EPS and book value
 * @param {Object} latestDividend - Latest dividend data
 * @returns {Object} Calculated metrics
 */
function calculateAllMetrics(companyData, latestFinancial = null, latestDividend = null) {
  const price = parseFloat(companyData.last_traded_price || companyData.ltp || 0);
  const totalShares = parseFloat(companyData.total_listed_shares || 0);

  const metrics = {
    market_capitalization: calculateMarketCap(price, totalShares),
    pe_ratio: null,
    pb_ratio: null,
    dividend_yield: null,
    eps: null
  };

  // Calculate PE, PB, and extract EPS if financial data available
  if (latestFinancial) {
    const eps = parseFloat(latestFinancial.earnings_per_share || 0);
    const bookValue = parseFloat(latestFinancial.net_worth_per_share || 0);

    metrics.eps = eps > 0 ? eps : null;
    metrics.pe_ratio = calculatePERatio(price, eps);
    metrics.pb_ratio = calculatePBRatio(price, bookValue);
  }

  // Calculate dividend yield if dividend data available
  if (latestDividend) {
    const dividend = parseFloat(latestDividend.total_dividend || 0);
    metrics.dividend_yield = calculateDividendYield(dividend, price);
  } else {
    // No dividend data = 0% yield
    metrics.dividend_yield = 0;
  }

  return metrics;
}

/**
 * Round metrics to appropriate decimal places
 * @param {Object} metrics - Raw calculated metrics
 * @returns {Object} Rounded metrics
 */
function roundMetrics(metrics) {
  return {
    market_capitalization: metrics.market_capitalization ? Math.round(metrics.market_capitalization * 100) / 100 : null,
    pe_ratio: metrics.pe_ratio ? Math.round(metrics.pe_ratio * 10000) / 10000 : null,
    pb_ratio: metrics.pb_ratio ? Math.round(metrics.pb_ratio * 10000) / 10000 : null,
    dividend_yield: metrics.dividend_yield !== null ? Math.round(metrics.dividend_yield * 10000) / 10000 : null,
    eps: metrics.eps ? Math.round(metrics.eps * 10000) / 10000 : null
  };
}

module.exports = {
  calculateMarketCap,
  calculatePERatio,
  calculatePBRatio,
  calculateDividendYield,
  calculateAllMetrics,
  roundMetrics
};
