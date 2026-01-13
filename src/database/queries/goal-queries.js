const { pool } = require('../database');
const logger = require('../../utils/logger');
const { generateUuid } = require('../../utils/uuid');

/**
 * Create a new goal for a user
 * @param {string} userId - User ID
 * @param {Object} data - Goal data including portfolio_id (optional, null = all portfolios)
 */
async function createGoal(userId, data) {
  const { type, target_value, start_date, end_date, metadata, portfolio_id } = data;
  const id = generateUuid();

  const sql = `
    INSERT INTO user_goals (id, user_id, portfolio_id, type, target_value, start_date, end_date, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await pool.execute(sql, [
    id,
    userId,
    portfolio_id || null,
    type,
    target_value,
    start_date || null,
    end_date || null,
    metadata ? JSON.stringify(metadata) : null
  ]);

  return getGoal(id);
}

/**
 * Update an existing goal
 */
async function updateGoal(goalId, userId, data) {
  const { target_value, start_date, end_date, metadata, status, portfolio_id } = data;

  const updates = [];
  const params = [];

  if (portfolio_id !== undefined) {
    updates.push('portfolio_id = ?');
    params.push(portfolio_id || null);
  }
  if (target_value !== undefined) {
    updates.push('target_value = ?');
    params.push(target_value);
  }
  if (start_date !== undefined) {
    updates.push('start_date = ?');
    params.push(start_date);
  }
  if (end_date !== undefined) {
    updates.push('end_date = ?');
    params.push(end_date);
  }
  if (metadata !== undefined) {
    updates.push('metadata = ?');
    params.push(JSON.stringify(metadata));
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length === 0) return getGoal(goalId);

  params.push(goalId);
  params.push(userId); // Security check

  const sql = `UPDATE user_goals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
  await pool.execute(sql, params);

  return getGoal(goalId);
}

/**
 * Get a specific goal by ID
 */
async function getGoal(goalId) {
  const [rows] = await pool.execute('SELECT * FROM user_goals WHERE id = ?', [goalId]);
  if (rows.length === 0) return null;

  const goal = rows[0];
  // Parse metadata if it's a string
  if (goal.metadata && typeof goal.metadata === 'string') {
    try {
      goal.metadata = JSON.parse(goal.metadata);
    } catch (e) {
      logger.error('Error parsing goal metadata:', e);
      goal.metadata = {};
    }
  }
  return goal;
}

/**
 * Get all active goals for a user
 */
async function getActiveGoals(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM user_goals WHERE user_id = ? AND status = "active" ORDER BY created_at DESC',
    [userId]
  );
  // Parse metadata for each goal
  return rows.map(goal => {
    if (goal.metadata && typeof goal.metadata === 'string') {
      try {
        goal.metadata = JSON.parse(goal.metadata);
      } catch (e) {
        logger.error('Error parsing goal metadata:', e);
        goal.metadata = {};
      }
    }
    return goal;
  });
}

/**
 * Get goal history for a user
 */
async function getGoalHistory(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM user_goals WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  // Parse metadata for each goal
  return rows.map(goal => {
    if (goal.metadata && typeof goal.metadata === 'string') {
      try {
        goal.metadata = JSON.parse(goal.metadata);
      } catch (e) {
        logger.error('Error parsing goal metadata:', e);
        goal.metadata = {};
      }
    }
    return goal;
  });
}

/**
 * Delete a goal (or cancel it)
 */
async function deleteGoal(goalId, userId) {
  const [result] = await pool.execute('DELETE FROM user_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
  return result.affectedRows > 0;
}

module.exports = {
  createGoal,
  updateGoal,
  getGoal,
  getActiveGoals,
  getGoalHistory,
  deleteGoal
};
