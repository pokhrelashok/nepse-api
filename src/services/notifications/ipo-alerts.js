const { pool } = require('../../database/database');
const { sendIpoOpeningNotification, sendIpoClosingNotification, sendIpoResultNotification } = require('./messaging');
const logger = require('../../utils/logger');

/**
 * Find IPOs opening TODAY and broadcast reminders to subscribed users
 */
async function processIpoOpeningReminders() {
  try {
    // Find IPOs opening today
    const [openingIpos] = await pool.execute(`
      SELECT * FROM ipos 
      WHERE opening_date = CURDATE()
    `);

    if (openingIpos.length === 0) {
      logger.info('No IPOs opening today.');
      return;
    }

    logger.info(`Found ${openingIpos.length} IPOs opening today. Preparing reminders...`);

    // For each IPO, find users who want notifications for that specific type
    for (const ipo of openingIpos) {
      const { normalizeShareType } = require('../../utils/share-type-utils');
      const normalizedShareType = normalizeShareType(ipo.share_type);
      const preferenceType = normalizedShareType;

      const [rows] = await pool.execute(`
        SELECT DISTINCT nt.fcm_token 
        FROM notification_tokens nt 
        JOIN users u ON u.id = nt.user_id 
        WHERE u.notify_ipos = TRUE
        AND JSON_CONTAINS(u.ipo_notification_types, JSON_QUOTE(?))
      `, [preferenceType]);

      const tokens = rows.map(r => r.fcm_token);
      if (tokens.length === 0) {
        logger.info(`No users subscribed to ${preferenceType} notifications (opening reminder).`);
        continue;
      }

      await sendIpoOpeningNotification(ipo, tokens);
    }

  } catch (error) {
    logger.error('Error processing IPO opening reminders:', error);
  }
}

/**
 * Find IPOs closing TODAY and broadcast reminders to subscribed users
 */
async function processIpoClosingReminders() {
  try {
    // Find IPOs closing today
    const [closingIpos] = await pool.execute(`
      SELECT * FROM ipos 
      WHERE closing_date = CURDATE()
    `);

    if (closingIpos.length === 0) {
      logger.info('No IPOs closing today.');
      return;
    }

    logger.info(`Found ${closingIpos.length} IPOs closing today. Preparing reminders...`);

    // For each IPO, find users who want notifications for that specific type
    for (const ipo of closingIpos) {
      const { normalizeShareType } = require('../../utils/share-type-utils');
      const normalizedShareType = normalizeShareType(ipo.share_type);
      const preferenceType = normalizedShareType;

      const [rows] = await pool.execute(`
        SELECT DISTINCT nt.fcm_token 
        FROM notification_tokens nt 
        JOIN users u ON u.id = nt.user_id 
        WHERE u.notify_ipos = TRUE
        AND JSON_CONTAINS(u.ipo_notification_types, JSON_QUOTE(?))
      `, [preferenceType]);

      const tokens = rows.map(r => r.fcm_token);
      if (tokens.length === 0) {
        logger.info(`No users subscribed to ${preferenceType} notifications (closing reminder).`);
        continue;
      }

      await sendIpoClosingNotification(ipo, tokens);
    }

  } catch (error) {
    logger.error('Error processing IPO closing reminders:', error);
  }
}

/**
 * Process notifications for a newly published IPO result
 * Finds users who want notifications for this specific type and sends them
 * @param {Object} resultData - Result data (providerId, companyName, shareType, value)
 */
async function processIpoResultNotifications(resultData) {
  try {
    const { companyName, shareType } = resultData;

    // Find users who have IPO notifications enabled AND are interested in this specific share type
    // This matches the logic used for opening/closing reminders
    const [rows] = await pool.execute(`
      SELECT DISTINCT nt.fcm_token 
      FROM notification_tokens nt 
      JOIN users u ON u.id = nt.user_id 
      WHERE u.notify_ipos = TRUE
      AND JSON_CONTAINS(u.ipo_notification_types, JSON_QUOTE(?))
    `, [shareType]);

    const tokens = rows.map(r => r.fcm_token);
    if (tokens.length === 0) {
      logger.info(`No users subscribed to ${shareType} notifications (IPO result: ${companyName}).`);
      return;
    }

    logger.info(`Sending IPO result notifications for ${companyName} (${shareType}) to ${tokens.length} users.`);
    await sendIpoResultNotification(resultData, tokens);

  } catch (error) {
    logger.error('Error processing IPO result notifications:', error);
  }
}

module.exports = {
  processIpoOpeningReminders,
  processIpoClosingReminders,
  processIpoResultNotifications
};
