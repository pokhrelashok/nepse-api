const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../database/database');

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

  try {
    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decodedToken;

    // Check if user exists
    const [rows] = await pool.execute('SELECT * FROM users WHERE google_id = ?', [uid]);

    let user;
    if (rows.length > 0) {
      // Update existing user
      await pool.execute(
        'UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE google_id = ?',
        [email, name, picture, uid]
      );
      // Fetch updated
      const [updated] = await pool.execute('SELECT * FROM users WHERE google_id = ?', [uid]);
      user = updated[0];
      logger.info(`User updated: ${email}`);
    } else {
      // Create new user
      const [result] = await pool.execute(
        'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)',
        [uid, email, name, picture]
      );
      const [newUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
      logger.info(`New user created: ${email}`);

      // Create default "Mine" portfolio for new user
      await pool.execute(
        'INSERT INTO portfolios (user_id, name, color) VALUES (?, ?, ?)',
        [user.id, 'Mine', '#4CAF50']
      );
      logger.info(`Default portfolio created for user: ${email}`);
    }

    res.json({ success: true, user });

  } catch (error) {
    logger.error('Auth Error:', error);
    res.status(401).json({ error: 'Authentication failed', details: error.message });
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

  if (!userId) {
    return res.status(404).json({ error: 'User not found in database. Please login first.' });
  }

  try {
    // Check if token exists
    const [existing] = await pool.execute('SELECT * FROM notification_tokens WHERE fcm_token = ?', [fcm_token]);

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE notification_tokens SET user_id = ?, device_type = ? WHERE fcm_token = ?',
        [userId, device_type || 'android', fcm_token]
      );
    } else {
      await pool.execute(
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
  }
});

/**
 * @route POST /api/auth/test-notification
 * @desc Send a test notification to a specific FCM token
 * @access Semi-public (requires knowing the FCM token)
 */
router.post('/test-notification', async (req, res) => {
  const { fcm_token, title, body } = req.body;

  if (!fcm_token) {
    return res.status(400).json({ error: 'fcm_token is required' });
  }

  try {
    // Send notification directly to the provided FCM token
    const message = {
      notification: {
        title: title || 'Test Notification',
        body: body || 'This is a test notification from NEPSE Portfolio.'
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
      token: fcm_token
    };

    const response = await admin.messaging().send(message);

    logger.info(`Test notification sent to token: ${fcm_token.substring(0, 20)}...`);

    res.json({
      success: true,
      message: 'Test notification sent',
      messageId: response
    });

  } catch (error) {
    logger.error('Test Notification Error:', error);

    // Provide helpful error messages for common FCM errors
    if (error.code === 'messaging/invalid-registration-token') {
      return res.status(400).json({ error: 'Invalid FCM token format' });
    }
    if (error.code === 'messaging/registration-token-not-registered') {
      return res.status(400).json({ error: 'FCM token is expired or unregistered' });
    }

    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

module.exports = router;
