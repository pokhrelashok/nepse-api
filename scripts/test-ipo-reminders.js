const { pool } = require('../src/database/database');
const NotificationService = require('../src/services/notification-service');
const logger = require('../src/utils/logger');

async function testIpoReminders() {
  logger.info('🧪 Starting IPO Closing Reminder Test...');

  const testIpoId = 999999;
  const testSymbol = 'TEST_IPO';

  try {
    // 1. Cleanup specific test data just in case
    await pool.execute('DELETE FROM ipos WHERE ipo_id = ?', [testIpoId]);

    // 2. Insert a dummy IPO closing TODAY
    // We use "Ordinary" share type as it's common
    logger.info('Inserting dummy IPO closing today...');
    await pool.execute(`
      INSERT INTO ipos (
        ipo_id, company_name, symbol, share_type, 
        closing_date, status, created_at
      ) VALUES (
        ?, 'Test Company (Closing Today)', ?, 'Ordinary Shares', 
        CURDATE(), 'Open', NOW()
      )
    `, [testIpoId, testSymbol]);

    // 3. Ensure we have at least one user subscribed to 'ordinary' IPOs
    // For this test, we just check if any exist. If not, we warn.
    const [users] = await pool.execute(`
      SELECT COUNT(*) as count FROM users 
      WHERE notify_ipos = TRUE 
      AND JSON_CONTAINS(ipo_notification_types, '"ordinary"')
    `);

    if (users[0].count === 0) {
      logger.warn('⚠️ No users subscribed to Ordinary IPOs. Test will not send actual FCM messages.');
    } else {
      logger.info(`ℹ️ Found ${users[0].count} users subscribed to Ordinary IPOs.`);
    }

    // 4. Run the reminder process
    logger.info('🚀 Running processIpoClosingReminders()...');
    await NotificationService.processIpoClosingReminders();

    logger.info('✅ Test function executed.');

  } catch (error) {
    logger.error('❌ Test failed:', error);
  } finally {
    // 5. Cleanup
    logger.info('🧹 Cleaning up test data...');
    await pool.execute('DELETE FROM ipos WHERE ipo_id = ?', [testIpoId]);
    await pool.end();
  }
}

// Run
testIpoReminders();
