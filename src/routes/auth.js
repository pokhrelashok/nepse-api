const express = require('express');
const router = express.Router();
const admin = require('../config/firebase'); // Used for manual verify if needed, or rely on middleware
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');

// DB connection helper (should be centralized)
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db',
  timezone: '+05:45'
};

/**
 * @route POST /api/auth/google
 * @desc Verify Google Token and Create/Update User in DB
 * @access Public (Token provided in body or header)
 */
router.post('/google', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  let connection;
  try {
    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decodedToken;

    connection = await mysql.createConnection(dbConfig);

    // Check if user exists
    const [rows] = await connection.execute('SELECT * FROM users WHERE google_id = ?', [uid]);

    let user;
    if (rows.length > 0) {
      // Update existing user
      await connection.execute(
        'UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE google_id = ?',
        [email, name, picture, uid]
      );
      // Fetch updated
      const [updated] = await connection.execute('SELECT * FROM users WHERE google_id = ?', [uid]);
      user = updated[0];
      logger.info(`User updated: ${email}`);
    } else {
      // Create new user
      const [result] = await connection.execute(
        'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)',
        [uid, email, name, picture]
      );
      const [newUser] = await connection.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
      logger.info(`New user created: ${email}`);
    }

    res.json({ success: true, user });

  } catch (error) {
    logger.error('Auth Error:', error);
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @route POST /api/auth/fcm
 * @desc Register FCM Token
 * @access Private
 */
router.post('/fcm', verifyToken, async (req, res) => {
  const { fcm_token, device_type } = req.body;
  const userId = req.currentUser ? req.currentUser.id : null;

  if (!fcm_token) {
    return res.status(400).json({ error: 'FCM token required' });
  }

  // Identify user by DB ID if available, else maybe just store token?
  // Plan said: "user_id (INT, FK -> users.id)". If verifyToken worked and found user, we have ID.
  // If not found in DB (rare if they called /google first), we might fail FK.

  if (!userId) {
    return res.status(404).json({ error: 'User not found in database. Please login first.' });
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Upsert token
    // Logic: specific fcm_token can belong to only one user effectively, but unique constraint is on fcm_token.
    // We want to update partials.

    // Check if token exists
    const [existing] = await connection.execute('SELECT * FROM notification_tokens WHERE fcm_token = ?', [fcm_token]);

    if (existing.length > 0) {
      await connection.execute(
        'UPDATE notification_tokens SET user_id = ?, device_type = ? WHERE fcm_token = ?',
        [userId, device_type || 'android', fcm_token]
      );
    } else {
      await connection.execute(
        'INSERT INTO notification_tokens (user_id, fcm_token, device_type) VALUES (?, ?, ?)',
        [userId, fcm_token, device_type || 'android']
      );
    }

    // Subscribe to topics
    try {
      await admin.messaging().subscribeToTopic([fcm_token], 'ipos');
      await admin.messaging().subscribeToTopic([fcm_token], 'dividends');
      logger.info(`Subscribed ${fcm_token} to topics`);
    } catch (subError) {
      logger.error('Failed to subscribe to topics:', subError);
      // Don't fail the request, just log
    }

    res.json({ success: true, message: 'FCM registered' });
  } catch (error) {
    logger.error('FCM Registry Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
