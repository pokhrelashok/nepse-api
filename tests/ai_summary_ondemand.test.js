/**
 * Verification script for on-demand AI summary generation
 * Usage: bun tests/ai_summary_ondemand.test.js
 */

const aiAnalysisService = require('../src/services/ai-analysis-service');
const { pool } = require('../src/database/database');
const { getScriptDetails } = require('../src/database/queries');
const logger = require('../src/utils/logger');

async function testOnDemandGeneration() {
  const symbol = 'NABIL'; // Use a well-known symbol

  console.log(`\n🔍 Starting verification for dedicated AI summary endpoint for ${symbol}...`);

  try {
    // 1. Fetch initial state
    const details = await getScriptDetails(symbol);
    if (!details) {
      console.error(`❌ Could not fetch details for ${symbol}. Make sure the DB has data.`);
      process.exit(1);
    }

    console.log(`Current AI Summary: ${details.ai_summary ? 'Exists' : 'Missing'}`);
    console.log(`Last Updated At: ${details.ai_summary_updated_at || 'Never'}`);
    console.log(`Latest Business Date: ${details.business_date}`);

    // we don't want to actually call the AI in a test unless we have to, 
    // but we can test the logic by mocking or checking the flow.

    // 2. Call the new service method
    console.log('\n🚀 Calling getOrGenerateSummary...');
    const result = await aiAnalysisService.getOrGenerateSummary(details);

    if (result) {
      console.log('✅ Success! Summary returned.');
      console.log(`Summary Preview: ${result.substring(0, 50)}...`);
    } else {
      console.log('❌ Failed to get summary.');
    }

    // 3. Verify in DB
    const [rows] = await pool.execute('SELECT ai_summary, ai_summary_updated_at FROM company_details WHERE symbol = ?', [symbol]);
    if (rows.length > 0) {
      console.log('\n📊 DB Verification:');
      console.log(`DB Summary: ${rows[0].ai_summary ? 'Stored' : 'Missing'}`);
      console.log(`DB Updated At: ${rows[0].ai_summary_updated_at}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testOnDemandGeneration();
