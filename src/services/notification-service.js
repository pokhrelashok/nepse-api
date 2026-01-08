/**
 * Notification Service - Backward Compatibility Wrapper
 * 
 * This file maintains backward compatibility by re-exporting
 * from the refactored modular implementation in ./notifications/
 * 
 * All imports from './services/notification-service' will continue to work.
 */

const { checkAndSendNotifications, checkAndSendPriceAlerts } = require('./notifications/index');

// Export as a class for backward compatibility with existing code that uses NotificationService.method()
class NotificationService {
  static async checkAndSendNotifications() {
    return checkAndSendNotifications();
  }

  static async checkAndSendPriceAlerts() {
    return checkAndSendPriceAlerts();
  }
}

module.exports = NotificationService;
