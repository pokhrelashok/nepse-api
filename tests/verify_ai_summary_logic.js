/**
 * Test script to verify AI summary regeneration logic
 */
const { DateTime } = require('luxon');

// Mocked logic from ai-analysis-service.js
function checkNeedsGeneration(stockData) {
  const symbol = stockData.symbol;
  const existingSummary = stockData.ai_summary;
  const updatedAt = stockData.ai_summary_updated_at;
  const businessDate = stockData.business_date;

  let needsGeneration = !existingSummary || !updatedAt;

  if (!needsGeneration && updatedAt) {
    try {
      const nepalNow = DateTime.now().setZone('Asia/Kathmandu');
      const todayDate = nepalNow.toISODate();
      const summaryDate = DateTime.fromJSDate(new Date(updatedAt)).setZone('Asia/Kathmandu').toISODate();

      console.log(`[${symbol}] Current Nepal Date: ${todayDate}`);
      console.log(`[${symbol}] Summary Nepal Date: ${summaryDate}`);
      console.log(`[${symbol}] Business Date: ${businessDate}`);

      // Check if it's a new day
      if (summaryDate < todayDate) {
        needsGeneration = true;
        console.log(`🔄 AI summary for ${symbol} is old (${summaryDate} < ${todayDate}), should regenerate daily.`);
      }
      // Check if business data is newer than summary (fallback)
      else if (businessDate && summaryDate < businessDate) {
        needsGeneration = true;
        console.log(`🔄 AI summary for ${symbol} is stale (${summaryDate} < ${businessDate}), should regenerate.`);
      }
    } catch (e) {
      console.warn(`Failed to parse summary date for ${symbol}, forcing regeneration`);
      needsGeneration = true;
    }
  }

  return needsGeneration;
}

// Test Cases
const tests = [
  {
    name: "New stock (no summary)",
    data: { symbol: 'SAMPLE1', ai_summary: null, ai_summary_updated_at: null, business_date: '2026-01-11' },
    expected: true
  },
  {
    name: "Summary from yesterday",
    data: {
      symbol: 'SAMPLE2',
      ai_summary: 'Existing summary',
      ai_summary_updated_at: DateTime.now().minus({ days: 1 }).toJSDate(),
      business_date: '2026-01-10'
    },
    expected: true
  },
  {
    name: "Summary from today, business date matches",
    data: {
      symbol: 'SAMPLE3',
      ai_summary: 'Existing summary',
      ai_summary_updated_at: new Date(),
      business_date: DateTime.now().setZone('Asia/Kathmandu').toISODate()
    },
    expected: false
  },
  {
    name: "Summary from today, but business date is newer (unlikely but check)",
    data: {
      symbol: 'SAMPLE4',
      ai_summary: 'Existing summary',
      ai_summary_updated_at: new Date(),
      business_date: DateTime.now().plus({ days: 1 }).toISODate()
    },
    expected: true
  }
];

console.log("--- Starting AI Summary Logic Verification ---");
tests.forEach(test => {
  console.log(`\nTest: ${test.name}`);
  const result = checkNeedsGeneration(test.data);
  console.log(`Result: ${result}, Expected: ${test.expected} -> ${result === test.expected ? '✅ PASS' : '❌ FAIL'}`);
});
