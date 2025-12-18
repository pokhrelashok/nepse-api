const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createApiKey, getApiKeys, deleteApiKey } = require('../database/apiKeyQueries');
const logger = require('../utils/logger');

/**
 * @route GET /api/admin/keys
 * @desc Get all API keys
 * @access Private (Admin)
 */
router.get('/keys', authMiddleware, async (req, res) => {
  try {
    const keys = await getApiKeys();
    res.json({ success: true, data: keys });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

/**
 * @route POST /api/admin/keys
 * @desc Create a new API key
 * @access Private (Admin)
 */
router.post('/keys', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required for the API key' });
  }

  try {
    const newKey = await createApiKey(name);
    res.json({ success: true, data: newKey });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * @route DELETE /api/admin/keys/:id
 * @desc Delete (revoke) an API key
 * @access Private (Admin)
 */
router.delete('/keys/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deleteApiKey(id);
    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }
    res.json({ success: true, message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

module.exports = router;
