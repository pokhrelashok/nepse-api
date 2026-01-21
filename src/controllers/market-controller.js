const {
  getLatestPrices,
  getLatestPricesWithMutualFunds,
  getCurrentMarketStatus,
  updateMarketStatus,
  saveMarketIndex,
  getMarketIndexData,
  getLatestMarketIndexData,
  getMarketIndicesHistory,
  getCompanyStats,
  getRecentBonusForSymbols,
  getRecentMergersForSymbols,
  getSectorBreakdown
} = require('../database/queries');
const { NepseScraper } = require('../scrapers/nepse-scraper');
const { formatResponse, formatError } = require('../utils/formatter');
const logger = require('../utils/logger');
const { DateTime } = require('luxon');

// Helper to get Nepal date string (UTC+5:45) with optional day offset
const getNepalDateString = (offsetDays = 0) => {
  let dt = DateTime.now().setZone('Asia/Kathmandu');
  if (offsetDays !== 0) {
    dt = dt.plus({ days: offsetDays });
  }
  return dt.toISODate();
};

// Helper to calculate start date based on range
const getStartDateFromRange = (range) => {
  const now = DateTime.now().setZone('Asia/Kathmandu');
  let dt = now;

  switch (range) {
    case '1W':
      dt = now.minus({ days: 7 });
      break;
    case '1M':
      dt = now.minus({ months: 1 });
      break;
    case '3M':
      dt = now.minus({ months: 3 });
      break;
    case '6M':
      dt = now.minus({ months: 6 });
      break;
    case '1Y':
      dt = now.minus({ years: 1 });
      break;
    case 'ALL':
      return null;
    default:
      dt = now.minus({ years: 1 });
  }

  return dt.toISODate();
};

exports.getMarketStatus = async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';

    if (refresh) {
      // Get live status and index data from scraper
      const scraper = new NepseScraper();
      try {
        const status = await scraper.scrapeMarketStatus();
        const isOpen = status === 'OPEN' || status === 'PRE_OPEN';
        const indexData = await scraper.scrapeMarketIndex();

        await updateMarketStatus(status);
        await saveMarketIndex(indexData, status); // Pass the actual status (OPEN, PRE_OPEN, or CLOSED)

        res.json(formatResponse({
          is_open: isOpen,
          status,
          market_index: {
            nepse_index: indexData.nepseIndex,
            change: indexData.indexChange,
            percentage_change: indexData.indexPercentageChange,
            total_turnover: indexData.totalTurnover,
            total_traded_shares: indexData.totalTradedShares,
            advanced: indexData.advanced,
            declined: indexData.declined,
            unchanged: indexData.unchanged,
            status_date: indexData.marketStatusDate,
            status_time: indexData.marketStatusTime
          },
          source: 'LIVE_SCRAPER',
          last_updated: new Date().toISOString()
        }));

      } finally {
        await scraper.close();
      }
    } else {
      // Get cached status from database
      const marketStatus = await getCurrentMarketStatus();
      const marketIndex = await getMarketIndexData();

      const response = {
        is_open: marketStatus?.isOpen || false,
        status: marketStatus?.status || 'CLOSED',
        source: 'DATABASE_CACHE',
        last_updated: marketStatus?.lastUpdated || new Date().toISOString(),
        trading_date: marketStatus?.trading_date || null
      };


      // Add market index data if available
      if (marketIndex) {
        response.market_index = {
          nepse_index: marketIndex.nepse_index,
          change: marketIndex.index_change,
          percentage_change: marketIndex.index_percentage_change,
          total_turnover: marketIndex.total_turnover,
          total_traded_shares: marketIndex.total_traded_shares,
          advanced: marketIndex.advanced,
          declined: marketIndex.declined,
          unchanged: marketIndex.unchanged,
          status_date: marketIndex.market_status_date,
          status_time: marketIndex.market_status_time
        };
      }


      if (marketStatus || marketIndex) {
        res.json(formatResponse(response));
      } else {
        // No cached data, get live status
        return res.redirect('/api/market/status?refresh=true');
      }
    }
  } catch (error) {
    logger.error('API Market Status Error:', error);
    res.status(500).json(formatError('Failed to get market status'));
  }
};

