const logger = require('../../utils/logger');
const { pool } = require('../../database/database');
const { sendDividendNotification, sendRightShareNotification } = require('./messaging');

/**
 * Find dividends updated/created in the last 24 hours and notify holders
 */
async function processNewDividends() {
  try {
    // Find new/updated dividends (updated_at matches scraper's conditional update logic)
    const [newDividends] = await pool.execute(`
      SELECT * FROM announced_dividends 
      WHERE updated_at >= NOW() - INTERVAL 1 DAY
    `);

    if (newDividends.length === 0) {
      logger.info('No new dividends found in the last 24h.');
      return;
    }

    logger.info(`Found ${newDividends.length} new/updated dividends.`);

    // For each dividend, find users who hold that stock
    for (const dividend of newDividends) {
      await sendDividendNotification(dividend);
    }

  } catch (error) {
    logger.error('Error processing Dividend notifications:', error);
  }
}

/**
 * Find right shares announced in the last 24 hours and notify holders
 */
async function processNewRightShares() {
  try {
    // Find new/updated right shares with non-empty right_share field
    const [newRightShares] = await pool.execute(`
      SELECT * FROM announced_dividends 
      WHERE updated_at >= NOW() - INTERVAL 1 DAY
      AND right_share IS NOT NULL 
      AND right_share != '' 
      AND right_share != '0'
    `);

    if (newRightShares.length === 0) {
      logger.info('No new right shares found in the last 24h.');
      return;
    }

    logger.info(`Found ${newRightShares.length} new right shares.`);

    // For each right share, find users who hold that stock
    for (const rightShare of newRightShares) {
      await sendRightShareNotification(rightShare);
    }

  } catch (error) {
    logger.error('Error processing Right Share notifications:', error);
  }
}

module.exports = {
  processNewDividends,
  processNewRightShares
};
