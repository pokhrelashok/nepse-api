const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const usersController = require('../../controllers/admin/adminUsersController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/users/stats
router.get('/stats', usersController.getStats);

// GET /api/admin/users
router.get('/', usersController.getAllUsers);

module.exports = router;
