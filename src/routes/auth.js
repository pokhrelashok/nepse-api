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

      // Create default "Mine" portfolio for new user
      await connection.execute(
        'INSERT INTO portfolios (user_id, name, color) VALUES (?, ?, ?)',
        [user.id, 'Mine', '#4CAF50']
      );
      logger.info(`Default portfolio created for user: ${email}`);
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

/**
 * @route POST /api/auth/test-notification
 * @desc Send a test notification to a specific user
 * @access Private (Admin or for testing)
 */
router.post('/test-notification', verifyToken, async (req, res) => {
  const { userId, email, title, body } = req.body;

  if (!userId && !email) {
    return res.status(400).json({ error: 'Either userId or email is required' });
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Find user
    let userQuery = userId
      ? 'SELECT id, email, display_name FROM users WHERE id = ?'
      : 'SELECT id, email, display_name FROM users WHERE email = ?';
    const [users] = await connection.execute(userQuery, [userId || email]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = users[0];

    // Get FCM tokens for the user
    const [tokens] = await connection.execute(
      'SELECT fcm_token FROM notification_tokens WHERE user_id = ?',
      [targetUser.id]
    );

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'No FCM tokens registered for this user' });
    }

    const fcmTokens = tokens.map(t => t.fcm_token);

    // Send notification to all user devices
    const message = {
      notification: {
        title: title || 'Test Notification',
        body: body || `Hello ${targetUser.display_name || 'User'}! This is a test notification from NEPSE Portfolio.`
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    logger.info(`Test notification sent to ${targetUser.email}: ${response.successCount} success, ${response.failureCount} failures`);

    res.json({
      success: true,
      message: 'Test notification sent',
      details: {
        user: targetUser.email,
        devicesTargeted: fcmTokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount
      }
    });

  } catch (error) {
    logger.error('Test Notification Error:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
