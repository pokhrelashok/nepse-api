/**
 * Show the actual database schema for company_details table
 */

const { pool } = require('../src/database/database');

async function showSchema() {
  try {
    console.log('\n📋 company_details table schema:\n');

    const [columns] = await pool.execute('DESCRIBE company_details');

    console.log('Column Name                  | Type              | Null | Key | Default | Extra');
    console.log('---------------------------- | ----------------- | ---- | --- | ------- | -----');

    columns.forEach(col => {
      const name = (col.Field || '').padEnd(28);
      const type = (col.Type || '').padEnd(17);
      const nullable = (col.Null || '').padEnd(4);
      const key = (col.Key || '').padEnd(3);
      const def = (col.Default || 'NULL').padEnd(7);
      const extra = col.Extra || '';

      console.log(`${name} | ${type} | ${nullable} | ${key} | ${def} | ${extra}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

showSchema();
