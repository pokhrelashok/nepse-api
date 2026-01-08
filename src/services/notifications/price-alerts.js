const logger = require('../../utils/logger');
const { getActivePriceAlerts, getLatestPrices, getUserHoldingWACC, updateAlertState, markAlertTriggered } = require('../../database/queries');
const { sendPriceAlertNotification } = require('./messaging');

/**
 * Check for triggered price alerts and send notifications
 * Called every 2 minutes during market hours after price updates
 */
async function checkAndSendPriceAlerts() {
  logger.info('🔔 Checking stock price alerts...');

  try {
    const allActiveAlerts = await getActivePriceAlerts();
    if (allActiveAlerts.length === 0) {
      logger.info('No active price alerts to process.');
      return;
    }

    const symbols = [...new Set(allActiveAlerts.map(a => a.symbol))];
    const latestPrices = await getLatestPrices(symbols);
    const priceMap = new Map(latestPrices.map(p => [p.symbol, p.close_price]));

    // Group alerts by alert_id to handle multiple tokens per user
    const alertsToProcess = {};

    for (const alert of allActiveAlerts) {
      let currentPrice = priceMap.get(alert.symbol);
      if (currentPrice === undefined) continue;

      let targetPrice = alert.target_price;
      let isWaccAlert = alert.alert_type === 'WACC_PERCENTAGE';

      // Calculate WACC-based target if needed
      if (isWaccAlert) {
        const wacc = await getUserHoldingWACC(alert.user_id, alert.symbol);
        if (wacc === null) {
          logger.warn(`Could not calculate WACC for user ${alert.user_id} and symbol ${alert.symbol}. Skipping alert.`);
          continue;
        }
        // Target price is WACC * (1 + target_percentage / 100)
        targetPrice = wacc * (1 + (alert.target_percentage / 100));
        alert.wacc = wacc;
        alert.calculated_target_price = targetPrice;
      }

      // Check if alert condition is met
      const isCurrentlyMet = (alert.alert_condition === 'ABOVE' && currentPrice >= targetPrice) ||
        (alert.alert_condition === 'BELOW' && currentPrice <= targetPrice) ||
        (alert.alert_condition === 'EQUAL' && currentPrice === targetPrice);

      if (isCurrentlyMet) {
        if (alert.last_state === 'NOT_MET') {
          // State crossed from NOT_MET to MET -> TRIGGER notification
          if (!alertsToProcess[alert.id]) {
            alertsToProcess[alert.id] = {
              ...alert,
              tokens: [],
              current_price: currentPrice,
              effective_target_price: targetPrice
            };
          }
          alertsToProcess[alert.id].tokens.push(alert.fcm_token);
        }
      } else {
        // If state is MET but condition no longer met -> Reset to NOT_MET
        if (alert.last_state === 'MET') {
          await updateAlertState(alert.id, 'NOT_MET');
        }
      }
    }

    const alertIds = Object.keys(alertsToProcess);
    if (alertIds.length === 0) {
      logger.info('No new price alerts triggered.');
      return;
    }

    logger.info(`Triggering ${alertIds.length} price alerts...`);

    // Send notifications for triggered alerts
    for (const alertId of alertIds) {
      const alert = alertsToProcess[alertId];
      await sendPriceAlertNotification(alert);
      await markAlertTriggered(alert.id);
    }

  } catch (error) {
    logger.error('❌ Price alert check failed:', error);
  }
}

module.exports = {
  checkAndSendPriceAlerts
};
