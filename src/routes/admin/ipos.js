const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const iposController = require('../../controllers/admin/admin-ipos-controller');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/ipos
router.get('/', iposController.getAllIpos);

// POST /api/admin/ipos
router.post('/', iposController.createIpo);

module.exports = router;
