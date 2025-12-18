const { pool } = require('./src/database/database');

async function getUserTokens(search) {
  try {
    if (!search) {
      console.log('Please provide an email or user ID as an argument.');
      console.log('Usage: node scripts/get-user-tokens.js <email_or_id>');
      process.exit(1);
    }

    console.log(`Searching for user: ${search}`);

    // Try to find user by email or ID
    const [users] = await pool.execute(
      'SELECT id, email, display_name FROM users WHERE email = ? OR id = ?',
      [search, search]
    );

    if (users.length === 0) {
      console.log('User not found.');
      process.exit(0);
    }

    const user = users[0];
    console.log('Found User:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.display_name}`);

    // Get FCM Tokens
    const [tokens] = await pool.execute(
      'SELECT fcm_token, device_type, updated_at FROM notification_tokens WHERE user_id = ? ORDER BY updated_at DESC',
      [user.id]
    );

    if (tokens.length === 0) {
      console.log('\nNo FCM tokens found for this user.');
    } else {
      console.log(`\nFound ${tokens.length} FCM Tokens:`);
      tokens.forEach((t, i) => {
        console.log(`\nToken #${i + 1} (${t.device_type}):`);
        console.log(`  ${t.fcm_token}`);
        console.log(`  Last Updated: ${t.updated_at}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get search term from command line args
const search = process.argv[2];
getUserTokens(search);
