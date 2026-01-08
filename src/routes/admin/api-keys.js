const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const apiKeysController = require('../../controllers/admin/admin-api-keys-controller');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/keys
router.get('/', apiKeysController.getAllKeys);

// POST /api/admin/keys
router.post('/', apiKeysController.createKey);

// DELETE /api/admin/keys/:id
router.delete('/:id', apiKeysController.deleteKey);

module.exports = router;
