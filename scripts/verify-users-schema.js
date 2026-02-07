const { pool } = require('../src/database/database');

async function checkSchema() {
  try {
    const [rows] = await pool.query('DESCRIBE users');
    const hasColumn = rows.some(row => row.Field === 'last_active_at');

    if (hasColumn) {
      console.log('SUCCESS: last_active_at column exists in users table.');
      process.exit(0);
    } else {
      console.error('FAILURE: last_active_at column NOT found in users table.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
}

checkSchema();
