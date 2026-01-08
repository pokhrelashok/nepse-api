const {
  getCompaniesForAdmin,
  getCompanyCountForAdmin,
} = require('../../database/admin/admin-queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all companies for admin panel
 * GET /api/admin/companies
 */
exports.getAllCompanies = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const [companies, total] = await Promise.all([
      getCompaniesForAdmin(limit, offset),
      getCompanyCountForAdmin()
    ]);

    res.json(formatResponse({
      companies,
      pagination: {
        limit,
        offset,
        total
      }
    }));
  } catch (error) {
    logger.error('Admin Companies Error:', error);
    res.status(500).json(formatError('Failed to fetch companies', 500));
  }
};
