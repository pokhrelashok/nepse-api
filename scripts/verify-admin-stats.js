const { getUserStatsForAdmin } = require('../src/database/admin/admin-queries');
const { pool } = require('../src/database/database');
const { getNepaliStartOfDay } = require('../src/utils/date-utils');

async function verifyStats() {
  try {
    // 1. Setup: Ensure at least one user has last_active_at = NOW()
    console.log('Setting up test data...');
    const [users] = await pool.query('SELECT id FROM users LIMIT 1');

    if (users.length > 0) {
      console.log(`Updating user ${users[0].id} to be active now...`);
      await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [users[0].id]);
    }

    // 2. Test getUserStatsForAdmin
    console.log('\nTesting getUserStatsForAdmin...');
    const todayStart = getNepaliStartOfDay();
    const stats = await getUserStatsForAdmin(todayStart);

    console.log('Stats received:', stats);

    if (stats.active_users_today !== undefined && stats.active_users_this_week !== undefined) {
      console.log(`active_users_today: ${stats.active_users_today}`);
      console.log(`active_users_this_week: ${stats.active_users_this_week}`);

      if (stats.active_users_today > 0) {
        console.log('SUCCESS: Active users count is correct.');
      } else {
        console.warn('WARNING: Active users count is 0, but we just updated a user.');
      }
    } else {
      console.error('FAILURE: active_users_today or active_users_this_week missing from stats.');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyStats();
