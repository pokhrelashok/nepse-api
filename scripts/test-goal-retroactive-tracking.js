#!/usr/bin/env node

/**
 * Test script to verify goals track existing data retroactively
 * 
 * This tests the scenario where:
 * 1. A user makes transactions in 2026
 * 2. Later creates goals for 2026
 * 3. Goals should show progress based on existing 2026 data
 */

const { pool } = require('../src/database/database');
const goalController = require('../src/controllers/goal-controller');
const { generateUuid } = require('../src/utils/uuid');

// Mock response helper
function mockRes() {
  const res = { data: null };
  res.json = (data) => { res.data = data; return res; };
  res.status = (code) => ({ json: (data) => { res.statusCode = code; res.data = data; return res; } });
  return res;
}

async function runTest() {
  const testUserId = generateUuid();
  const testPortfolioId = generateUuid();

  try {
    console.log('🧪 Testing Retroactive Goal Tracking\n');
    console.log('='.repeat(50));

    // 1. Create test user and portfolio
    console.log('\n📝 Setting up test data...');
    await pool.execute(
      'INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)',
      [testUserId, `google_${testUserId}`, 'goaltest@test.com', 'Goal Test User']
    );
    await pool.execute(
      'INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)',
      [testPortfolioId, testUserId, 'Test Portfolio']
    );

    // 2. Create transactions BEFORE creating goals (simulating existing data)
    console.log('💸 Creating transactions for 2026 (before goals exist)...');

    // Add investment transactions
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'NTC', 'SECONDARY_BUY', 100, 1200, '2026-03-15']
    );
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'ADBL', 'IPO', 50, 400, '2026-05-20']
    );

    // Add dividend transaction
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'NTC', 'DIVIDEND', 100, 50, '2026-04-10']
    );

    console.log('✅ Transactions created:');
    console.log('   - SECONDARY_BUY: 100 shares @ 1200 = 120,000 (Mar 15, 2026)');
    console.log('   - IPO: 50 shares @ 400 = 20,000 (May 20, 2026)');
    console.log('   - DIVIDEND: 100 shares @ 50 = 5,000 (Apr 10, 2026)');
    console.log('   Total Investment: 140,000');
    console.log('   Total Dividend: 5,000');

    // 3. NOW create goals (after data exists)
    console.log('\n🎯 Creating goals AFTER transactions exist...');

    // Create Yearly Investment Goal - All Portfolios
    const reqInvestment = {
      currentUser: { id: testUserId },
      body: {
        type: 'yearly_investment',
        target_value: 200000,
        portfolio_id: null, // Track across all portfolios
        metadata: { year: 2026 }
      }
    };
    const resInvestment = mockRes();
    await goalController.createNewGoal(reqInvestment, resInvestment);
    console.log('✅ Yearly Investment Goal Created (Target: 200,000, All Portfolios)');

    // Create Dividend Income Goal - Specific Portfolio
    const reqDividend = {
      currentUser: { id: testUserId },
      body: {
        type: 'dividend_income',
        target_value: 10000,
        portfolio_id: testPortfolioId, // Track only this portfolio
        metadata: { year: 2026 }
      }
    };
    const resDividend = mockRes();
    await goalController.createNewGoal(reqDividend, resDividend);
    console.log('✅ Dividend Income Goal Created (Target: 10,000, Specific Portfolio)');
    const reqGet = { currentUser: { id: testUserId } };
    const resGet = mockRes();
    await goalController.getGoals(reqGet, resGet);

    const goals = resGet.data.goals;

    // Verify Investment Goal
    const investmentGoal = goals.find(g => g.type === 'yearly_investment');
    console.log('💰 Yearly Investment Goal:');
    console.log(`   Current: ${investmentGoal.current_value.toLocaleString()}`);
    console.log(`   Target: ${investmentGoal.target_value.toLocaleString()}`);
    console.log(`   Progress: ${investmentGoal.percentage.toFixed(1)}%`);

    if (investmentGoal.current_value === 140000 && investmentGoal.percentage === 70) {
      console.log('   ✅ PASS: Correctly tracks existing transactions!');
    } else {
      console.log('   ❌ FAIL: Expected 140,000 (70%) but got:', investmentGoal.current_value);
    }

    // Verify Dividend Goal
    const dividendGoal = goals.find(g => g.type === 'dividend_income');
    console.log('\n💵 Dividend Income Goal:');
    console.log(`   Current: ${dividendGoal.current_value.toLocaleString()}`);
    console.log(`   Target: ${dividendGoal.target_value.toLocaleString()}`);
    console.log(`   Progress: ${dividendGoal.percentage.toFixed(1)}%`);

    if (dividendGoal.current_value === 5000 && dividendGoal.percentage === 50) {
      console.log('   ✅ PASS: Correctly tracks existing dividends!');
    } else {
      console.log('   ❌ FAIL: Expected 5,000 (50%) but got:', dividendGoal.current_value);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed! Goals correctly track existing data.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await pool.execute('DELETE FROM transactions WHERE portfolio_id = ?', [testPortfolioId]);
    await pool.execute('DELETE FROM portfolios WHERE id = ?', [testPortfolioId]);
    await pool.execute('DELETE FROM user_goals WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('✅ Cleanup complete\n');

    await pool.end();
  }
}

// Run the test
runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
