const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const pricesController = require('../../controllers/admin/adminPricesController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/prices
router.get('/', pricesController.getAllPrices);

module.exports = router;
