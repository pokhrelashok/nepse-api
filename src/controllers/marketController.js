const {
  getLatestPrices,
  getCurrentMarketStatus,
  updateMarketStatus,
  saveMarketIndex,
  getMarketIndexData,
  getCompanyStats
} = require('../database/queries');
const { NepseScraper } = require('../scrapers/nepse-scraper');
const { formatResponse, formatError } = require('../utils/formatter');
const logger = require('../utils/logger');

// Helper to get Nepal date string (UTC+5:45) with optional day offset
const getNepalDateString = (offsetDays = 0) => {
  const now = new Date();
  const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
  nepaliDate.setDate(nepaliDate.getDate() + offsetDays);
  return nepaliDate.toISOString().split('T')[0];
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
        await saveMarketIndex(indexData);

        res.json(formatResponse({
          isOpen,
          status,
          marketIndex: {
            nepseIndex: indexData.nepseIndex,
            change: indexData.indexChange,
            percentageChange: indexData.indexPercentageChange,
            totalTurnover: indexData.totalTurnover,
            totalTradedShares: indexData.totalTradedShares,
            advanced: indexData.advanced,
            declined: indexData.declined,
            unchanged: indexData.unchanged,
            statusDate: indexData.marketStatusDate,
            statusTime: indexData.marketStatusTime
          },
          source: 'LIVE_SCRAPER',
          lastUpdated: new Date().toISOString()
        }));
      } finally {
        await scraper.close();
      }
    } else {
      // Get cached status from database
      const marketStatus = await getCurrentMarketStatus();
      const marketIndex = await getMarketIndexData();

      const response = {
        isOpen: marketStatus?.isOpen || false,
        status: marketStatus?.isOpen ? 'OPEN' : 'CLOSED',
        source: 'DATABASE_CACHE',
        lastUpdated: marketStatus?.lastUpdated || new Date().toISOString(),
        tradingDate: marketStatus?.tradingDate || null
      };

      // Add market index data if available
      if (marketIndex) {
        response.marketIndex = {
          nepseIndex: marketIndex.nepse_index,
          change: marketIndex.index_change,
          percentageChange: marketIndex.index_percentage_change,
          totalTurnover: marketIndex.total_turnover,
          totalTradedShares: marketIndex.total_traded_shares,
          advanced: marketIndex.advanced,
          declined: marketIndex.declined,
          unchanged: marketIndex.unchanged,
          statusDate: marketIndex.market_status_date,
          statusTime: marketIndex.market_status_time
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
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json(formatError("Invalid body. Expected { symbols: ['SYM', ...] }", 400));
    }

    // Get stock prices
    const stocks = await getLatestPrices(symbols);

    // Get market status and index data
    const marketStatus = await getCurrentMarketStatus();
    const primaryTradingDate = marketStatus?.tradingDate || getNepalDateString();

    // Try to fetch today's market index; if missing, fall back to yesterday
    let marketIndex = await getMarketIndexData(primaryTradingDate);
    let marketIndexSource = 'DATABASE_CACHE';

    if (!marketIndex) {
      const previousTradingDate = getNepalDateString(-1);
      marketIndex = await getMarketIndexData(previousTradingDate);
      if (marketIndex) {
        marketIndexSource = 'YESTERDAY_CACHE';
      }
    }

    const response = {
      isOpen: marketStatus?.isOpen || false,
      status: marketStatus?.isOpen ? 'OPEN' : 'CLOSED',
      source: 'DATABASE_CACHE',
      lastUpdated: marketStatus?.lastUpdated || new Date().toISOString(),
      tradingDate: marketStatus?.tradingDate || null,
      stocks: stocks
    };

    // Add market index data if available
    if (marketIndex) {
      response.marketIndex = {
        nepseIndex: marketIndex.nepse_index,
        change: marketIndex.index_change,
        percentageChange: marketIndex.index_percentage_change,
        totalTurnover: marketIndex.total_turnover,
        totalTradedShares: marketIndex.total_traded_shares,
        advanced: marketIndex.advanced,
        declined: marketIndex.declined,
        unchanged: marketIndex.unchanged,
        statusDate: marketIndex.market_status_date,
        statusTime: marketIndex.market_status_time,
        tradingDate: marketIndex.trading_date,
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
      sortBy: 'turnover',
      order: 'DESC'
    });

    // Fetch top 10 volume (most active by shares traded)
    const topVolume = await getLatestPrices(null, {
      limit: 10,
      sortBy: 'volume',
      order: 'DESC'
    });

    res.json(formatResponse({
      stats,
      gainers,
      losers,
      topTurnover,
      topVolume
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

    const prices = await getLatestPrices(null, { limit, offset, sortBy, order });
    res.json(formatResponse({
      data: prices,
      pagination: {
        limit,
        offset,
        total: prices.length
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
