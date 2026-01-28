const { pool } = require('../database/database');

/**
 * Get all BOIDs for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of BOID objects
 */
async function getUserBoids(userId) {
  const sql = `
    SELECT 
      id,
      name,
      boid,
      is_primary,
      created_at
    FROM user_boids
    WHERE user_id = ?
    ORDER BY is_primary DESC, created_at ASC
  `;

  const [rows] = await pool.execute(sql, [userId]);
  return rows;
}

/**
 * Add a BOID for a user
 * @param {string} userId - User ID
 * @param {string} name - Name associated with BOID
 * @param {string} boid - BOID number
 * @param {boolean} isPrimary - Whether this is the primary BOID
 * @returns {Promise<Object>} - Created BOID object
 */
async function addUserBoid(userId, name, boid, isPrimary = false) {
  // If setting as primary, unset other primary BOIDs
  if (isPrimary) {
    await pool.execute(
      'UPDATE user_boids SET is_primary = FALSE WHERE user_id = ?',
      [userId]
    );
  }

  const sql = `
    INSERT INTO user_boids (user_id, name, boid, is_primary)
    VALUES (?, ?, ?, ?)
  `;

  const [result] = await pool.execute(sql, [userId, name, boid, isPrimary]);

  return {
    id: result.insertId,
    user_id: userId,
    name,
    boid,
    is_primary: isPrimary
  };
}

/**
 * Update a BOID
 * @param {number} boidId - BOID ID
 * @param {string} userId - User ID (for security)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Update result
 */
async function updateUserBoid(boidId, userId, updates) {
  const allowedFields = ['name', 'boid', 'is_primary'];
  const updateFields = [];
  const values = [];

  // If setting as primary, unset other primary BOIDs first
  if (updates.is_primary === true) {
    await pool.execute(
      'UPDATE user_boids SET is_primary = FALSE WHERE user_id = ?',
      [userId]
    );
  }

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(boidId, userId);
  const sql = `UPDATE user_boids SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

  const [result] = await pool.execute(sql, values);
  return result;
}

/**
 * Delete a BOID
 * @param {number} boidId - BOID ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<Object>} - Delete result
 */
async function deleteUserBoid(boidId, userId) {
  const sql = 'DELETE FROM user_boids WHERE id = ? AND user_id = ?';
  const [result] = await pool.execute(sql, [boidId, userId]);
  return result;
}

/**
 * Get primary BOID for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Primary BOID object or null
 */
async function getPrimaryBoid(userId) {
  const sql = `
    SELECT 
      id,
      name,
      boid,
      is_primary
    FROM user_boids
    WHERE user_id = ? AND is_primary = TRUE
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [userId]);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  getUserBoids,
  addUserBoid,
  updateUserBoid,
  deleteUserBoid,
  getPrimaryBoid
};
