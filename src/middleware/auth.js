const admin = require('../config/firebase');
const logger = require('../utils/logger');
const { pool } = require('../database/database');
const { formatResponse, formatError } = require('../utils/formatter');

/**
 * Middleware to verify Firebase ID Token
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(formatError('No token provided', 401));
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
    return res.status(403).json(formatError('Invalid or expired token', 403));
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
    return res.json(formatResponse({ token }, 'Login successful'));
  }

  res.status(401).json(formatError('Invalid credentials', 401));
};

/**
 * Admin Auth Middleware
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(formatError('No token provided', 401));
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.role === 'admin') {
      next();
    } else {
      res.status(403).json(formatError('Admin access required', 403));
    }
  } catch (error) {
    logger.error('Error verifying admin token:', error);
    res.status(401).json(formatError('Invalid or expired token', 401));
  }
};

module.exports = {
  verifyToken,
  loginHandler,
  authMiddleware
};

