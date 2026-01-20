const { pool } = require('./database');
const logger = require('../utils/logger');

/**
 * Safely parse JSON string
 */
function safeJsonParse(str, fallback = []) {
  if (!str) return fallback;
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (error) {
    logger.error('JSON Parse Error:', error, 'String:', str);
    return fallback;
  }
}

/**
 * Create a new feedback entry
 */
async function createFeedback({ title, body, attachments = [], userEmail = null, userName = null }) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO feedbacks (title, body, attachments, user_email, user_name) 
       VALUES (?, ?, ?, ?, ?)`,
      [title, body, JSON.stringify(attachments), userEmail, userName]
    );
    return { id: result.insertId, title, body, attachments, status: 'pending' };
  } catch (error) {
    logger.error('Error creating feedback:', error);
    throw error;
  }
}

/**
 * Get all feedbacks with optional filtering and pagination
 */
async function getFeedbacks({ status = null, limit = 20, offset = 0 } = {}) {
  try {
    let sql = 'SELECT * FROM feedbacks';
    const params = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);

    // Parse attachments JSON
    return rows.map(row => ({
      ...row,
      attachments: safeJsonParse(row.attachments)
    }));
  } catch (error) {
    logger.error('Error fetching feedbacks:', error);
    throw error;
  }
}

/**
 * Get feedback by ID
 */
async function getFeedbackById(id) {
  try {
    const [rows] = await pool.execute('SELECT * FROM feedbacks WHERE id = ?', [id]);
    if (rows.length === 0) return null;

    const feedback = rows[0];
    feedback.attachments = safeJsonParse(feedback.attachments);
    return feedback;
  } catch (error) {
    logger.error('Error fetching feedback by id:', error);
    throw error;
  }
}

/**
 * Update feedback status
 */
async function updateFeedbackStatus(id, status) {
  try {
    const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';
    const [result] = await pool.execute(
      `UPDATE feedbacks SET status = ?, resolved_at = ${status === 'resolved' ? 'NOW()' : 'NULL'} WHERE id = ?`,
      [status, id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    logger.error('Error updating feedback status:', error);
    throw error;
  }
}

/**
 * Delete feedback
 */
async function deleteFeedback(id) {
  try {
    const [result] = await pool.execute('DELETE FROM feedbacks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (error) {
    logger.error('Error deleting feedback:', error);
    throw error;
  }
}

/**
 * Get feedback statistics
 */
async function getFeedbackStats() {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM feedbacks 
      GROUP BY status
    `);

    const stats = {
      total: 0,
      pending: 0,
      in_review: 0,
      resolved: 0,
      closed: 0
    };

    rows.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });

    return stats;
  } catch (error) {
    logger.error('Error fetching feedback stats:', error);
    throw error;
  }
}

module.exports = {
  createFeedback,
  getFeedbacks,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackStats
};
