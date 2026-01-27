const { getAllSips } = require('../database/queries/sip-queries');
const { formatResponse } = require('../utils/formatter');
const logger = require('../utils/logger');

/**
 * Get all SIPs
 */
async function getSips(req, res) {
  try {
    const sips = await getAllSips();
    res.json(formatResponse(sips, 'SIPs retrieved successfully'));
  } catch (error) {
    logger.error('Error getting SIPs:', error);
    res.status(500).json(formatResponse(null, 'Failed to get SIPs', true));
  }
}

module.exports = {
  getSips
};
