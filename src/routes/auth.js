const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../database/database');
const { generateUuid } = require('../utils/uuid');
const { validate } = require('../utils/validator');

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
        [email, name || null, picture || null, uid]
      );
      // Fetch updated
      const [updated] = await pool.execute('SELECT * FROM users WHERE google_id = ?', [uid]);
      user = updated[0];
      logger.info(`User updated: ${email}`);
    } else {
      // Create new user with UUID
      const userId = generateUuid();
      await pool.execute(
        'INSERT INTO users (id, google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)',
        [userId, uid, email, name || null, picture || null]
      );
      const [newUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      user = newUser[0];
      logger.info(`New user created: ${email}`);

      // Create default "Mine" portfolio for new user with UUID
      const portfolioId = generateUuid();
      await pool.execute(
        'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
        [portfolioId, user.id, 'Mine', '#4CAF50']
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
  const userId = req.currentUser ? req.currentUser.id : null;
  if (!userId) {
    return res.status(404).json({ error: 'User not found in database. Please login first.' });
  }

  const { isValid, error, data } = validate(req.body, {
    fcm_token: { type: 'string', required: true, message: 'FCM token required' },
    device_type: { type: 'string', default: 'android' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { fcm_token, device_type } = data;

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

    // Subscribe to topics if enabled by user preferences
    try {
      const [userRows] = await pool.execute('SELECT notify_ipos, notify_dividends FROM users WHERE id = ?', [userId]);
      const userPrefs = userRows[0] || { notify_ipos: true, notify_dividends: true };

      if (userPrefs.notify_ipos) {
        await admin.messaging().subscribeToTopic([fcm_token], 'ipos');
      }
      if (userPrefs.notify_dividends) {
        await admin.messaging().subscribeToTopic([fcm_token], 'dividends');
      }
      logger.info(`Subscribed ${fcm_token} to enabled topics`);
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
 * @route GET /api/auth/preferences
 * @desc Get user notification preferences
 * @access Private
 */
router.get('/preferences', verifyToken, async (req, res) => {
  const userId = req.currentUser ? req.currentUser.id : null;
  if (!userId) return res.status(404).json({ error: 'User not found' });

  try {
    const [rows] = await pool.execute('SELECT notify_ipos, notify_dividends FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({
      success: true,
      preferences: {
        notify_ipos: !!rows[0].notify_ipos,
        notify_dividends: !!rows[0].notify_dividends
      }
    });
  } catch (error) {
    logger.error('Get Preferences Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route PUT /api/auth/preferences
 * @desc Update user notification preferences
 * @access Private
 */
router.put('/preferences', verifyToken, async (req, res) => {
  const userId = req.currentUser ? req.currentUser.id : null;
  if (!userId) return res.status(404).json({ error: 'User not found' });

  const { notify_ipos, notify_dividends } = req.body;

  if (typeof notify_ipos !== 'boolean' || typeof notify_dividends !== 'boolean') {
    return res.status(400).json({ error: 'notify_ipos and notify_dividends must be booleans' });
  }

  try {
    // Update DB
    await pool.execute(
      'UPDATE users SET notify_ipos = ?, notify_dividends = ? WHERE id = ?',
      [notify_ipos, notify_dividends, userId]
    );

    // Update topics for all user's tokens
    const [tokens] = await pool.execute('SELECT fcm_token FROM notification_tokens WHERE user_id = ?', [userId]);
    const fcmTokens = tokens.map(t => t.fcm_token);

    if (fcmTokens.length > 0) {
      if (notify_ipos) {
        await admin.messaging().subscribeToTopic(fcmTokens, 'ipos');
      } else {
        await admin.messaging().unsubscribeFromTopic(fcmTokens, 'ipos');
      }

      if (notify_dividends) {
        await admin.messaging().subscribeToTopic(fcmTokens, 'dividends');
      } else {
        await admin.messaging().unsubscribeFromTopic(fcmTokens, 'dividends');
      }
    }

    res.json({
      success: true,
      message: 'Preferences updated',
      preferences: { notify_ipos, notify_dividends }
    });
  } catch (error) {
    logger.error('Update Preferences Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/auth/test-notification
 * @desc Send a test notification to a specific FCM token
 * @access Semi-public (requires knowing the FCM token)
 */
router.post('/test-notification', async (req, res) => {
  const { isValid, error, data } = validate(req.body, {
    fcm_token: { type: 'string', required: true, message: 'fcm_token is required' },
    title: { type: 'string', default: 'Test Notification' },
    body: { type: 'string', default: 'This is a test notification from NEPSE Portfolio.' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { fcm_token, title, body } = data;

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
      message_id: response
    });

  } catch (error) {
    logger.error('Test Notification Error:', error);

    // Provide helpful error messages for common FCM errors
    if (error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered') {

      // Clean up invalid/expired token from database
      try {
        await pool.execute('DELETE FROM notification_tokens WHERE fcm_token = ?', [fcm_token]);
        logger.info(`Removed invalid FCM token from database: ${fcm_token}`);
      } catch (dbErr) {
        logger.error('Failed to remove invalid token from DB:', dbErr);
      }

      if (error.code === 'messaging/invalid-registration-token') {
        return res.status(400).json({ error: 'Invalid FCM token format' });
      }
      return res.status(400).json({ error: 'FCM token is expired or unregistered' });
    }

    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

module.exports = router;
