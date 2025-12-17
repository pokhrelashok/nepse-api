const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, '../../serviceAccountKey.json');

try {
  let credential;

  // Check if file exists or use environment variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Fallback to file
    credential = admin.credential.cert(require(serviceAccountPath));
  }

  admin.initializeApp({
    credential: credential
  });

  logger.info('Firebase Admin initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Firebase Admin:', error.message);
  logger.warn('Notifications and Auth verification will not work without valid Firebase setup.');
}

module.exports = admin;
