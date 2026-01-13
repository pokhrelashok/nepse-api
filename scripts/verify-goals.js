const { pool } = require('../src/database/database');
const { generateUuid } = require('../src/utils/uuid');
const goalQueries = require('../src/database/queries/goal-queries');
const goalController = require('../src/controllers/goal-controller');

// Mock req, res for controller
const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function runTest() {
  console.log('🚀 Starting Verification: Goals Feature');
  const testUserId = generateUuid();
  const testPortfolioId = generateUuid();

  try {
    // 1. Setup Test User & Portfolio
    console.log('📝 Setting up test user...');
    await pool.execute(
      'INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)',
      [testUserId, 'test-goal-user', 'test-goal@example.com', 'Test Goal User']
    );
    await pool.execute(
      'INSERT INTO portfolios (id, user_id, name) VALUES (?, ?, ?)',
      [testPortfolioId, testUserId, 'Goal Test Portfolio']
    );

    // 2. Test Goal Creation (Yearly Investment)
    console.log('🎯 Testing Goal Creation...');
    const reqCreate = {
      currentUser: { id: testUserId },
      body: {
        type: 'yearly_investment',
        target_value: 100000,
        metadata: { year: 2026 }
      }
    };
    const resCreate = mockRes();
    await goalController.createNewGoal(reqCreate, resCreate);

    if (resCreate.data.success) {
      console.log('✅ Goal Created:', resCreate.data.goal.id);
    } else {
      console.error('❌ Goal Creation Failed:', resCreate.data);
      process.exit(1);
    }

    // 3. Test Progress (Initial - Should be 0)
    console.log('📊 Testing Initial Progress...');
    const reqGet = { currentUser: { id: testUserId } };
    const resGet = mockRes();
    await goalController.getGoals(reqGet, resGet);

    const goal = resGet.data.goals[0];
    if (goal.current_value === 0 && goal.percentage === 0) {
      console.log('✅ Initial progress is correct (0%)');
    } else {
      console.error('❌ Initial progress incorrect:', goal);
    }

    // 4. Add Transaction to influence progress
    console.log('💸 Adding Transaction...');
    await pool.execute(
      `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUuid(), testPortfolioId, 'NTC', 'SECONDARY_BUY', 50, 1000, '2026-05-20']
    );

    // 5. Check Progress Updated
    console.log('🔄 Checking Updated Progress...');
    await goalController.getGoals(reqGet, resGet);
    const updatedGoal = resGet.data.goals[0];

    // Target 100k, Invested 50k -> Should be 50%
    if (updatedGoal.percentage === 50) {
      console.log('✅ Progress calculation correct (50%)');
    } else {
      console.error('❌ Progress calculation incorrect. Expected 50%, got:', updatedGoal.percentage);
    }

    // 6. Test Stock Accumulation Goal
    console.log('📦 Testing Stock Accumulation Goal...');
    const reqStock = {
      currentUser: { id: testUserId },
      body: {
        type: 'stock_accumulation',
        target_value: 100, // Target 100 shares
        metadata: { symbol: 'NTC' }
      }
    };
    const resStock = mockRes();
    await goalController.createNewGoal(reqStock, resStock);

    await goalController.getGoals(reqGet, resGet);
    const stockGoal = resGet.data.goals.find(g => g.type === 'stock_accumulation');

    // Should have 50 shares from the transaction above
    if (stockGoal.current_value === 50 && stockGoal.percentage === 50) {
      console.log('✅ Stock Accumulation progress correct (50%)');
    } else {
      console.error('❌ Stock Accumulation incorrect:', stockGoal);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    // console.log('🧹 Cleaning up...');
    // await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]); // Cascade should handle the rest
    await pool.end();
  }
}

runTest();
