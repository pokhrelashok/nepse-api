const {
  getFeedbacks,
  getFeedbackStats,
  updateFeedbackStatus,
  deleteFeedback,
} = require('../../database/feedback-queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');

/**
 * Get all feedbacks for admin panel
 * GET /api/admin/feedback
 */
exports.getAllFeedbacks = async (req, res) => {
  try {
    const { status, limit = 15, offset = 0 } = req.query;

    // Parse and validate limit and offset
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    const feedbacks = await getFeedbacks({
      status: status || null,
      limit: isNaN(parsedLimit) ? 15 : parsedLimit,
      offset: isNaN(parsedOffset) ? 0 : parsedOffset
    });

    res.json(formatResponse(feedbacks));
  } catch (error) {
    logger.error('Admin Feedbacks Error:', error);
    res.status(500).json(formatError('Failed to fetch feedbacks', 500));
  }
};

/**
 * Get feedback statistics
 * GET /api/admin/feedback/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await getFeedbackStats();
    res.json(formatResponse(stats));
  } catch (error) {
    logger.error('Admin Feedback Stats Error:', error);
    res.status(500).json(formatError('Failed to fetch feedback stats', 500));
  }
};

/**
 * Update feedback status
 * PATCH /api/admin/feedback/:id/status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_review', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(formatError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    const updated = await updateFeedbackStatus(parseInt(id), status);

    if (!updated) {
      return res.status(404).json(formatError('Feedback not found', 404));
    }

    logger.info(`Feedback ${id} status updated to ${status}`);
    res.json(formatResponse({ id: parseInt(id), status }, 'Status updated successfully'));
  } catch (error) {
    logger.error('Admin Update Feedback Status Error:', error);
    res.status(500).json(formatError('Failed to update feedback status', 500));
  }
};

/**
 * Delete feedback
 * DELETE /api/admin/feedback/:id
 */
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteFeedback(parseInt(id));

    if (!deleted) {
      return res.status(404).json(formatError('Feedback not found', 404));
    }

    logger.info(`Feedback ${id} deleted`);
    res.json(formatResponse({ id: parseInt(id) }, 'Feedback deleted successfully'));
  } catch (error) {
    logger.error('Admin Delete Feedback Error:', error);
    res.status(500).json(formatError('Failed to delete feedback', 500));
  }
};
