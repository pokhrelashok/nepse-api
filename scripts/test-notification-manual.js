const NotificationService = require('../src/services/notification-service');
const { pool } = require('../src/database/database');
const { generateUuid } = require('../src/utils/uuid');

async function testNotifications() {
  try {
    console.log('🧪 Starting Notification Test...');

    // 1. Setup Test Data
    console.log('1. Setting up mock data...');

    // Mock IPO (Created "just now")
    await pool.execute('DELETE FROM ipos WHERE symbol = "TESTIPO"');
    await pool.execute(`
      INSERT INTO ipos (
        ipo_id, company_name, symbol, share_type, units, 
        opening_date, closing_date, status, created_at
      ) VALUES (
        999999, 'Test Company Ltd', 'TESTIPO', 'IPO', 100000,
        CURDATE(), CURDATE() + INTERVAL 4 DAY, 'OPEN', NOW()
      )
    `);

    // Mock User & Token (Ensure you use a REAL token if you want to receive on phone)
    // For now we assume existing user or just create one to check logic flow
    const testUserId = generateUuid();
    // Cleanup any previous run leftovers
    await pool.execute('DELETE FROM users WHERE google_id = ?', ['test_google_id']);

    await pool.execute('INSERT INTO users (id, google_id, email, display_name, notify_ipos, notify_dividends) VALUES (?, ?, ?, ?, 1, 1)', [testUserId, 'test_google_id', 'test@example.com', 'Test User']);

    // We add a fake token to see if logic attempts to send
    const fakeToken = 'fake_token_' + Date.now();
    await pool.execute('INSERT INTO notification_tokens (user_id, fcm_token, device_type) VALUES (?, ?, ?)', [testUserId, fakeToken, 'android']);

    // Mock Dividend for NICA (Assuming NICA exists or we insert it)
    await pool.execute(`
      INSERT INTO announced_dividends (
        symbol, fiscal_year, bonus_share, cash_dividend, 
        book_close_date, updated_at
      ) VALUES (
        'NICA', '2080/81', '10', '5', CURDATE(), NOW()
      ) ON DUPLICATE KEY UPDATE updated_at = NOW()
    `);

    // Mock Portfolio & Transaction for NICA
    const portfolioId = generateUuid();
    await pool.execute('INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)', [portfolioId, testUserId, 'Test Portfolio']);
    await pool.execute('INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateUuid(), portfolioId, 'NICA', 'BUY', 100, 500, new Date()]);


    // 2. Run Service
    console.log('2. Running NotificationService check...');
    await NotificationService.checkAndSendNotifications();
    console.log('✅ Service execution finished.');

    // 3. Cleanup
    console.log('3. Cleaning up test data...');
    await pool.execute('DELETE FROM ipos WHERE symbol = "TESTIPO"');
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]); // Cascades to portfolios/transactions/tokens
    // Delete NICA dividend only if it was our mock... actually simpler to leave it or filter
    // For safety in dev env, we might leave it.

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    process.exit(0);
  }
}

testNotifications();
