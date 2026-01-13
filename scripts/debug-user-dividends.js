#!/usr/bin/env node

const { pool } = require('../src/database/database');

async function checkDividends() {
  try {
    // Get the user's ID
    const [users] = await pool.execute(
      "SELECT u.id, u.email, u.display_name FROM users u ORDER BY u.created_at DESC LIMIT 5"
    );

    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    console.log('📋 Recent users:');
    users.forEach((u, i) => console.log(`   ${i + 1}. ${u.display_name || u.email} (${u.email})`));

    const userId = users[0].id;
    console.log('\n👤 Using user:', users[0].display_name || users[0].email);
    console.log('🆔 User ID:', userId);

    // Get their portfolios
    const [portfolios] = await pool.execute(
      'SELECT id, name FROM portfolios WHERE user_id = ?',
      [userId]
    );
    console.log('\n📁 Portfolios:');
    portfolios.forEach(p => console.log(`   - ${p.name} (${p.id})`));

    // Get dividend transactions for 2026
    const [dividends] = await pool.execute(
      `SELECT t.id, t.stock_symbol, t.type, t.quantity, t.price, t.date, 
              (t.price * t.quantity) as total,
              p.name as portfolio_name,
              p.id as portfolio_id
       FROM transactions t
       JOIN portfolios p ON t.portfolio_id = p.id
       WHERE p.user_id = ? 
         AND t.type = 'DIVIDEND'
         AND YEAR(t.date) = 2026
       ORDER BY t.date DESC`,
      [userId]
    );

    console.log('\n💰 Dividend Transactions for 2026:');
    if (dividends.length === 0) {
      console.log('   ⚠️  No DIVIDEND transactions found!');
    } else {
      dividends.forEach(d => {
        console.log(`   - ${d.stock_symbol}: ${d.quantity} × ${d.price} = ${d.total} (${d.date}) [${d.portfolio_name}]`);
      });
      const totalDividends = dividends.reduce((sum, d) => sum + parseFloat(d.total || 0), 0);
      console.log(`   📊 Total: ${totalDividends.toFixed(2)}`);
    }

    // Get their goals
    const [goals] = await pool.execute(
      'SELECT id, type, target_value, portfolio_id, metadata, start_date, end_date FROM user_goals WHERE user_id = ? AND type = "dividend_income"',
      [userId]
    );

    console.log('\n🎯 Dividend Income Goals:');
    if (goals.length === 0) {
      console.log('   ⚠️  No dividend income goals found!');
    } else {
      goals.forEach(g => {
        const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
        const portfolioName = g.portfolio_id
          ? portfolios.find(p => p.id === g.portfolio_id)?.name || 'Unknown'
          : 'ALL PORTFOLIOS';
        console.log(`   - Target: ${g.target_value}, Portfolio: ${portfolioName}, Year: ${meta?.year || 'N/A'}`);
        console.log(`     Dates: ${g.start_date} to ${g.end_date}`);
        console.log(`     Portfolio ID: ${g.portfolio_id || 'null (all portfolios)'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkDividends();
