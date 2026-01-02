const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const dividendsController = require('../../controllers/admin/adminDividendsController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/dividends
router.get('/', dividendsController.getAllDividends);

module.exports = router;
