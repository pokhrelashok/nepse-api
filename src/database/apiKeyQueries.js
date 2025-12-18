const { pool } = require('./database');
const { generateUuid } = require('../utils/uuid');
const crypto = require('crypto');

/**
 * Generate a random API key
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new API key
 */
async function createApiKey(name) {
  const id = generateUuid();
  const apiKey = generateKey();

  const sql = `
    INSERT INTO api_keys (id, name, api_key, status)
    VALUES (?, ?, ?, 'active')
  `;

  await pool.execute(sql, [id, name, apiKey]);
  return { id, name, apiKey, status: 'active' };
}

/**
 * Get all API keys
 */
async function getApiKeys() {
  const [rows] = await pool.execute('SELECT id, name, api_key, status, created_at, last_used_at FROM api_keys ORDER BY created_at DESC');
  return rows;
}

/**
 * Delete (revoke) an API key
 */
async function deleteApiKey(id) {
  const [result] = await pool.execute('DELETE FROM api_keys WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/**
 * Validate an API key and update last_used_at
 */
async function validateApiKey(apiKey) {
  const sql = 'SELECT id, status FROM api_keys WHERE api_key = ? AND status = "active"';
  const [rows] = await pool.execute(sql, [apiKey]);

  if (rows.length > 0) {
    // Update last used timestamp asynchronously
    pool.execute('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE api_key = ?', [apiKey])
      .catch(err => console.error('Error updating API key last_used_at:', err));
    return true;
  }

  return false;
}

module.exports = {
  createApiKey,
  getApiKeys,
  deleteApiKey,
  validateApiKey
};
