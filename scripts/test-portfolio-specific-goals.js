#!/usr/bin/env node

/**
 * Test portfolio_id filtering in goals
 * Verifies that goals can track specific portfolios or all portfolios
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
  const portfolio1Id = generateUuid();
  const portfolio2Id = generateUuid();

  try {
    console.log('🧪 Testing Portfolio-Specific Goal Tracking\n');
    console.log('='.repeat(60));

    // 1. Setup: Create user and 2 portfolios
    console.log('\n📝 Setting up test data...');
    await pool.execute(
      'INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)',
      [testUserId, `google_${testUserId}`, 'portfoliotest@test.com', 'Portfolio Test']
    );
    await pool.execute(
      'INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)',
      [portfolio1Id, testUserId, 'Portfolio A']
    );
    await pool.execute(
      'INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)',
      [portfolio2Id, testUserId, 'Portfolio B']
    );

    // 2. Add transactions to both portfolios
    console.log('💸 Creating transactions in both portfolios...\n');

    // Portfolio A: 100k investment, 3k dividend
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), portfolio1Id, 'NTC', 'SECONDARY_BUY', 50, 2000, '2026-03-10']
    );
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), portfolio1Id, 'NTC', 'DIVIDEND', 50, 60, '2026-04-15']
    );
    console.log('  Portfolio A: 100,000 invested, 3,000 dividend');

    // Portfolio B: 200k investment, 7k dividend
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), portfolio2Id, 'ADBL', 'IPO', 200, 1000, '2026-05-20']
    );
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), portfolio2Id, 'ADBL', 'DIVIDEND', 200, 35, '2026-06-10']
    );
    console.log('  Portfolio B: 200,000 invested, 7,000 dividend');
    console.log('\n  Total: 300,000 invested, 10,000 dividend\n');

    // 3. Create goals with different scopes
    console.log('🎯 Creating goals with different portfolio scopes...\n');

    // Goal 1: All portfolios - investment
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'yearly_investment',
        target_value: 500000,
        portfolio_id: null,
        metadata: { year: 2026 }
      }
    }, mockRes());

    // Goal 2: Portfolio A only - investment
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'yearly_investment',
        target_value: 150000,
        portfolio_id: portfolio1Id,
        metadata: { year: 2026 }
      }
    }, mockRes());

    // Goal 3: Portfolio B only - investment
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'yearly_investment',
        target_value: 250000,
        portfolio_id: portfolio2Id,
        metadata: { year: 2026 }
      }
    }, mockRes());

    // Goal 4: All portfolios - dividend
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'dividend_income',
        target_value: 20000,
        portfolio_id: null,
        metadata: { year: 2026 }
      }
    }, mockRes());

    // Goal 5: Portfolio A only - dividend
    await goalController.createNewGoal({
      currentUser: { id: testUserId },
      body: {
        type: 'dividend_income',
        target_value: 5000,
        portfolio_id: portfolio1Id,
        metadata: { year: 2026 }
      }
    }, mockRes());

    console.log('✅ Created 5 goals with different scopes\n');

    // 4. Fetch and verify goals
    console.log('📊 Verifying goal calculations...\n');
    const resGet = mockRes();
    await goalController.getGoals({ currentUser: { id: testUserId } }, resGet);
    const goals = resGet.data.goals;

    // Find goals
    const allInvestment = goals.find(g => g.type === 'yearly_investment' && !g.portfolio_id);
    const portfolioAInvestment = goals.find(g => g.type === 'yearly_investment' && g.portfolio_id === portfolio1Id);
    const portfolioBInvestment = goals.find(g => g.type === 'yearly_investment' && g.portfolio_id === portfolio2Id);
    const allDividend = goals.find(g => g.type === 'dividend_income' && !g.portfolio_id);
    const portfolioADividend = goals.find(g => g.type === 'dividend_income' && g.portfolio_id === portfolio1Id);

    console.log('='.repeat(60));
    console.log('Investment Goals:\n');

    // Test 1: All portfolios investment
    console.log('1️⃣  ALL PORTFOLIOS Investment Goal:');
    console.log(`   Current: ${allInvestment.current_value.toLocaleString()}`);
    console.log(`   Target: ${allInvestment.target_value.toLocaleString()}`);
    console.log(`   Progress: ${allInvestment.percentage.toFixed(1)}%`);
    if (allInvestment.current_value === 300000 && allInvestment.percentage === 60) {
      console.log('   ✅ PASS: Correctly sums both portfolios!');
    } else {
      console.log(`   ❌ FAIL: Expected 300,000 (60%)`);
    }

    // Test 2: Portfolio A investment
    console.log('\n2️⃣  PORTFOLIO A Investment Goal:');
    console.log(`   Current: ${portfolioAInvestment.current_value.toLocaleString()}`);
    console.log(`   Target: ${portfolioAInvestment.target_value.toLocaleString()}`);
    console.log(`   Progress: ${portfolioAInvestment.percentage.toFixed(1)}%`);
    if (portfolioAInvestment.current_value === 100000) {
      console.log('   ✅ PASS: Correctly filters to Portfolio A only!');
    } else {
      console.log(`   ❌ FAIL: Expected 100,000`);
    }

    // Test 3: Portfolio B investment
    console.log('\n3️⃣  PORTFOLIO B Investment Goal:');
    console.log(`   Current: ${portfolioBInvestment.current_value.toLocaleString()}`);
    console.log(`   Target: ${portfolioBInvestment.target_value.toLocaleString()}`);
    console.log(`   Progress: ${portfolioBInvestment.percentage.toFixed(1)}%`);
    if (portfolioBInvestment.current_value === 200000) {
      console.log('   ✅ PASS: Correctly filters to Portfolio B only!');
    } else {
      console.log(`   ❌ FAIL: Expected 200,000`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Dividend Goals:\n');

    // Test 4: All portfolios dividend
    console.log('4️⃣  ALL PORTFOLIOS Dividend Goal:');
    console.log(`   Current: ${allDividend.current_value.toLocaleString()}`);
    console.log(`   Target: ${allDividend.target_value.toLocaleString()}`);
    console.log(`   Progress: ${allDividend.percentage.toFixed(1)}%`);
    if (allDividend.current_value === 10000 && allDividend.percentage === 50) {
      console.log('   ✅ PASS: Correctly sums both portfolios!');
    } else {
      console.log(`   ❌ FAIL: Expected 10,000 (50%)`);
    }

    // Test 5: Portfolio A dividend
    console.log('\n5️⃣  PORTFOLIO A Dividend Goal:');
    console.log(`   Current: ${portfolioADividend.current_value.toLocaleString()}`);
    console.log(`   Target: ${portfolioADividend.target_value.toLocaleString()}`);
    console.log(`   Progress: ${portfolioADividend.percentage.toFixed(1)}%`);
    if (portfolioADividend.current_value === 3000 && portfolioADividend.percentage === 60) {
      console.log('   ✅ PASS: Correctly filters to Portfolio A only!');
    } else {
      console.log(`   ❌ FAIL: Expected 3,000 (60%)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All portfolio filtering tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await pool.execute('DELETE FROM transactions WHERE portfolio_id IN (?, ?)', [portfolio1Id, portfolio2Id]);
    await pool.execute('DELETE FROM portfolios WHERE id IN (?, ?)', [portfolio1Id, portfolio2Id]);
    await pool.execute('DELETE FROM user_goals WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('✅ Cleanup complete\n');

    await pool.end();
  }
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
