const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company-controller');
const marketController = require('../controllers/market-controller');
const alertController = require('../controllers/alert-controller');
const schedulerController = require('../controllers/scheduler-controller');
const blogController = require('../controllers/blogController');
const { loginHandler, authMiddleware, verifyToken } = require('../middleware/auth');
const { formatResponse } = require('../utils/formatter');

const sitemapService = require('../services/sitemap-service');

// API Info
router.get('/', (req, res) => {
  res.json(formatResponse({
    message: 'Welcome to NEPSE Portfolio API',
    version: '2.1.0',
    documentation: 'API specification available in the api-spec directory of the repository',
    github: 'https://github.com/pokhrelashok/nepal-stock-scraper'
  }, 'API Information'));
});

// Sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = await sitemapService.generateSitemap();
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json(formatResponse({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      api: 'running'
    }
  }, 'Health Check Success'));
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
router.get('/scripts/:symbol/ai-summary', companyController.getAIStockSummary);
router.get('/history/:symbol', companyController.getCompanyHistory);

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
router.get('/market/indices/history', marketController.getMarketIndicesHistory);
router.get('/market/sectors', marketController.getSectorBreakdown);

// Today Prices
router.get('/today-prices', marketController.getTodayPrices);

// Intraday Prices (for charting)
router.get('/market/intraday', marketController.getIntradayPrices);


// Price Alerts
router.get('/alerts', verifyToken, alertController.getAlerts);
router.post('/alerts', verifyToken, alertController.createAlert);
router.put('/alerts/:id', verifyToken, alertController.updateAlert);
router.delete('/alerts/:id', verifyToken, alertController.deleteAlert);

// Blogs
router.get('/blogs', blogController.getBlogs);
router.get('/blogs/:slug', blogController.getPublicBlogBySlug);

// Admin Blog Routes
router.get('/admin/blogs', authMiddleware, blogController.getBlogs); // reuse controller, auth middleware allows seeing non-published
router.get('/admin/blogs/:id', authMiddleware, blogController.getBlogById);
router.post('/admin/blogs', authMiddleware, blogController.createBlog);
router.put('/admin/blogs/:id', authMiddleware, blogController.updateBlog);
router.delete('/admin/blogs/:id', authMiddleware, blogController.deleteBlog);
router.post('/admin/blogs/generate', authMiddleware, blogController.generateBlogContent);

module.exports = router;
