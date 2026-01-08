const {
  getAllApiKeys,
  createApiKey,
  deleteApiKey,
} = require('../../database/admin/admin-queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all API keys
 * GET /api/admin/keys
 */
exports.getAllKeys = async (req, res) => {
  try {
    const keys = await getAllApiKeys();
    res.json(formatResponse(keys));
  } catch (error) {
    logger.error('Admin API Keys Error:', error);
    res.status(500).json(formatError('Failed to fetch API keys', 500));
  }
};

/**
 * Create new API key
 * POST /api/admin/keys
 */
exports.createKey = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json(formatError('Name is required', 400));
    }

    const newKey = await createApiKey(name.trim());
    logger.info(`API key created: ${name}`);

    res.json(formatResponse(newKey, 'API key created successfully'));
  } catch (error) {
    logger.error('Admin Create API Key Error:', error);
    res.status(500).json(formatError('Failed to create API key', 500));
  }
};

/**
 * Delete API key
 * DELETE /api/admin/keys/:id
 */
exports.deleteKey = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteApiKey(id);

    if (!deleted) {
      return res.status(404).json(formatError('API key not found', 404));
    }

    logger.info(`API key deleted: ${id}`);
    res.json(formatResponse({ id }, 'API key deleted successfully'));
  } catch (error) {
    logger.error('Admin Delete API Key Error:', error);
    res.status(500).json(formatError('Failed to delete API key', 500));
  }
};
