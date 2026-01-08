const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const feedbackController = require('../../controllers/admin/admin-feedback-controller');

// All routes require authentication
router.use(authMiddleware);

// GET /api/admin/feedback/stats
router.get('/stats', feedbackController.getStats);

// GET /api/admin/feedback
router.get('/', feedbackController.getAllFeedbacks);

// PATCH /api/admin/feedback/:id/status
router.patch('/:id/status', feedbackController.updateStatus);

// DELETE /api/admin/feedback/:id
router.delete('/:id', feedbackController.deleteFeedback);

module.exports = router;
