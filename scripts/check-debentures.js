const { pool } = require('../src/database/database');

async function checkDebentures() {
  try {
    console.log('🔍 Checking for Company Debentures and Bonds...');
    const [rows] = await pool.execute(
      "SELECT security_id, symbol, company_name, instrument_type, sector_name FROM company_details WHERE instrument_type LIKE '%Debenture%' OR instrument_type LIKE '%Bond%' LIMIT 10"
    );

    console.log(`Found ${rows.length} debentures/bonds:`);
    rows.forEach(row => {
      console.log(`- [${row.symbol}] ${row.company_name} (${row.instrument_type})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkDebentures();
