const express = require('express');
const router = express.Router();
const { loginHandler, authMiddleware } = require('../middleware/auth');
const marketController = require('../controllers/marketController');
const companyController = require('../controllers/companyController');
const schedulerController = require('../controllers/schedulerController');
const { formatResponse } = require('../utils/formatter');

// API Info
router.get('/', (req, res) => {
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

// Health check
router.get('/health', (req, res) => {
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

// Auth
router.post('/admin/login', loginHandler);

// Scheduler
router.post('/scheduler/start', authMiddleware, schedulerController.startScheduler);
router.post('/scheduler/stop', authMiddleware, schedulerController.stopScheduler);
router.get('/scheduler/status', schedulerController.getSchedulerStatus);

// Search & Scripts
router.get('/search', companyController.searchCompanies);
router.get('/scripts', companyController.getAllCompanies);
router.get('/scripts/:symbol', companyController.getCompanyDetails);

// Market Updates
router.post('/updates', marketController.getUpdates);

// Companies
router.get('/companies', companyController.getAllCompanies); // Handles pagination internally now
router.get('/companies/sector/:sector', companyController.getCompaniesBySector);
router.get('/companies/top/:limit', companyController.getTopCompanies);

// Initial Public Offerings (IPOs)
router.get('/ipos', companyController.getIpos);
router.post('/ipos', authMiddleware, companyController.createIpo);

// Dividends
router.get('/announced-dividends', companyController.getDividends);

// Market Stats & Summary
router.get('/market/stats', marketController.getMarketStats);
router.get('/market/status', marketController.getMarketStatus);
router.get('/market/summary', marketController.getMarketSummary);
router.get('/market/gainers', marketController.getGainers);
router.get('/market/losers', marketController.getLosers);

// Today Prices
router.get('/today-prices', marketController.getTodayPrices);

module.exports = router;
