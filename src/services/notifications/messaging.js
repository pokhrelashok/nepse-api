const admin = require('../../config/firebase');
const logger = require('../../utils/logger');
const { pool } = require('../../database/database');
const { formatDate, formatShareType } = require('./templates');

/**
 * Send broadcast notification for a new IPO
 */
async function sendIpoNotification(ipo, tokens) {
  const offeringType = (ipo.offering_type || 'ipo').toUpperCase();
  const title = `New ${offeringType}: ${ipo.company_name}`;
  const formattedType = formatShareType(ipo.share_type);
  const body = `${formattedType} offering opens ${formatDate(ipo.opening_date)}, apply before ${formatDate(ipo.closing_date)}`;

  const message = {
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_notification',
        color: '#1976D2'
      }
    },
    data: {
      type: offeringType.toLowerCase(),
      route: 'ipo_calendar',
      symbol: ipo.symbol || '',
      id: ipo.id.toString()
    },
    tokens: tokens
  };

  try {
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);
      const batchMessage = { ...message, tokens: batchTokens };

      const response = await admin.messaging().sendEachForMulticast(batchMessage);
      logger.info(`Sent IPO notification for ${ipo.symbol} to ${response.successCount} devices.`);

      if (response.failureCount > 0) {
        await handleFailedTokens(response.responses, batchTokens);
      }
    }
  } catch (error) {
    logger.error(`Failed to send IPO notification for ${ipo.symbol}:`, error);
  }
}

/**
 * Send broadcast notification for an IPO closing reminder
 */
async function sendIpoClosingNotification(ipo, tokens) {
  const offeringType = (ipo.offering_type || 'ipo').toUpperCase();
  const title = `${offeringType} Closing Today: ${ipo.company_name}`;
  const formattedType = formatShareType(ipo.share_type);
  const body = `${formattedType} for ${ipo.company_name} closes today! Apply via Meroshare before banking hours.`;

  const message = {
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_notification',
        color: '#1976D2'
      }
    },
    data: {
      type: `${offeringType.toLowerCase()}_closing`,
      route: 'ipo_calendar',
      symbol: ipo.symbol || '',
      id: ipo.id.toString()
    },
    tokens: tokens
  };

  try {
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);
      const batchMessage = { ...message, tokens: batchTokens };

      const response = await admin.messaging().sendEachForMulticast(batchMessage);
      logger.info(`Sent IPO Closing reminder for ${ipo.symbol} to ${response.successCount} devices.`);

      if (response.failureCount > 0) {
        await handleFailedTokens(response.responses, batchTokens);
      }
    }
  } catch (error) {
    logger.error(`Failed to send IPO Closing reminder for ${ipo.symbol}:`, error);
  }
}

/**
 * Send targeted notification for a dividend announcement
 */
async function sendDividendNotification(dividend) {
  // Find users who hold this stock AND have dividend alerts enabled
  const [holders] = await pool.execute(`
     SELECT DISTINCT nt.fcm_token 
     FROM transactions t
     JOIN portfolios p ON p.id = t.portfolio_id
     JOIN users u ON u.id = p.user_id
     JOIN notification_tokens nt ON nt.user_id = u.id
     WHERE t.stock_symbol = ? 
     AND u.notify_dividends = TRUE
     GROUP BY p.user_id, nt.fcm_token
     HAVING SUM(CASE 
         WHEN t.type IN ('SECONDARY_BUY', 'BONUS', 'RIGHTS', 'IPO', 'FPO', 'AUCTION') THEN t.quantity 
         WHEN t.type IN ('SECONDARY_SELL') THEN -t.quantity 
         ELSE 0 
     END) > 0
  `, [dividend.symbol]);

  if (holders.length === 0) return;

  const tokens = holders.map(h => h.fcm_token);
  const title = `Dividend Announcement: ${dividend.symbol}`;
  const body = `Bonus: ${dividend.bonus_share}%, Cash: ${dividend.cash_dividend}%. Book Close: ${formatDate(dividend.book_close_date)}`;

  const message = {
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_notification',
        color: '#1976D2'
      }
    },
    data: {
      type: 'dividend',
      route: 'bonus_calendar',
      symbol: dividend.symbol,
      id: dividend.id.toString()
    },
    tokens: tokens
  };

  try {
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);
      const batchMessage = { ...message, tokens: batchTokens };

      const response = await admin.messaging().sendEachForMulticast(batchMessage);
      logger.info(`Sent Dividend notification for ${dividend.symbol} to ${response.successCount} holders.`);

      if (response.failureCount > 0) {
        await handleFailedTokens(response.responses, batchTokens);
      }
    }
  } catch (error) {
    logger.error(`Failed to send Dividend notification for ${dividend.symbol}:`, error);
  }
}

/**
 * Send targeted notification for a right share announcement
 */
