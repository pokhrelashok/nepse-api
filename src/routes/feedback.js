const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const feedbackController = require('../controllers/feedbackController');

/**
 * Public endpoint for submitting feedback
 * POST /api/feedback
 * Body: { title, body, attachments: ["data:image/jpeg;base64,..."], userEmail?, userName? }
 */
router.post('/', feedbackController.submitFeedback);

/**
 * Admin endpoints for managing feedback
 */

// Get feedback statistics
router.get('/stats', authMiddleware, feedbackController.getStats);

// Get all feedbacks with optional filtering
router.get('/', authMiddleware, feedbackController.getAllFeedbacks);

// Get single feedback
router.get('/:id', authMiddleware, feedbackController.getFeedback);

// Update feedback status
router.patch('/:id/status', authMiddleware, feedbackController.updateStatus);

// Delete feedback
router.delete('/:id', authMiddleware, feedbackController.removeFeedback);

module.exports = router;
