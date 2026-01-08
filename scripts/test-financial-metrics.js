/**
 * Test Financial Metrics Service
 * Run with: bun scripts/test-financial-metrics.js [symbol]
 * Example: bun scripts/test-financial-metrics.js NABIL
 */

const { updateMetricsForCompany, updateMetricsForAll } = require('../src/services/financial-metrics-service');
const logger = require('../src/utils/logger');

async function testMetrics() {
  const symbol = process.argv[2];

  if (symbol) {
    // Test single company
    console.log(`\n🧪 Testing metrics calculation for ${symbol}...\n`);

    // Get security_id for the symbol
    const { pool } = require('../src/database/database');
    const [rows] = await pool.execute(
      'SELECT security_id FROM company_details WHERE symbol = ?',
      [symbol]
    );

    if (rows.length === 0) {
      console.error(`❌ Symbol ${symbol} not found`);
      process.exit(1);
    }

    const securityId = rows[0].security_id;
    const metrics = await updateMetricsForCompany(securityId, symbol);

    if (metrics) {
      console.log('\n✅ Metrics calculated and saved:');
      console.log(`   Market Cap: ${metrics.market_capitalization}`);
      console.log(`   PE Ratio: ${metrics.pe_ratio}`);
      console.log(`   PB Ratio: ${metrics.pb_ratio}`);
      console.log(`   Dividend Yield: ${metrics.dividend_yield}%`);
    } else {
      console.error('\n❌ Failed to calculate metrics');
    }
  } else {
    // Test all companies
    console.log('\n🧪 Testing metrics calculation for ALL companies...\n');
    const summary = await updateMetricsForAll();

    console.log('\n✅ Batch calculation complete:');
    console.log(`   Total: ${summary.total}`);
    console.log(`   Success: ${summary.success}`);
    console.log(`   Failed: ${summary.failed}`);
  }

  process.exit(0);
}

testMetrics().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
