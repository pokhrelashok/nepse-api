const admin = require('../config/firebase');
const { pool } = require('../database/database');
const queries = require('../database/queries');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Format a date to a clean, readable string like "Feb 27, 2025"
   */
  static formatDate(date) {
    if (!date) return 'TBD';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Main orchestrator to check for new data and send notifications
   */
  static async checkAndSendNotifications() {
    logger.info('🔔 Starting daily notification check...');

    try {
      await this.processNewIpos();
      await this.processIpoClosingReminders();
      await this.processNewDividends();
      await this.processNewRightShares();
      logger.info('✅ Daily notification check completed and sent.');
    } catch (error) {
      logger.error('❌ Notification check failed:', error);
    }
  }

  /**
   * Specifically check for stock price alerts
   */
  static async checkAndSendPriceAlerts() {
    logger.info('🔔 Checking stock price alerts...');
    try {
      const allActiveAlerts = await queries.getActivePriceAlerts();
      if (allActiveAlerts.length === 0) {
        logger.info('No active price alerts to process.');
        return;
      }

      const symbols = [...new Set(allActiveAlerts.map(a => a.symbol))];
      const latestPrices = await queries.getLatestPrices(symbols);
      const priceMap = new Map(latestPrices.map(p => [p.symbol, p.close_price]));

      // Group alerts by user+alert_id to handle multiple tokens
      const alertsToProcess = {};

      for (const alert of allActiveAlerts) {
        const currentPrice = priceMap.get(alert.symbol);
        if (currentPrice === undefined) continue;

        const isCurrentlyMet = (alert.alert_condition === 'ABOVE' && currentPrice >= alert.target_price) ||
          (alert.alert_condition === 'BELOW' && currentPrice <= alert.target_price) ||
          (alert.alert_condition === 'EQUAL' && currentPrice === alert.target_price);

        if (isCurrentlyMet) {
          if (alert.last_state === 'NOT_MET') {
            // State crossed from NOT_MET to MET -> TRIGGER
            if (!alertsToProcess[alert.id]) {
              alertsToProcess[alert.id] = {
                ...alert,
                tokens: [],
                current_price: currentPrice
              };
            }
            alertsToProcess[alert.id].tokens.push(alert.fcm_token);
          }
        } else {
          // If state is MET but condition no longer met -> Reset to NOT_MET
          if (alert.last_state === 'MET') {
            await queries.updateAlertState(alert.id, 'NOT_MET');
          }
        }
      }

      const alertIds = Object.keys(alertsToProcess);
      if (alertIds.length === 0) {
        logger.info('No new price alerts triggered.');
        return;
      }

      logger.info(`Triggering ${alertIds.length} price alerts...`);

      for (const alertId of alertIds) {
        const alert = alertsToProcess[alertId];
        await this.sendPriceAlertNotification(alert);
        await queries.markAlertTriggered(alert.id);
      }

    } catch (error) {
      logger.error('❌ Price alert check failed:', error);
    }
  }

  /**
   * Find IPOs created in the last 24 hours and broadcast to subscribed users based on their preferences
   */
  static async processNewIpos() {
    try {
      // 1. Find all new IPOs (created in last 24h)
      const [newIpos] = await pool.execute(`
        SELECT * FROM ipos 
        WHERE created_at >= NOW() - INTERVAL 1 DAY
      `);

      if (newIpos.length === 0) {
        logger.info('No new IPOs found in the last 24h.');
        return;
      }

      logger.info(`Found ${newIpos.length} new IPOs. Preparing notifications...`);

      // 2. For each IPO, find users who want notifications for that specific type
      for (const ipo of newIpos) {
        // Get the normalized share_type (lowercase_underscore) for querying
        // The ipo object from scraper has the raw value, we need to normalize it
        const { normalizeShareType } = require('../utils/share-type-utils');
        const normalizedType = normalizeShareType(ipo.share_type);

        // Get tokens of users who:
        // - Have IPO alerts enabled (notify_ipos = TRUE)
        // - Have this specific IPO type in their preferences
        const [rows] = await pool.execute(`
          SELECT DISTINCT nt.fcm_token 
          FROM notification_tokens nt 
          JOIN users u ON u.id = nt.user_id 
          WHERE u.notify_ipos = TRUE
          AND JSON_CONTAINS(u.ipo_notification_types, JSON_QUOTE(?))
        `, [normalizedType]);

        const tokens = rows.map(r => r.fcm_token);
        if (tokens.length === 0) {
          logger.info(`No users subscribed to ${normalizedType} IPO notifications.`);
          continue;
        }

        await this.sendIpoNotification(ipo, tokens);
      }

    } catch (error) {
      logger.error('Error processing IPO notifications:', error);
    }
  }

  /**
   * Find IPOs closing TODAY and broadcast to subscribed users
   */
  static async processIpoClosingReminders() {
    try {
      // 1. Find IPOs closing today
      const [closingIpos] = await pool.execute(`
        SELECT * FROM ipos 
        WHERE closing_date = CURDATE()
      `);

      if (closingIpos.length === 0) {
        logger.info('No IPOs closing today.');
        return;
      }

      logger.info(`Found ${closingIpos.length} IPOs closing today. Preparing reminders...`);

      // 2. For each IPO, find users who want notifications for that specific type
      for (const ipo of closingIpos) {
        // Reuse logic to filter users by share type preferences
        const { normalizeShareType } = require('../utils/share-type-utils');
        const normalizedType = normalizeShareType(ipo.share_type);

        const [rows] = await pool.execute(`
          SELECT DISTINCT nt.fcm_token 
          FROM notification_tokens nt 
          JOIN users u ON u.id = nt.user_id 
          WHERE u.notify_ipos = TRUE
          AND JSON_CONTAINS(u.ipo_notification_types, JSON_QUOTE(?))
        `, [normalizedType]);

        const tokens = rows.map(r => r.fcm_token);
        if (tokens.length === 0) {
          logger.info(`No users subscribed to ${normalizedType} IPO notifications (closing reminder).`);
          continue;
        }

        await this.sendIpoClosingNotification(ipo, tokens);
      }

    } catch (error) {
      logger.error('Error processing IPO closing reminders:', error);
    }
  }

  /**
   * Find dividends updated/created in the last 24 hours and notify holders
   */
  static async processNewDividends() {
    try {
      // 1. Find new/updated dividends
      // We rely on updated_at matching our "conditional update" logic from the scraper
      const [newDividends] = await pool.execute(`
        SELECT * FROM announced_dividends 
        WHERE updated_at >= NOW() - INTERVAL 1 DAY
      `);

      if (newDividends.length === 0) {
        logger.info('No new dividends found in the last 24h.');
        return;
      }

      logger.info(`Found ${newDividends.length} new/updated dividends.`);

      // 2. For each dividend, find users who hold that stock
      for (const dividend of newDividends) {
        await this.sendDividendNotification(dividend);
      }

    } catch (error) {
      logger.error('Error processing Dividend notifications:', error);
    }
  }

  /**
   * Send broadcast notification for an IPO
   */
  static async sendIpoNotification(ipo, tokens) {
    const title = `New IPO: ${ipo.company_name}`;
    // share_type is already formatted by the query (e.g., "Ordinary", "Migrant Workers")
    const body = `${ipo.share_type} opens ${this.formatDate(ipo.opening_date)}, apply before ${this.formatDate(ipo.application_deadline)}`;

    const message = {
      notification: { title, body },
      data: {
        type: 'ipo',
        route: 'ipo_calendar',
        symbol: ipo.symbol || '',
        id: ipo.id.toString()
      },
      tokens: tokens // Multicast message
    };

    try {
      // Firebase supports sending to up to 500 tokens at once. 
      // If we have more, we need to batch. 
      // For simplicity, we assume < 500 active devices for now or implementation of batching later.
      const BATCH_SIZE = 500;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batchTokens = tokens.slice(i, i + BATCH_SIZE);
        const batchMessage = { ...message, tokens: batchTokens };

        const response = await admin.messaging().sendEachForMulticast(batchMessage);
        logger.info(`Sent IPO notification for ${ipo.symbol} to ${response.successCount} devices.`);

        if (response.failureCount > 0) {
          this.handleFailedTokens(response.responses, batchTokens);
        }
      }
    } catch (error) {
      logger.error(`Failed to send IPO notification for ${ipo.symbol}:`, error);
    }
  }

  /**
   * Send broadcast notification for an IPO Closing Reminder
   */
  static async sendIpoClosingNotification(ipo, tokens) {
    const title = `⚠️ IPO Closing Today: ${ipo.company_name}`;
    const body = `${ipo.share_type} for ${ipo.company_name} closes today! Apply via Meroshare before banking hours.`;

    const message = {
      notification: { title, body },
      data: {
        type: 'ipo_closing',
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
          this.handleFailedTokens(response.responses, batchTokens);
        }
      }
    } catch (error) {
      logger.error(`Failed to send IPO Closing reminder for ${ipo.symbol}:`, error);
    }
  }

  /**
   * Send targeted notification for a Dividend
   */
  static async sendDividendNotification(dividend) {
    // Find users who hold this stock AND have dividend alerts on
    const [rows] = await pool.execute(`
      SELECT DISTINCT nt.fcm_token 
      FROM transactions t
      JOIN portfolios p ON p.id = t.portfolio_id
      JOIN users u ON u.id = p.user_id
      JOIN notification_tokens nt ON nt.user_id = u.id
      WHERE t.stock_symbol = ? 
      AND u.notify_dividends = TRUE
      GROUP BY p.user_id, nt.fcm_token
    `, [dividend.symbol]);

    // Note: The above query simplifies "holding". It notifies anyone who has EVER had a transaction 
    // for this stock. For strict "current holders", we'd need to sum quantities. 
    // Given the complexity of splitting/bonus logic, simplificating to "interested users" (has transaction) 
    // is often acceptable or safer for V1 to ensure they don't miss it.
    // However, user specifically asked: "quantity > 0".
    // Let's refining the query to basic quantity sum.

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
           WHEN t.type IN ('BUY', 'BONUS', 'RIGHTS', 'IPO') THEN t.quantity 
           WHEN t.type IN ('SELL') THEN -t.quantity 
           ELSE 0 
       END) > 0
    `, [dividend.symbol]);

    if (holders.length === 0) return;

    const tokens = holders.map(h => h.fcm_token);
    const title = `Dividend Announcement: ${dividend.symbol}`;
    const body = `Bonus: ${dividend.bonus_share}%, Cash: ${dividend.cash_dividend}%. Book Close: ${this.formatDate(dividend.book_close_date)}`;

    const message = {
      notification: { title, body },
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
          this.handleFailedTokens(response.responses, batchTokens);
        }
      }
    } catch (error) {
      logger.error(`Failed to send Dividend notification for ${dividend.symbol}:`, error);
    }
  }

  /**
   * Find right shares announced in the last 24 hours and notify holders
   */
  static async processNewRightShares() {
    try {
      // 1. Find new/updated right shares
      // We look for dividends with right_share populated that were updated in the last 24h
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

      // 2. For each right share, find users who hold that stock
      for (const rightShare of newRightShares) {
        await this.sendRightShareNotification(rightShare);
      }

    } catch (error) {
      logger.error('Error processing Right Share notifications:', error);
    }
  }

  /**
   * Send targeted notification for a Right Share
   */
  static async sendRightShareNotification(rightShare) {
    // Find users who hold this stock AND have dividend alerts on
    // (Right shares are related to dividends, so we use the same preference)
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
           WHEN t.type IN ('BUY', 'BONUS', 'RIGHTS', 'IPO') THEN t.quantity 
           WHEN t.type IN ('SELL') THEN -t.quantity 
           ELSE 0 
       END) > 0
    `, [rightShare.symbol]);

    if (holders.length === 0) return;

    const tokens = holders.map(h => h.fcm_token);
    const title = `Right Share: ${rightShare.symbol}`;
    const body = `${rightShare.right_share}% right share announced. Book Close: ${this.formatDate(rightShare.right_book_close_date)}`;

    const message = {
      notification: { title, body },
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
          this.handleFailedTokens(response.responses, batchTokens);
        }
      }
    } catch (error) {
      logger.error(`Failed to send Right Share notification for ${rightShare.symbol}:`, error);
    }
  }

  /**
   * Clean up invalid tokens
   */
  static async handleFailedTokens(responses, tokens) {
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
        // Bulk delete/cleanup could be optimized, but loop is safe for now
        // Or WHERE fcm_token IN (...)
        const placeholders = failedTokens.map(() => '?').join(',');
        await pool.execute(`DELETE FROM notification_tokens WHERE fcm_token IN (${placeholders})`, failedTokens);
        logger.info(`Cleaned up ${failedTokens.length} invalid FCM tokens.`);
      } catch (err) {
        logger.error('Failed to cleanup invalid tokens:', err);
      }
    }
  }

  /**
   * Send notification for a triggered price alert
   */
  static async sendPriceAlertNotification(alert) {
    const title = `Price Alert: ${alert.symbol}`;
    const conditionText = alert.alert_condition === 'ABOVE' ? 'is above' : 'is below';
    const body = `${alert.symbol} ${conditionText} your target of ${alert.target_price}. Current: ${alert.current_price}`;

    const message = {
      notification: { title, body },
      data: {
        type: 'price_alert',
        symbol: alert.symbol,
        id: alert.id.toString(),
        target_price: alert.target_price.toString(),
        current_price: alert.current_price.toString()
      },
      tokens: alert.tokens
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(`Sent price alert for ${alert.symbol} to user ${alert.user_id} (${response.successCount} devices).`);

      if (response.failureCount > 0) {
        this.handleFailedTokens(response.responses, alert.tokens);
      }
    } catch (error) {
      logger.error(`Failed to send price alert for ${alert.symbol}:`, error);
    }
  }
}

module.exports = NotificationService;
