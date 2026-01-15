const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { getAllMergersForAdmin, getMergerCount } = require('../../database/queries');
const { scrapeMergers } = require('../../scrapers/merger-scraper');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/mergers
 * Get all mergers with pagination
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const mergers = await getAllMergersForAdmin(limit, offset);
    const total = await getMergerCount();

    res.json(formatResponse({
      data: mergers,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    logger.error('Error fetching mergers:', error);
    res.status(500).json(formatError('Failed to fetch mergers'));
  }
});

/**
 * POST /api/admin/mergers/sync
 * Manually trigger merger/acquisition data sync
 */
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    logger.info('Starting manual merger sync...');
    const count = await scrapeMergers(true);
    res.json(formatResponse({
      count,
      message: `Successfully synced ${count} merger records`
    }, 'Merger data synced successfully'));
  } catch (error) {
    logger.error('Manual merger sync failed:', error);
    res.status(500).json(formatError(error.message || 'Failed to sync merger data'));
  }
});

module.exports = router;
