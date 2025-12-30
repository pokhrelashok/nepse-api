const { validateApiKey } = require('../database/apiKeyQueries');
const logger = require('../utils/logger');

const jwt = require('jsonwebtoken');

/**
 * Check if request is from same origin (same domain)
 */
const isSameOrigin = (req) => {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';

  // Get allowed origins from environment or use default
  const allowedOrigins = [
    `http://${host}`,
    `https://${host}`,
    process.env.CORS_ORIGIN,
    'http://localhost:3000',
    'https://nepseportfoliotracker.app',
    'https://www.nepseportfoliotracker.app'
  ].filter(Boolean);

  // Check if origin or referer matches any allowed origin
  const originMatch = allowedOrigins.some(allowed => origin.startsWith(allowed));
  const refererMatch = allowedOrigins.some(allowed => referer.startsWith(allowed));

  // Also allow requests with no origin (same-origin requests from browser)
  const isLocalRequest = !origin && referer && allowedOrigins.some(allowed => referer.startsWith(allowed));

  return originMatch || refererMatch || isLocalRequest;
};

/**
 * Middleware to validate API Key
 */
const apiKeyAuth = async (req, res, next) => {
  // Allow same-origin requests without API key (for website widgets)
  if (isSameOrigin(req)) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];

  // Allow if it's an admin request with a valid Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded.role === 'admin') {
        return next();
      }
    } catch (err) {
      // If JWT fails, we still check for API key
    }
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key Required',
      message: 'Please provide a valid API key in the x-api-key header'
    });
  }

  try {
    const isValid = await validateApiKey(apiKey);

    if (!isValid) {
      logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
      return res.status(403).json({
        error: 'Invalid API Key',
        message: 'The provided API key is invalid or has been revoked'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in apiKeyAuth middleware:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


module.exports = apiKeyAuth;
