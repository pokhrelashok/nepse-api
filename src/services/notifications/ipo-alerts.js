const logger = require('../../utils/logger');
const { pool } = require('../../database/database');
const { sendIpoNotification, sendIpoClosingNotification } = require('./messaging');

/**
 * Find IPOs created in the last 24 hours and broadcast to subscribed users
 */
async function processNewIpos() {
  try {
    // Find all new IPOs (created in last 24h)
    const [newIpos] = await pool.execute(`
      SELECT * FROM ipos 
      WHERE created_at >= NOW() - INTERVAL 1 DAY
    `);

    if (newIpos.length === 0) {
      logger.info('No new IPOs found in the last 24h.');
      return;
    }

    logger.info(`Found ${newIpos.length} new IPOs. Preparing notifications...`);

    // For each IPO, find users who want notifications for that specific type
    for (const ipo of newIpos) {
      const { normalizeShareType } = require('../../utils/share-type-utils');
      const normalizedShareType = normalizeShareType(ipo.share_type);
      const preferenceType = normalizedShareType;

      // Get tokens of users who have IPO alerts enabled for this type
      const [rows] = await pool.execute(`
        SELECT DISTINCT nt.fcm_token 
        FROM notification_tokens nt 
        JOIN users u ON u.id = nt.user_id 
        WHERE u.notify_ipos = TRUE
        AND JSON_CONTAINS(u.ipo_notification_types, JSON_QUOTE(?))
      `, [preferenceType]);

      const tokens = rows.map(r => r.fcm_token);
      if (tokens.length === 0) {
        logger.info(`No users subscribed to ${preferenceType} notifications.`);
        continue;
      }

      await sendIpoNotification(ipo, tokens);
    }

  } catch (error) {
    logger.error('Error processing IPO notifications:', error);
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

module.exports = {
  processNewIpos,
  processIpoClosingReminders
};