exports.getUpdates = async (req, res) => {
  try {
    const { symbols } = req.body;

    // Get stock prices and mutual fund data in a single optimized query
    let stocks = [];
    let mutualFunds = [];
    let recentBonus = {};
    let recentMergers = {};

    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      // Use optimized function that fetches both stocks and mutual funds in one query
      const result = await getLatestPricesWithMutualFunds(symbols);
      stocks = result.stocks;
      mutualFunds = result.mutualFunds;

      recentBonus = await getRecentBonusForSymbols(symbols);
      recentMergers = await getRecentMergersForSymbols(symbols);
    }

    // Get market status and index data
    const marketStatus = await getCurrentMarketStatus();
    const primaryTradingDate = marketStatus?.tradingDate || getNepalDateString();

    // Try to fetch today's market index; if missing, fall back to the most recent available
    let marketIndex = await getMarketIndexData(primaryTradingDate);
    let marketIndexSource = 'DATABASE_CACHE';

    if (!marketIndex) {
      // Fall back to most recent available market index data
      marketIndex = await getLatestMarketIndexData();
      if (marketIndex) {
        marketIndexSource = 'LAST_AVAILABLE_CACHE';
      }
    }

    const response = {
      is_open: marketStatus?.isOpen || false,
      status: marketStatus?.status || 'CLOSED',
      source: 'DATABASE_CACHE',
      last_updated: marketStatus?.lastUpdated || new Date().toISOString(),
      trading_date: marketStatus?.trading_date || null,
      stocks: stocks,
      recent_bonus: recentBonus,
      recent_mergers: recentMergers,
      mutual_funds: mutualFunds
    };


    // Add market index data if available
    if (marketIndex) {
      response.market_index = {
        nepse_index: marketIndex.nepse_index,
        change: marketIndex.index_change,
        percentage_change: marketIndex.index_percentage_change,
        total_turnover: marketIndex.total_turnover,
        total_traded_shares: marketIndex.total_traded_shares,
        advanced: marketIndex.advanced,
        declined: marketIndex.declined,
        unchanged: marketIndex.unchanged,
        status_date: marketIndex.market_status_date,
        status_time: marketIndex.market_status_time,
        trading_date: marketIndex.trading_date,
        source: marketIndexSource
      };
    }


    res.json(formatResponse(response));
  } catch (e) {
    console.error('API Updates Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getMarketStats = async (req, res) => {
  try {
    const stats = await getCompanyStats();

    // Fetch top 10 gainers
    const gainers = await getLatestPrices(null, {
      limit: 10,
      sortBy: 'percentage_change',
      order: 'DESC',
      filter: 'gainers'
    });

    // Fetch top 10 losers
    const losers = await getLatestPrices(null, {
      limit: 10,
      sortBy: 'percentage_change',
      order: 'ASC',
      filter: 'losers'
    });

    // Fetch top 10 turnover (most active by value)
    const topTurnover = await getLatestPrices(null, {
      limit: 10,
      sortBy: 'total_traded_value',
      order: 'DESC'
    });

    // Fetch top 10 volume (most active by shares traded)
    const topVolume = await getLatestPrices(null, {
      limit: 10,
      sortBy: 'total_traded_quantity',
      order: 'DESC'
    });

    res.json(formatResponse({
      stats,
      gainers,
      losers,
      top_turnover: topTurnover,
      top_volume: topVolume
    }));

  } catch (e) {
    logger.error('API Stats Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getMarketSummary = async (req, res) => {
  try {
    const stats = await getCompanyStats();
    const recentPrices = await getLatestPrices(null, { limit: 10 });

    // Calculate market summary
    const totalVolume = recentPrices.reduce((sum, stock) => sum + (stock.total_traded_quantity || 0), 0);
    const totalTurnover = recentPrices.reduce((sum, stock) => sum + (stock.total_traded_value || 0), 0);
    const gainers = recentPrices.filter(s => (s.change || 0) > 0).length;
    const losers = recentPrices.filter(s => (s.change || 0) < 0).length;
    const unchanged = recentPrices.filter(s => (s.change || 0) === 0).length;

    res.json(formatResponse({
      ...stats,
      marketMetrics: {
        totalVolume,
        totalTurnover,
        gainers,
        losers,
        unchanged,
        totalStocks: recentPrices.length
      },
      timestamp: new Date().toISOString()
    }));

  } catch (e) {
    console.error('API Market Summary Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getTodayPrices = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'symbol';
    const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
    const search = req.query.search || null;

    const prices = await getLatestPrices(null, { limit, offset, sortBy, order, search });

    // Format percentage_change to 2 decimal places
    const formattedPrices = prices.map(p => ({
      ...p,
      percentage_change: p.percentage_change != null ? Math.round(p.percentage_change * 100) / 100 : 0
    }));

    res.json(formatResponse({
      data: formattedPrices,
      pagination: {
        limit,
        offset,
        total: formattedPrices.length
      }
    }));
  } catch (e) {
    console.error('API Today Prices Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getGainers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const gainers = await getLatestPrices(null, {
      limit,
      sortBy: 'percentage_change',
      order: 'DESC',
      filter: 'gainers'
    });
    res.json(formatResponse(gainers));
  } catch (e) {
    console.error('API Gainers Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getLosers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const losers = await getLatestPrices(null, {
      limit,
      sortBy: 'percentage_change',
      order: 'ASC',
      filter: 'losers'
    });
    res.json(formatResponse(losers));
  } catch (e) {
    console.error('API Losers Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getMarketIndicesHistory = async (req, res) => {
  try {
    const range = req.query.range || '1M';
    const indexId = req.query.index_id || 58; // Default to NEPSE Index
    const limit = parseInt(req.query.limit) || 1000;

    const startDate = getStartDateFromRange(range);

    const history = await getMarketIndicesHistory({
      indexId,
      startDate,
      limit
    });

    res.json(formatResponse(history));
  } catch (e) {
    console.error('API Market Indices History Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getIntradayPrices = async (req, res) => {
  try {
    const { getIntradayMarketIndex } = require('../database/queries');
    const date = req.query.date || null; // Optional date parameter

    const snapshots = await getIntradayMarketIndex(date);

    res.json(formatResponse({
      date: date || new Date().toISOString().split('T')[0],
      snapshots,
      count: snapshots.length
    }));
  } catch (e) {
    logger.error('API Intraday Prices Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

/**
 * Get sector-wise market breakdown
 * @route GET /api/market/sectors
 * @query sortBy - Sort field: market_cap, company_count, avg_change, sector_change
 * @query order - Sort order: asc, desc
 * @query includeInactive - Include inactive companies: true, false
 */
exports.getSectorBreakdown = async (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'market_cap';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const includeInactive = req.query.includeInactive === 'true';

    const sectors = await getSectorBreakdown({ sortBy, order, includeInactive });

    res.json(formatResponse({
      sectors,
      count: sectors.length,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    logger.error('API Sector Breakdown Error:', e);
    res.status(500).json(formatError('Internal Server Error'));
  }
};