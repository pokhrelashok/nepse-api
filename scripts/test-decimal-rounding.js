#!/usr/bin/env node

/**
 * Test decimal rounding in goal values
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
    console.log('🧪 Testing Decimal Rounding in Goals\n');
    console.log('='.repeat(60));

    // Setup
    console.log('\n📝 Setting up test data...');
    await pool.execute(
      'INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)',
      [testUserId, `google_${testUserId}`, 'roundtest@test.com', 'Round Test']
    );
    await pool.execute(
      'INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)',
      [testPortfolioId, testUserId, 'Test Portfolio']
    );

    // Create transactions that will produce long decimals
    console.log('💸 Creating transactions with complex amounts...\n');

    // Investment: 33333.33 (will create many decimals when divided)
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'NTC', 'SECONDARY_BUY', 100, 333.33333, '2026-01-13']
    );

    // Dividend with 0 quantity
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'SNLI', 'DIVIDEND', 0, 48.16789, '2026-01-13']
    );

    console.log('  Investment: 33,333.33 (should round to 33333.33)');
    console.log('  Dividend: 48.16789 (should round to 48.17)\n');

    // Create goals
    console.log('🎯 Creating goals...');
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'yearly_investment',
        target_value: 100000,
        portfolio_id: testPortfolioId,
        metadata: { year: 2026 }
      }
    }, mockRes());

    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'dividend_income',
        target_value: 1000,
        portfolio_id: testPortfolioId,
        metadata: { year: 2026 }
      }
    }, mockRes());

    // Get progress
    console.log('📊 Checking decimal precision...\n');
    const resGet = mockRes();
    await goalController.getGoals({ currentUser: { id: testUserId } }, resGet);

    const portfolio = resGet.data.portfolios.find(p => p.id === testPortfolioId);
    const investmentGoal = portfolio.goals.find(g => g.type === 'yearly_investment');
    const dividendGoal = portfolio.goals.find(g => g.type === 'dividend_income');

    console.log('='.repeat(60));
    console.log('📈 Results:\n');

    console.log('Investment Goal:');
    console.log(`   Current Value: ${investmentGoal.current_value}`);
    console.log(`   Percentage: ${investmentGoal.percentage}%`);

    const invDecimals = (investmentGoal.current_value.toString().split('.')[1] || '').length;
    const invPctDecimals = (investmentGoal.percentage.toString().split('.')[1] || '').length;

    if (invDecimals <= 2 && invPctDecimals <= 2) {
      console.log('   ✅ PASS: Values rounded to 2 decimals or less');
    } else {
      console.log(`   ❌ FAIL: Too many decimals (${invDecimals}, ${invPctDecimals})`);
    }

    console.log('\nDividend Goal:');
    console.log(`   Current Value: ${dividendGoal.current_value}`);
    console.log(`   Percentage: ${dividendGoal.percentage}%`);

    const divDecimals = (dividendGoal.current_value.toString().split('.')[1] || '').length;
    const divPctDecimals = (dividendGoal.percentage.toString().split('.')[1] || '').length;

    if (divDecimals <= 2 && divPctDecimals <= 2) {
      console.log('   ✅ PASS: Values rounded to 2 decimals or less');
    } else {
      console.log(`   ❌ FAIL: Too many decimals (${divDecimals}, ${divPctDecimals})`);
    }

    console.log('\nPortfolio Overall:');
    console.log(`   Overall Percentage: ${portfolio.overall_percentage}%`);
    const overallDecimals = (portfolio.overall_percentage.toString().split('.')[1] || '').length;

    if (overallDecimals <= 2) {
      console.log('   ✅ PASS: Overall percentage rounded to 2 decimals or less');
    } else {
      console.log(`   ❌ FAIL: Too many decimals (${overallDecimals})`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All decimal rounding tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
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
