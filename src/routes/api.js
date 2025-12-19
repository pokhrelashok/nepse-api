const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const alertController = require('../controllers/alertController');
const schedulerController = require('../controllers/schedulerController');
const { loginHandler, authMiddleware, verifyToken } = require('../middleware/auth');
const { formatResponse } = require('../utils/formatter');

// API Info
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NEPSE Portfolio API',
    version: '2.1.0',
    documentation: 'API specification available in the api-spec directory of the repository',
    github: 'https://github.com/pokhrelashok/nepal-stock-scraper'
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

// Price Alerts
router.get('/alerts', verifyToken, alertController.getAlerts);
router.post('/alerts', verifyToken, alertController.createAlert);
router.put('/alerts/:id', verifyToken, alertController.updateAlert);
router.delete('/alerts/:id', verifyToken, alertController.deleteAlert);

module.exports = router;
