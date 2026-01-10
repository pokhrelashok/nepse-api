const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');

// Import route modules
const portfolioRoutes = require('./portfolio-routes');
const transactionRoutes = require('./transaction-routes');
const syncRoutes = require('./sync-routes');
const aiSummaryRoutes = require('./ai-summary-routes');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Mount route modules
router.use('/', portfolioRoutes);
router.use('/', transactionRoutes);
router.use('/', syncRoutes);
router.use('/', aiSummaryRoutes);

module.exports = router;
