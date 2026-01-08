const {
  getIposForAdmin,
  getIpoCountForAdmin,
} = require('../../database/admin/admin-queries');
const { insertIpo } = require('../../database/queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all IPOs for admin panel
 * GET /api/admin/ipos
 */
exports.getAllIpos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    const type = req.query.type;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    const [ipos, total] = await Promise.all([
      getIposForAdmin(limit, offset, filters),
      getIpoCountForAdmin(filters)
    ]);

    res.json(formatResponse({
      ipos,
      pagination: {
        limit,
        offset,
        total
      }
    }));
  } catch (error) {
    logger.error('Admin IPOs Error:', error);
    res.status(500).json(formatError('Failed to fetch IPOs', 500));
  }
};

/**
 * Create new IPO
 * POST /api/admin/ipos
 */
exports.createIpo = async (req, res) => {
  try {
    const result = await insertIpo(req.body);
    res.json(formatResponse({ message: 'IPO created successfully', result }));
  } catch (error) {
    logger.error('Admin Create IPO Error:', error);
    res.status(500).json(formatError('Failed to create IPO', 500));
  }
};
