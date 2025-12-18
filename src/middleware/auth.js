const admin = require('../config/firebase');
const logger = require('../utils/logger');
const { pool } = require('../database/database');

/**
 * Middleware to verify Firebase ID Token
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;

    try {
      const [rows] = await pool.execute('SELECT * FROM users WHERE google_id = ?', [decodedToken.uid]);

      if (rows.length > 0) {
        req.currentUser = rows[0];
      }
    } catch (dbError) {
      logger.error('Database error in auth middleware', dbError);
    }

    next();
  } catch (error) {
    logger.error('Error verifying Firebase token:', error);
    return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired token' });
  }
};

const jwt = require('jsonwebtoken');

/**
 * Admin Login Handler
 */
const loginHandler = (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

  if (username === adminUsername && password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }

  res.status(401).json({ error: 'Invalid credentials' });
};

/**
 * Admin Auth Middleware
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
  } catch (error) {
    logger.error('Error verifying admin token:', error);
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

module.exports = {
  verifyToken,
  loginHandler,
  authMiddleware
};

