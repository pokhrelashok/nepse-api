const {
  getUsersForAdmin,
  getUserCountForAdmin,
  getUserStatsForAdmin
} = require('../../database/admin/adminQueries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all users for admin panel
 * GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const [users, total] = await Promise.all([
      getUsersForAdmin(limit, offset),
      getUserCountForAdmin()
    ]);

    res.json(formatResponse({
      users,
      pagination: {
        limit,
        offset,
        total
      }
    }));
  } catch (error) {
    logger.error('Admin Users List Error:', error);
    res.status(500).json(formatError('Failed to fetch users', 500));
  }
};

/**
 * Get user statistics for dashboard
 * GET /api/admin/users/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await getUserStatsForAdmin();
    res.json(formatResponse(stats));
  } catch (error) {
    logger.error('Admin User Stats Error:', error);
    res.status(500).json(formatError('Failed to fetch user stats', 500));
  }
};
