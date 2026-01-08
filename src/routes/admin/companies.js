const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const companiesController = require('../../controllers/admin/admin-companies-controller');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/companies
router.get('/', companiesController.getAllCompanies);

module.exports = router;
