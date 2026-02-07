const { getUsersForAdmin, getUserCountForAdmin } = require('../src/database/admin/admin-queries');
const { pool } = require('../src/database/database');

async function verifyFilters() {
  try {
    // 1. Setup: Ensure at least one user has last_active_at = NOW()
    console.log('Setting up test data...');
    const [users] = await pool.query('SELECT id FROM users LIMIT 1');

    if (users.length === 0) {
      console.log('No users found. Creating a dummy user...');
      await pool.query(`
        INSERT INTO users (id, google_id, email, display_name, last_active_at)
        VALUES ('test-user-id', 'test-google-id', 'test@example.com', 'Test User', NOW())
      `);
    } else {
      console.log(`Updating user ${users[0].id} to be active now...`);
      await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [users[0].id]);
    }

    // 2. Test active_today
    console.log('\nTesting active_today filter...');
    const activeToday = await getUsersForAdmin(10, 0, 'active_today');
    console.log(`Found ${activeToday.length} users active today.`);
    if (activeToday.length > 0 && activeToday[0].last_active_at) {
      console.log('SUCCESS: User found and last_active_at is present.');
    } else {
      console.error('FAILURE: No users found or last_active_at missing for active_today.');
    }
    const countToday = await getUserCountForAdmin('active_today');
    console.log(`Count active today: ${countToday}`);

    // 3. Test active_this_week
    console.log('\nTesting active_this_week filter...');
    const activeWeek = await getUsersForAdmin(10, 0, 'active_this_week');
    console.log(`Found ${activeWeek.length} users active this week.`);
    if (activeWeek.length > 0) {
      console.log('SUCCESS: Users found for active_this_week.');
    } else {
      console.error('FAILURE: No users found for active_this_week.');
    }

    // 4. Test all
    console.log('\nTesting all filter...');
    const allUsers = await getUsersForAdmin(10, 0, 'all');
    if (allUsers.length > 0) {
      console.log(`SUCCESS: Found ${allUsers.length} total users.`);
    } else {
      console.error('FAILURE: No users found for all filter.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyFilters();
