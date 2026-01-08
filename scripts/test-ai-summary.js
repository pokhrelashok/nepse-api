/**
 * Test AI Summary Generation
 * Run with: bun scripts/test-ai-summary.js [symbol]
 * Example: bun scripts/test-ai-summary.js NABIL
 */

const { getScriptDetails } = require('../src/database/queries');
const { generateStockSummary } = require('../src/services/ai-analysis-service');
const { pool } = require('../src/database/database');

async function testAISummary() {
  const testSymbol = process.argv[2] || 'NABIL';

  console.log(`🧪 Testing AI Summary Generation for ${testSymbol}...\n`);

  try {
    console.log(`📊 Fetching details for ${testSymbol}...`);
    const stockData = await getScriptDetails(testSymbol);

    if (!stockData) {
      console.error(`❌ Stock ${testSymbol} not found`);
      process.exit(1);
    }

    console.log(`✅ Found stock: ${stockData.company_name}`);
    console.log(`   LTP: ${stockData.last_traded_price || stockData.ltp}`);
    console.log(`   Market Cap: ${stockData.market_capitalization}`);
    console.log(`   PE Ratio: ${stockData.pe_ratio}`);
    console.log(`   PB Ratio: ${stockData.pb_ratio}`);
    console.log(`   Dividend Yield: ${stockData.dividend_yield}%`);
    console.log(`   Sector: ${stockData.sector_name}\n`);

    console.log('🤖 Generating AI summary...');
    const summary = await generateStockSummary(stockData);

    if (summary) {
      console.log('\n✅ AI Summary Generated:');
      console.log('─'.repeat(60));
      console.log(summary);
      console.log('─'.repeat(60));

      // Save to database
      console.log('\n💾 Saving to database...');
      await pool.execute(
        'UPDATE company_details SET ai_summary = ? WHERE symbol = ?',
        [summary, testSymbol]
      );
      console.log('✅ Saved successfully!');

      // Verify it was saved
      const [rows] = await pool.execute(
        'SELECT ai_summary FROM company_details WHERE symbol = ?',
        [testSymbol]
      );

      if (rows[0]?.ai_summary) {
        console.log('\n✅ Verification: AI summary found in database');
      } else {
        console.log('\n❌ Verification failed: AI summary not in database');
      }
    } else {
      console.error('\n❌ Failed to generate AI summary');
      console.log('Check that DEEPSEEK_API_KEY is set in .env');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testAISummary();
