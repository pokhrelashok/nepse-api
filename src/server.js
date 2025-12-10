const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
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
  updateMarketStatus
} = require('./database/queries');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { formatResponse, formatError } = require('./utils/formatter');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize scheduler
const scheduler = new Scheduler();

// Graceful shutdown handling
const cleanup = async () => {
  console.log('\n🧹 Shutting down server...');
  if (scheduler) {
    await scheduler.stopAllSchedules();
  }
  console.log('✅ Server shutdown completed');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Hello route
app.get('/', (req, res) => {
  res.json({
    message: 'Hello! Welcome to NEPSE Portfolio API',
    version: '2.1.0',
    endpoints: {
      market: '/api/market/status',
      stocks: '/api/prices',
      companies: '/api/companies',
      search: '/api/search?q=NABIL',
      health: '/health'
    },
    documentation: 'https://github.com/pokhrelashok/nepal-stock-scraper'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
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

// Scheduler endpoints
app.post('/api/scheduler/start', async (req, res) => {
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

app.post('/api/scheduler/stop', async (req, res) => {
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
    const status = {
      running: scheduler.isSchedulerRunning(),
      activeJobs: scheduler.getActiveJobs()
    };
    res.json(formatResponse(status));
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
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
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    if (limit > 1000) {
      return res.status(400).json(formatError("Limit cannot exceed 1000", 400));
    }

    const companies = await getAllCompanies(limit, offset);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Scripts Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

app.post('/api/prices', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json(formatError("Invalid body. Expected { symbols: ['SYM', ...] }", 400));
    }

    const data = await getLatestPrices(symbols);
    res.json(formatResponse(data));
  } catch (e) {
    console.error('API Prices Error:', e);
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
    res.json(formatResponse(stats));
  } catch (e) {
    console.error('API Stats Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

// Market status endpoint
app.get('/api/market/status', async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';

    if (refresh) {
      // Get live status from scraper
      const scraper = new NepseScraper();
      try {
        const isOpen = await scraper.scrapeMarketStatus();
        await updateMarketStatus(isOpen);

        res.json(formatResponse({
          isOpen,
          status: isOpen ? 'OPEN' : 'CLOSED',
          source: 'LIVE_SCRAPER',
          lastUpdated: new Date().toISOString()
        }));
      } finally {
        await scraper.close();
      }
    } else {
      // Get cached status from database
      const marketStatus = await getCurrentMarketStatus();
      if (marketStatus) {
        res.json(formatResponse({
          isOpen: marketStatus.isOpen,
          status: marketStatus.isOpen ? 'OPEN' : 'CLOSED',
          source: 'DATABASE_CACHE',
          lastUpdated: marketStatus.lastUpdated,
          tradingDate: marketStatus.tradingDate
        }));
      } else {
        // No cached data, get live status
        return res.redirect('/api/market/status?refresh=true');
      }
    }
  } catch (error) {
    console.error('API Market Status Error:', error);
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
    const totalVolume = recentPrices.reduce((sum, stock) => sum + (stock.volume || 0), 0);
    const totalTurnover = recentPrices.reduce((sum, stock) => sum + (stock.turnover || 0), 0);
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
    { method: 'POST', path: '/api/prices', description: 'Get latest prices for multiple symbols', body: '{ "symbols": ["NABIL", "SHIVM"] }' },
    { method: 'GET', path: '/api/companies?limit=100&offset=0', description: 'Get paginated list of all companies' },
    { method: 'GET', path: '/api/companies/sector/SECTOR_NAME?limit=50', description: 'Get companies by sector' },
    { method: 'GET', path: '/api/companies/top/20', description: 'Get top companies by market capitalization' },
    { method: 'GET', path: '/api/market/stats', description: 'Get market statistics and summary' },
    { method: 'GET', path: '/api/today-prices?limit=100&sortBy=symbol&order=asc', description: 'Get today\'s prices with pagination and sorting' },
    { method: 'GET', path: '/api/market/gainers?limit=20', description: 'Get top gainers of the day' },
    { method: 'GET', path: '/api/market/losers?limit=20', description: 'Get top losers of the day' },
    { method: 'GET', path: '/api/market/summary', description: 'Get comprehensive market summary with metrics' }
  ];

  res.json(formatResponse({
    title: 'NEPSE Portfolio API',
    version: '2.1.0',
    description: 'Enhanced API with comprehensive company data, real-time prices via API capture, market analytics, and financial metrics',
    endpoints
  }));
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});

module.exports = app;