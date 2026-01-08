const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { formatResponse, formatError } = require('../utils/formatter');
const {
  createFeedback,
  getFeedbacks,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackStats
} = require('../database/feedback-queries');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/feedback');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Parse base64 data URL and save to file
 * @param {string} dataUrl - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @returns {object|null} - File info or null if invalid
 */
const saveBase64Image = (dataUrl) => {
  try {
    // Validate data URL format
    const matches = dataUrl.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/i);
    if (!matches) {
      return null;
    }

    const extension = matches[1].toLowerCase() === 'jpg' ? 'jpeg' : matches[1].toLowerCase();
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return null;
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `feedback-${uniqueSuffix}.${extension}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    fs.writeFileSync(filepath, buffer);

    return {
      filename,
      originalName: filename,
      path: `/uploads/feedback/${filename}`,
      mimetype: `image/${extension}`,
      size: buffer.length
    };
  } catch (error) {
    logger.error('Error saving base64 image:', error);
    return null;
  }
};

/**
 * Submit new feedback (public endpoint)
 * POST /api/feedback
 * Body: { title, body, attachments: ["data:image/jpeg;base64,..."], userEmail?, userName? }
 */
const submitFeedback = async (req, res) => {
  try {
    const { title, body, attachments = [], userEmail, userName } = req.body;

    if (!title || !body) {
      return res.status(400).json(formatError('Title and body are required', 400));
    }

    if (title.length > 255) {
      return res.status(400).json(formatError('Title must be less than 255 characters', 400));
    }

    // Validate attachments array
    if (!Array.isArray(attachments)) {
      return res.status(400).json(formatError('Attachments must be an array', 400));
    }

    if (attachments.length > 5) {
      return res.status(400).json(formatError('Maximum 5 attachments allowed', 400));
    }

    // Process base64 images
    const processedAttachments = [];
    for (const dataUrl of attachments) {
      if (typeof dataUrl !== 'string') {
        continue;
      }

      const savedFile = saveBase64Image(dataUrl);
      if (savedFile) {
        processedAttachments.push(savedFile);
      } else {
        logger.warn('Invalid image data URL skipped');
      }
    }

    const feedback = await createFeedback({
      title,
      body,
      attachments: processedAttachments,
      userEmail: userEmail || null,
      userName: userName || null
    });

    logger.info(`New feedback submitted: ${feedback.id}`);
    res.status(201).json(formatResponse(feedback, 'Feedback submitted successfully'));
  } catch (error) {
    logger.error('Error submitting feedback:', error);
    res.status(500).json(formatError('Failed to submit feedback', 500));
  }
};

/**
 * Get all feedbacks (admin endpoint)
 * GET /api/admin/feedbacks
 */
const getAllFeedbacks = async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;

    const feedbacks = await getFeedbacks({
      status: status || null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(formatResponse(feedbacks));
  } catch (error) {
    logger.error('Error fetching feedbacks:', error);
    res.status(500).json(formatError('Failed to fetch feedbacks', 500));
  }
};

/**
 * Get single feedback (admin endpoint)
 * GET /api/admin/feedbacks/:id
 */
const getFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await getFeedbackById(parseInt(id));

    if (!feedback) {
      return res.status(404).json(formatError('Feedback not found', 404));
    }

    res.json(formatResponse(feedback));
  } catch (error) {
    logger.error('Error fetching feedback:', error);
    res.status(500).json(formatError('Failed to fetch feedback', 500));
  }
};

/**
 * Update feedback status (admin endpoint)
 * PATCH /api/admin/feedbacks/:id/status
 */
const updateStatus = async (req, res) => {
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
    logger.error('Error updating feedback status:', error);
    res.status(500).json(formatError('Failed to update feedback status', 500));
  }
};

/**
 * Delete feedback (admin endpoint)
 * DELETE /api/admin/feedbacks/:id
 */
const removeFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteFeedback(parseInt(id));

    if (!deleted) {
      return res.status(404).json(formatError('Feedback not found', 404));
    }

    logger.info(`Feedback ${id} deleted`);
    res.json(formatResponse({ id: parseInt(id) }, 'Feedback deleted successfully'));
  } catch (error) {
    logger.error('Error deleting feedback:', error);
    res.status(500).json(formatError('Failed to delete feedback', 500));
  }
};

/**
 * Get feedback statistics (admin endpoint)
 * GET /api/admin/feedbacks/stats
 */
const getStats = async (req, res) => {
  try {
    const stats = await getFeedbackStats();
    res.json(formatResponse(stats));
  } catch (error) {
    logger.error('Error fetching feedback stats:', error);
    res.status(500).json(formatError('Failed to fetch feedback stats', 500));
  }
};

module.exports = {
  submitFeedback,
  getAllFeedbacks,
  getFeedback,
  updateStatus,
  removeFeedback,
  getStats
};
