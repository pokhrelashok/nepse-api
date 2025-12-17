require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Scheduler = require('./scheduler');
const {
  searchStocks,
  getScriptDetails,
  getLatestPrices,
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getCompanyStats,
  getCurrentMarketStatus,
  updateMarketStatus,
  getMarketIndexData,
  saveMarketIndex
} = require('./database/queries');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { formatResponse, formatError } = require('./utils/formatter');
const logger = require('./utils/logger');
const { loginHandler, authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize scheduler
const scheduler = new Scheduler();
let isShuttingDown = false;

// Helper to get Nepal date string (UTC+5:45) with optional day offset
const getNepalDateString = (offsetDays = 0) => {
  const now = new Date();
  const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
  nepaliDate.setDate(nepaliDate.getDate() + offsetDays);
  return nepaliDate.toISOString().split('T')[0];
};

// Graceful shutdown handling
const cleanup = async (signal) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down server...`);

  try {
    if (scheduler) {
      await scheduler.stopAllSchedules();
    }
    logger.info('Server shutdown completed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }

  process.exit(0);
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  await cleanup('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  await cleanup('unhandledRejection');
});

const path = require('path');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Serve React App for non-API routes that aren't caught by static files
// This should be placed AFTER API routes, but we need API routes defined first in the code.
// However, express executes sequentially. If we put this at the end of the file, it's safer.
// But we need to remove the existing development block.

// API info route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to NEPSE Portfolio API',
    version: '2.2.0',
    endpoints: {
      updates: '/api/updates',
      market: '/api/market/status',
      companies: '/api/companies',
      search: '/api/search?q=NABIL',
      health: '/api/health'
    },
    documentation: 'https://github.com/pokhrelashok/nepal-stock-scraper'
  });
});

// Health check endpoint (API-only)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      api: 'running'
    }
  });
});

// Auth routes
app.post('/api/admin/login', loginHandler);

// Scheduler endpoints
app.post('/api/scheduler/start', authMiddleware, async (req, res) => {
  try {
    if (scheduler.isSchedulerRunning()) {
      return res.status(400).json(formatError('Scheduler is already running', 400));
    }
    await scheduler.startPriceUpdateSchedule();
    res.json(formatResponse({ message: 'Scheduler started successfully' }));
  } catch (error) {
    console.error('Failed to start scheduler:', error);
    res.status(500).json(formatError('Failed to start scheduler'));
  }
});

app.post('/api/scheduler/stop', authMiddleware, async (req, res) => {
  try {
    await scheduler.stopAllSchedules();
    res.json(formatResponse({ message: 'Scheduler stopped successfully' }));
  } catch (error) {
    console.error('Failed to stop scheduler:', error);
    res.status(500).json(formatError('Failed to stop scheduler'));
  }
});

app.get('/api/scheduler/status', (req, res) => {
  try {
    const health = scheduler.getHealth();
    res.json(formatResponse(health));
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json(formatError('Failed to get scheduler status'));
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json(formatError("Query 'q' must be at least 2 chars", 400));
    }
    const results = await searchStocks(query);
    res.json(formatResponse(results));
  } catch (e) {
    console.error('API Search Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.get('/api/scripts/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const details = await getScriptDetails(symbol);

    if (!details) {
      return res.status(404).json(formatError(`Script '${symbol}' not found`, 404));
    }
    res.json(formatResponse(details));
  } catch (e) {
    console.error('API Detail Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.get('/api/scripts', async (req, res) => {
  try {
    const companies = await getAllCompanies();
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Scripts Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.post('/api/updates', async (req, res) => {
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
});

app.get('/api/companies', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    if (limit > 1000) {
      return res.status(400).json(formatError("Limit cannot exceed 1000", 400));
    }

    const companies = await getAllCompanies(limit, offset);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Companies Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.get('/api/companies/sector/:sector', async (req, res) => {
  try {
    const sector = req.params.sector;
    const limit = parseInt(req.query.limit) || 50;

    const companies = await getCompaniesBySector(sector, limit);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Sector Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.get('/api/companies/top/:limit', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 20;
    const companies = await getTopCompaniesByMarketCap(limit);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Top Companies Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.get('/api/market/stats', async (req, res) => {
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
});

// Market status endpoint
app.get('/api/market/status', async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';

    if (refresh) {
      // Get live status and index data from scraper
      const scraper = new NepseScraper();
      try {
        const isOpen = await scraper.scrapeMarketStatus();
        const indexData = await scraper.scrapeMarketIndex();

        await updateMarketStatus(isOpen);
        await saveMarketIndex(indexData);

        res.json(formatResponse({
          isOpen,
          status: isOpen ? 'OPEN' : 'CLOSED',
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
});// New enhanced endpoints
app.get('/api/today-prices', async (req, res) => {
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
});

app.get('/api/market/gainers', async (req, res) => {
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
});

app.get('/api/market/losers', async (req, res) => {
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
});

app.get('/api/market/summary', async (req, res) => {
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
});

app.get('/api', (req, res) => {
  const endpoints = [
    { method: 'GET', path: '/api/search?q=QUERY', description: 'Search for stocks by symbol or name' },
    { method: 'GET', path: '/api/scripts', description: 'Get all scripts/companies with pagination' },
    { method: 'GET', path: '/api/scripts/SYMBOL', description: 'Get detailed information for a specific stock' },
    { method: 'POST', path: '/api/updates', description: 'Get consolidated market updates with stock prices, market status, and index data', body: '{ "symbols": ["NABIL", "SHIVM"] }' },
    { method: 'GET', path: '/api/companies?limit=100&offset=0', description: 'Get paginated list of all companies' },
    { method: 'GET', path: '/api/companies/sector/SECTOR_NAME?limit=50', description: 'Get companies by sector' },
    { method: 'GET', path: '/api/companies/top/20', description: 'Get top companies by market capitalization' },
    { method: 'GET', path: '/api/market/stats', description: 'Get market statistics, top gainers/losers (10), and top turnover/volume' },
    { method: 'GET', path: '/api/today-prices?limit=100&sortBy=symbol&order=asc', description: 'Get today\'s prices with pagination and sorting' },
    { method: 'GET', path: '/api/market/gainers?limit=20', description: 'Get top gainers of the day' },
    { method: 'GET', path: '/api/market/losers?limit=20', description: 'Get top losers of the day' },
    { method: 'GET', path: '/api/market/summary', description: 'Get comprehensive market summary with metrics' }
  ];

  res.json(formatResponse({
    title: 'NEPSE Portfolio API',
    version: '2.2.0',
    description: 'Enhanced API with comprehensive company data, real-time prices via API capture, market analytics, and financial metrics',
    endpoints
  }));
});

// React Fallback
app.get(/(.*)/, (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  } else {
    res.status(404).json(formatError('Not Found', 404));
  }
});

app.listen(PORT, async () => {
  logger.info(`API running at http://localhost:${PORT}`);

  // Auto-start the scheduler
  try {
    await scheduler.startPriceUpdateSchedule();
    logger.info('Scheduler auto-started on server boot');
  } catch (error) {
    logger.error('Failed to auto-start scheduler:', error);
  }
});

module.exports = app;