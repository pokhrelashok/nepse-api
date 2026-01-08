const {
  getDividendsForAdmin,
  getDividendCountForAdmin,
} = require('../../database/admin/admin-queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all dividends for admin panel
 * GET /api/admin/dividends
 */
exports.getAllDividends = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const [dividends, total] = await Promise.all([
      getDividendsForAdmin(limit, offset),
      getDividendCountForAdmin()
    ]);

    res.json(formatResponse({
      dividends,
      pagination: {
        limit,
        offset,
        total
      }
    }));
  } catch (error) {
    logger.error('Admin Dividends Error:', error);
    res.status(500).json(formatError('Failed to fetch dividends', 500));
  }
};
