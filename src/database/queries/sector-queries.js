const { pool } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');

/**
 * Get sector-wise market breakdown with aggregated statistics
 * @param {Object} options - Query options
 * @param {string} options.sortBy - Sort field: 'market_cap', 'company_count', 'avg_change', 'sector_change'
 * @param {string} options.order - Sort order: 'ASC' or 'DESC'
 * @param {boolean} options.includeInactive - Include inactive companies
 * @returns {Promise<Array>} Array of sector statistics
 */
async function getSectorBreakdown(options = {}) {
  const { sortBy = 'market_cap', order = 'DESC', includeInactive = false } = options;

  try {
    // Get all companies with sector info
    let sql = `
      SELECT 
        sector_name,
        nepali_sector_name,
        symbol,
        company_name,
        market_capitalization,
        status
      FROM company_details
      WHERE sector_name IS NOT NULL
    `;

    if (!includeInactive) {
      sql += ` AND status = 'Active'`;
    }

    const [companies] = await pool.execute(sql);

    if (companies.length === 0) {
      return [];
    }

    // Get live prices from Redis
    let livePrices = {};
    try {
      const redisPrices = await redis.hgetall('live:stock_prices');
      if (redisPrices && Object.keys(redisPrices).length > 0) {
        livePrices = Object.keys(redisPrices).reduce((acc, symbol) => {
          acc[symbol] = JSON.parse(redisPrices[symbol]);
          return acc;
        }, {});
      }
    } catch (error) {
      logger.error('❌ Redis error in getSectorBreakdown:', error);
      // Continue with empty livePrices
    }

    // Group by sector and aggregate
    const sectorMap = new Map();

    companies.forEach(company => {
      const sector = company.sector_name;
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, {
          sector_name: sector,
          nepali_sector_name: company.nepali_sector_name,
          companies: [],
          total_market_cap: 0,
          total_volume: 0,
          total_turnover: 0,
          gainers: 0,
          losers: 0,
          unchanged: 0
        });
      }

      const sectorData = sectorMap.get(sector);
      const livePrice = livePrices[company.symbol];

      const companyData = {
        symbol: company.symbol,
        company_name: company.company_name,
        market_capitalization: company.market_capitalization || 0,
        price_change: livePrice?.percentage_change || 0,
        volume: livePrice?.total_traded_quantity || 0,
        turnover: livePrice?.total_traded_value || 0
      };

      sectorData.companies.push(companyData);
      sectorData.total_market_cap += companyData.market_capitalization;
      sectorData.total_volume += companyData.volume;
      sectorData.total_turnover += companyData.turnover;

      // Count gainers/losers/unchanged
      if (livePrice) {
        const change = livePrice.change || 0;
        if (change > 0) sectorData.gainers++;
        else if (change < 0) sectorData.losers++;
        else sectorData.unchanged++;
      }
    });

    // Convert to array and calculate averages
    const sectors = Array.from(sectorMap.values()).map(sector => {
      const totalMarketCap = sector.total_market_cap;
      const companyCount = sector.companies.length;

      // Calculate simple average price change
      const avgPriceChange = companyCount > 0
        ? sector.companies.reduce((sum, c) => sum + c.price_change, 0) / companyCount
        : 0;

      // Calculate market-cap weighted percentage change
      const sectorPercentageChange = totalMarketCap > 0
        ? sector.companies.reduce((sum, c) => {
          const weight = c.market_capitalization / totalMarketCap;
          return sum + (c.price_change * weight);
        }, 0)
        : 0;

      // Get top 3 companies by market cap
      const topCompanies = sector.companies
        .sort((a, b) => b.market_capitalization - a.market_capitalization)
        .slice(0, 3)
        .map(c => ({
          symbol: c.symbol,
          name: c.company_name,
          market_cap: c.market_capitalization
        }));

      return {
        sector_name: sector.sector_name,
        nepali_sector_name: sector.nepali_sector_name,
        company_count: companyCount,
        total_market_cap: totalMarketCap,
        avg_price_change: Math.round(avgPriceChange * 100) / 100,
        sector_percentage_change: Math.round(sectorPercentageChange * 100) / 100,
        total_volume: sector.total_volume,
        total_turnover: sector.total_turnover,
        gainers: sector.gainers,
        losers: sector.losers,
        unchanged: sector.unchanged,
        top_companies: topCompanies
      };
    });

    // Sort based on options
    const sortField = sortBy === 'market_cap' ? 'total_market_cap' :
      sortBy === 'sector_change' ? 'sector_percentage_change' :
        sortBy === 'avg_change' ? 'avg_price_change' : sortBy;

    sectors.sort((a, b) => {
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      return order.toUpperCase() === 'DESC' ? valB - valA : valA - valB;
    });

    return sectors;
  } catch (error) {
    logger.error('❌ Error in getSectorBreakdown:', error);
    throw error;
  }
}

module.exports = {
  getSectorBreakdown
};
