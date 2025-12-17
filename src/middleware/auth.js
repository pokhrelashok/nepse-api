const admin = require('../config/firebase');
const logger = require('../utils/logger');
const mysql = require('mysql2/promise');

// DB Config
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db',
  timezone: '+05:45'
};

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
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute('SELECT * FROM users WHERE google_id = ?', [decodedToken.uid]);
      await connection.end();

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

/**
 * Legacy Admin Login Handler (Stub)
 */
const loginHandler = (req, res) => {
  logger.warn('Admin login attempt - Endpoint temporarily disabled');
  res.status(501).json({ error: 'Admin login temporarily disabled during upgrade' });
};

/**
 * Legacy Admin Auth Middleware (Stub)
 */
const authMiddleware = (req, res, next) => {
  // For now, block admin actions or allow if testing?
  // Let's block to be safe.
  res.status(501).json({ error: 'Admin actions temporarily disabled' });
};

module.exports = {
  verifyToken,
  loginHandler,
  authMiddleware
};
