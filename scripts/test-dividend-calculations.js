#!/usr/bin/env node

/**
 * Test dividend income calculation with different quantity scenarios
 */

const { pool } = require('../src/database/database');
const goalController = require('../src/controllers/goal-controller');
const { generateUuid } = require('../src/utils/uuid');

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
    console.log('🧪 Testing Dividend Income Calculation Scenarios\n');
    console.log('='.repeat(60));

    // Setup
    console.log('\n📝 Setting up test data...');
    await pool.execute(
      'INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)',
      [testUserId, `google_${testUserId}`, 'divtest@test.com', 'Dividend Test']
    );
    await pool.execute(
      'INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)',
      [testPortfolioId, testUserId, 'Test Portfolio']
    );

    // Create dividend transactions with different scenarios
    console.log('💰 Creating dividend transactions with different formats...\n');
    
    // Scenario 1: quantity = 0, price = total amount (YOUR CASE)
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'SNLI', 'DIVIDEND', 0, 48.16, '2026-01-13']
    );
    console.log('  ✅ SNLI: quantity=0, price=48.16 (total amount in price field)');

    // Scenario 2: quantity = 1, price = total amount
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'NTC', 'DIVIDEND', 1, 1000, '2026-02-15']
    );
    console.log('  ✅ NTC: quantity=1, price=1000 (total amount)');

    // Scenario 3: quantity = shares, price = dividend per share
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'ADBL', 'DIVIDEND', 100, 50, '2026-03-20']
    );
    console.log('  ✅ ADBL: quantity=100, price=50 (100 shares × 50 per share = 5000)');

    console.log('\n  Expected Total: 48.16 + 1000 + 5000 = 6,048.16\n');

    // Create goal
    console.log('🎯 Creating dividend income goal...');
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'dividend_income',
        target_value: 10000,
        portfolio_id: null,
        metadata: { year: 2026 }
      }
    }, mockRes());

    // Get progress
    console.log('📊 Calculating progress...\n');
    const resGet = mockRes();
    await goalController.getGoals({ currentUser: { id: testUserId } }, resGet);
    const goal = resGet.data.goals[0];

    console.log('=' .repeat(60));
    console.log('📈 Result:');
    console.log(`   Current Value: ${goal.current_value.toLocaleString()}`);
    console.log(`   Target: ${goal.target_value.toLocaleString()}`);
    console.log(`   Progress: ${goal.percentage.toFixed(2)}%`);

    if (Math.abs(goal.current_value - 6048.16) < 0.01) {
      console.log('\n✅ PASS: Correctly calculates dividends for all scenarios!');
      console.log('   - Handles quantity=0 (price as total)');
      console.log('   - Handles quantity=1 (price as total)');
      console.log('   - Handles quantity>1 (price per share × quantity)');
    } else {
      console.log(`\n❌ FAIL: Expected 6048.16, got ${goal.current_value}`);
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await pool.execute('DELETE FROM transactions WHERE portfolio_id = ?', [testPortfolioId]);
    await pool.execute('DELETE FROM portfolios WHERE id = ?', [testPortfolioId]);
    await pool.execute('DELETE FROM user_goals WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('✅ Done\n');
    
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
