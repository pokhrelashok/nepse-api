const {
  getPricesForAdmin,
} = require('../../database/admin/admin-queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all prices for admin panel
 * GET /api/admin/prices
 */
exports.getAllPrices = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const symbol = req.query.symbol;

    const filters = symbol ? { symbol } : {};

    const prices = await getPricesForAdmin(limit, offset, filters);

    res.json(formatResponse({
      prices,
      pagination: {
        limit,
        offset
      }
    }));
  } catch (error) {
    logger.error('Admin Prices Error:', error);
    res.status(500).json(formatError('Failed to fetch prices', 500));
  }
};
