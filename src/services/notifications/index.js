const logger = require('../../utils/logger');
const { checkAndSendPriceAlerts } = require('./price-alerts');
const { processNewIpos, processIpoClosingReminders } = require('./ipo-alerts');
const { processNewDividends, processNewRightShares } = require('./dividend-alerts');

/**
 * Main orchestrator to check for new data and send notifications
 * Called daily at 9:00 AM by scheduler
 */
async function checkAndSendNotifications() {
  logger.info('🔔 Starting daily notification check...');

  try {
    await processNewIpos();
    await processIpoClosingReminders();
    await processNewDividends();
    await processNewRightShares();
    logger.info('✅ Daily notification check completed and sent.');
    return { message: 'Notifications processed successfully' };
  } catch (error) {
    logger.error('❌ Notification check failed:', error);
    throw error;
  }
}

module.exports = {
  checkAndSendNotifications,
  checkAndSendPriceAlerts
};
