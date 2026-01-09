/**
 * Check companies with missing security_id
 * Run with: bun scripts/check-missing-security-id.js
 */

const { pool } = require('../src/database/database');
const logger = require('../src/utils/logger');

async function checkCompanies() {
  const symbols = ['NMIC', 'KBSH', 'NICLBSL', 'GCIL', 'PFL'];

  console.log('\n🔍 Checking companies with errors...\n');

  for (const symbol of symbols) {
    console.log(`\n--- ${symbol} ---`);

    // Check company_details
    const [companyRows] = await pool.execute(
      'SELECT security_id, symbol, company_name FROM company_details WHERE symbol = ?',
      [symbol]
    );

    if (companyRows.length === 0) {
      console.log('❌ Not found in company_details');
    } else {
      const company = companyRows[0];
      console.log(`✅ Found in company_details:`);
      console.log(`   security_id: ${company.security_id}`);
      console.log(`   company_name: ${company.company_name}`);

      // Check if security_id is null
      if (!company.security_id) {
        console.log('⚠️  security_id is NULL!');
      }
    }

    // Check stock_prices
    const [priceRows] = await pool.execute(
      'SELECT security_id, symbol FROM stock_prices WHERE symbol = ? LIMIT 1',
      [symbol]
    );

    if (priceRows.length > 0) {
      console.log(`📊 Found in stock_prices with security_id: ${priceRows[0].security_id}`);
    } else {
      console.log('📊 Not found in stock_prices');
    }

    // Check dividends
    const [divRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM dividends WHERE security_id IN (SELECT security_id FROM company_details WHERE symbol = ?)',
      [symbol]
    );
    console.log(`💰 Dividend records: ${divRows[0].count}`);

    // Check financials
    const [finRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM company_financials WHERE security_id IN (SELECT security_id FROM company_details WHERE symbol = ?)',
      [symbol]
    );
    console.log(`📈 Financial records: ${finRows[0].count}`);
  }

  console.log('\n\n🔍 Looking for companies with NULL security_id...\n');
  const [nullRows] = await pool.execute(
    'SELECT symbol, company_name FROM company_details WHERE security_id IS NULL OR security_id = 0 LIMIT 20'
  );

  if (nullRows.length > 0) {
    console.log(`Found ${nullRows.length} companies with NULL/0 security_id:`);
    nullRows.forEach(row => {
      console.log(`  - ${row.symbol}: ${row.company_name}`);
    });
  } else {
    console.log('✅ No companies with NULL security_id found');
  }

  await pool.end();
}

checkCompanies().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