async function sendRightShareNotification(rightShare) {
  // Find users who hold this stock AND have dividend alerts enabled
  // (Right shares use the same preference as dividends)
  const [holders] = await pool.execute(`
     SELECT DISTINCT nt.fcm_token 
     FROM transactions t
     JOIN portfolios p ON p.id = t.portfolio_id
     JOIN users u ON u.id = p.user_id
     JOIN notification_tokens nt ON nt.user_id = u.id
     WHERE t.stock_symbol = ? 
     AND u.notify_dividends = TRUE
     GROUP BY p.user_id, nt.fcm_token
     HAVING SUM(CASE 
         WHEN t.type IN ('SECONDARY_BUY', 'BONUS', 'RIGHTS', 'IPO', 'FPO', 'AUCTION') THEN t.quantity 
         WHEN t.type IN ('SECONDARY_SELL') THEN -t.quantity 
         ELSE 0 
     END) > 0
  `, [rightShare.symbol]);

  if (holders.length === 0) return;

  const tokens = holders.map(h => h.fcm_token);
  const title = `Right Share: ${rightShare.symbol}`;
  const body = `${rightShare.right_share}% right share announced. Book Close: ${formatDate(rightShare.right_book_close_date)}`;

  const message = {
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_notification',
        color: '#1976D2'
      }
    },
    data: {
      type: 'right_share',
      route: 'bonus_calendar',
      symbol: rightShare.symbol,
      id: rightShare.id.toString()
    },
    tokens: tokens
  };

  try {
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);
      const batchMessage = { ...message, tokens: batchTokens };

      const response = await admin.messaging().sendEachForMulticast(batchMessage);
      logger.info(`Sent Right Share notification for ${rightShare.symbol} to ${response.successCount} holders.`);

      if (response.failureCount > 0) {
        await handleFailedTokens(response.responses, batchTokens);
      }
    }
  } catch (error) {
    logger.error(`Failed to send Right Share notification for ${rightShare.symbol}:`, error);
  }
}

/**
 * Send notification for a triggered price alert
 */
async function sendPriceAlertNotification(alert) {
  let title = `Price Alert: ${alert.symbol}`;
  let body = '';

  const conditionText = alert.alert_condition === 'ABOVE' ? 'is above' : 'is below';

  if (alert.alert_type === 'WACC_PERCENTAGE') {
    const isProfit = alert.target_percentage > 0;
    title = `${isProfit ? 'Profit Booking' : 'Stop Loss'}: ${alert.symbol}`;
    body = `${alert.symbol} ${conditionText} your ${isProfit ? 'profit' : 'loss'} target of ${alert.target_percentage}%. WACC: ${alert.wacc.toFixed(2)}, Target: ${alert.effective_target_price.toFixed(2)}, LTP: ${alert.current_price.toFixed(2)}`;
  } else {
    body = `${alert.symbol} ${conditionText} your target of ${alert.target_price}. Current: ${alert.current_price}`;
  }

  const message = {
    notification: { title, body },
    android: {
      notification: {
        icon: 'ic_notification',
        color: '#1976D2'
      }
    },
    data: {
      type: 'price_alert',
      alert_type: alert.alert_type,
      symbol: alert.symbol,
      id: alert.id.toString(),
      target_price: (alert.effective_target_price || alert.target_price).toString(),
      current_price: alert.current_price.toString(),
      target_percentage: (alert.target_percentage || '').toString(),
      wacc: (alert.wacc || '').toString()
    },
    tokens: alert.tokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`Sent price alert for ${alert.symbol} to user ${alert.user_id} (${response.successCount} devices).`);

    if (response.failureCount > 0) {
      await handleFailedTokens(response.responses, alert.tokens);
    }
  } catch (error) {
    logger.error(`Failed to send price alert for ${alert.symbol}:`, error);
  }
}

/**
 * Clean up invalid FCM tokens from failed sends
 */
async function handleFailedTokens(responses, tokens) {
  const failedTokens = [];
  responses.forEach((resp, idx) => {
    if (!resp.success) {
      if (resp.error.code === 'messaging/invalid-registration-token' ||
        resp.error.code === 'messaging/registration-token-not-registered') {
        failedTokens.push(tokens[idx]);
      }
    }
  });

  if (failedTokens.length > 0) {
    try {
      const placeholders = failedTokens.map(() => '?').join(',');
      await pool.execute(`DELETE FROM notification_tokens WHERE fcm_token IN (${placeholders})`, failedTokens);
      logger.info(`Cleaned up ${failedTokens.length} invalid FCM tokens.`);
    } catch (err) {
      logger.error('Failed to cleanup invalid tokens:', err);
    }
  }
}

module.exports = {
  sendIpoNotification,
  sendIpoClosingNotification,
  sendDividendNotification,
  sendRightShareNotification,
  sendPriceAlertNotification
};
