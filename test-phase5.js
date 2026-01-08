// Phase 5 Test - Notification Service Refactoring Verification
const path = require('path');

console.log('🧪 Phase 5: Testing Notification Service Refactoring');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Backward compatibility - original import still works
test('Backward compatibility: require("./src/services/notification-service") loads', () => {
  const NotificationService = require('./src/services/notification-service');
  if (!NotificationService) throw new Error('NotificationService not loaded');
  if (typeof NotificationService.checkAndSendNotifications !== 'function') {
    throw new Error('checkAndSendNotifications method missing');
  }
  if (typeof NotificationService.checkAndSendPriceAlerts !== 'function') {
    throw new Error('checkAndSendPriceAlerts method missing');
  }
});

// Test 2: New modular imports work
test('Modular import: require("./src/services/notifications/index") loads', () => {
  const notifications = require('./src/services/notifications/index');
  if (!notifications) throw new Error('Notifications module not loaded');
  if (typeof notifications.checkAndSendNotifications !== 'function') {
    throw new Error('checkAndSendNotifications not found');
  }
  if (typeof notifications.checkAndSendPriceAlerts !== 'function') {
    throw new Error('checkAndSendPriceAlerts not found');
  }
});

// Test 3: Price alerts module
test('Price alerts module loads', () => {
  const priceAlerts = require('./src/services/notifications/price-alerts');
  if (!priceAlerts.checkAndSendPriceAlerts) throw new Error('checkAndSendPriceAlerts not found');
});

// Test 4: IPO alerts module
test('IPO alerts module loads', () => {
  const ipoAlerts = require('./src/services/notifications/ipo-alerts');
  if (!ipoAlerts.processNewIpos) throw new Error('processNewIpos not found');
  if (!ipoAlerts.processIpoClosingReminders) throw new Error('processIpoClosingReminders not found');
});

// Test 5: Dividend alerts module
test('Dividend alerts module loads', () => {
  const dividendAlerts = require('./src/services/notifications/dividend-alerts');
  if (!dividendAlerts.processNewDividends) throw new Error('processNewDividends not found');
  if (!dividendAlerts.processNewRightShares) throw new Error('processNewRightShares not found');
});

// Test 6: Messaging module
test('Messaging module loads', () => {
  const messaging = require('./src/services/notifications/messaging');
  if (!messaging.sendIpoNotification) throw new Error('sendIpoNotification not found');
  if (!messaging.sendIpoClosingNotification) throw new Error('sendIpoClosingNotification not found');
  if (!messaging.sendDividendNotification) throw new Error('sendDividendNotification not found');
  if (!messaging.sendRightShareNotification) throw new Error('sendRightShareNotification not found');
  if (!messaging.sendPriceAlertNotification) throw new Error('sendPriceAlertNotification not found');
});

// Test 7: Templates module
test('Templates module loads', () => {
  const templates = require('./src/services/notifications/templates');
  if (!templates.formatDate) throw new Error('formatDate not found');
  if (!templates.formatShareType) throw new Error('formatShareType not found');
});

// Test 8: Template functions work correctly
test('formatDate works correctly', () => {
  const { formatDate } = require('./src/services/notifications/templates');
  const result = formatDate('2025-02-27');
  if (!result.includes('Feb') && !result.includes('27') && !result.includes('2025')) {
    throw new Error(`Unexpected format: ${result}`);
  }
  if (formatDate(null) !== 'TBD') throw new Error('formatDate(null) should return "TBD"');
  if (formatDate('invalid') !== 'TBD') throw new Error('formatDate(invalid) should return "TBD"');
});

// Test 9: File structure validation
test('Directory structure is correct', () => {
  const fs = require('fs');
  const notificationsDir = path.join(__dirname, 'src', 'services', 'notifications');
  
  if (!fs.existsSync(notificationsDir)) throw new Error('notifications directory missing');
  
  const requiredFiles = [
    'index.js',
    'price-alerts.js',
    'ipo-alerts.js',
    'dividend-alerts.js',
    'messaging.js',
    'templates.js'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(notificationsDir, file);
    if (!fs.existsSync(filePath)) throw new Error(`${file} missing`);
  }
  
  const wrapperPath = path.join(__dirname, 'src', 'services', 'notification-service.js');
  if (!fs.existsSync(wrapperPath)) throw new Error('notification-service.js wrapper missing');
  
  const backupPath = path.join(__dirname, 'src', 'services', 'notification-service.js.old');
  if (!fs.existsSync(backupPath)) throw new Error('notification-service.js.old backup missing');
});

// Test 10: Check exported functions are callable
test('Exported functions are callable', () => {
  const NotificationService = require('./src/services/notification-service');
  
  // Just check they're functions, don't actually call them (would need DB/Firebase setup)
  if (typeof NotificationService.checkAndSendNotifications !== 'function') {
    throw new Error('checkAndSendNotifications is not a function');
  }
  if (typeof NotificationService.checkAndSendPriceAlerts !== 'function') {
    throw new Error('checkAndSendPriceAlerts is not a function');
  }
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`   Passed: ${testsPassed}`);
console.log(`   Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All tests passed! Phase 5 refactoring complete.');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the errors above.');
  process.exit(1);
}
