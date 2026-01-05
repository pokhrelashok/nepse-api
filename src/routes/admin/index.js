const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const scheduler = require('../../scheduler-instance');

/**
 * Admin routes - completely separate from application APIs
 * All routes require authentication
 */

// Mount sub-routers
router.use('/companies', require('./companies'));
router.use('/ipos', require('./ipos'));
router.use('/feedback', require('./feedback'));
router.use('/keys', require('./apiKeys'));
router.use('/dividends', require('./dividends'));
router.use('/prices', require('./prices'));
router.use('/users', require('./users'));

// Scheduler status endpoint
router.get('/scheduler/status', authMiddleware, async (req, res) => {
  try {
    const health = await scheduler.getHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
});

module.exports = router;
