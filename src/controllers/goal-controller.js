const {
  createGoal,
  updateGoal,
  getGoal,
  getActiveGoals,
  getGoalHistory,
  deleteGoal
} = require('../database/queries/goal-queries');
const { pool } = require('../database/database');
const logger = require('../utils/logger');
const { validate } = require('../utils/validator');

/**
 * Get all active goals with current progress
 */
async function getGoals(req, res) {
  const userId = req.currentUser.id;

  try {
    const goals = await getActiveGoals(userId);

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
      const progress = await calculateProgress(userId, goal);
      return {
        ...goal,
        current_value: progress.current_value,
        percentage: progress.percentage,
        is_completed: progress.is_completed,
        milestones: progress.milestones || []
      };
    }));

    res.json({
      success: true,
      goals: goalsWithProgress
    });
  } catch (error) {
    logger.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Create a new goal
 */
async function createNewGoal(req, res) {
  const userId = req.currentUser.id;
  const { isValid, error, data } = validate(req.body, {
    type: { type: 'string', required: true },
    target_value: { type: 'number', required: true },
    start_date: { type: 'string' }, // Optional
    end_date: { type: 'string' }, // Optional
    metadata: { type: 'object' } // Optional
  });

  if (!isValid) return res.status(400).json({ error });

  try {
    // Validate type-specific requirements
    if (data.type === 'stock_accumulation' && (!data.metadata || !data.metadata.symbol)) {
      return res.status(400).json({ error: 'Symbol is required for stock accumulation goals' });
    }

    // Default dates if needed (e.g., for yearly goals)
    if (data.type.startsWith('yearly_')) {
      const year = data.metadata?.year || new Date().getFullYear();
      if (!data.start_date) data.start_date = `${year}-01-01`;
      if (!data.end_date) data.end_date = `${year}-12-31`;

      // Ensure metadata has year
      data.metadata = { ...data.metadata, year };
    }

    const goal = await createGoal(userId, data);
    res.json({ success: true, goal });
  } catch (error) {
    logger.error('Error creating goal:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Update a goal
 */
async function updateGoalDetails(req, res) {
  const userId = req.currentUser.id;
  const goalId = req.params.id;

  try {
    const existing = await getGoal(goalId);
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = await updateGoal(goalId, userId, req.body);
    res.json({ success: true, goal });
  } catch (error) {
    logger.error('Error updating goal:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Delete a goal
 */
async function removeGoal(req, res) {
  const userId = req.currentUser.id;
  const goalId = req.params.id;

  try {
    const success = await deleteGoal(goalId, userId);
    if (!success) return res.status(404).json({ error: 'Goal not found' });

    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    logger.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// --- Helper: Calculate Progress ---

async function calculateProgress(userId, goal) {
  let currentValue = 0;

  try {
    switch (goal.type) {
      case 'yearly_investment':
        currentValue = await getYearlyInvestment(userId, goal);
        break;

      case 'yearly_profit':
        currentValue = await getYearlyProfit(userId, goal);
        break;

      case 'stock_accumulation':
        currentValue = await getStockHoldings(userId, goal);
        break;

      case 'portfolio_value':
        currentValue = await getTotalPortfolioValue(userId);
        break;

      case 'diversification':
        currentValue = await getSectorCount(userId);
        break;

      case 'dividend_income':
        currentValue = await getDividendIncome(userId, goal);
        break;
    }
  } catch (e) {
    logger.error(`Error calculating progress for goal ${goal.id}:`, e);
  }

  const target = parseFloat(goal.target_value);
  const percentage = Math.min(100, Math.max(0, (currentValue / target) * 100));
  const is_completed = currentValue >= target;

  return {
    current_value: currentValue,
    percentage,
    is_completed
  };
}

// --- Specific Calculation Functions ---

async function getYearlyInvestment(userId, goal) {
  const year = goal.metadata?.year || new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Sum of BUY transactions (SECONDARY_BUY, IPO, FPO, RIGHTS, AUCTION)
  const sql = `
    SELECT SUM(price * quantity) as total 
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    WHERE p.user_id = ? 
      AND t.type IN ('SECONDARY_BUY', 'IPO', 'FPO', 'RIGHTS', 'AUCTION')
      AND t.date BETWEEN ? AND ?
  `;

  const [rows] = await pool.execute(sql, [userId, startDate, endDate]);
  return rows[0].total || 0;
}

async function getYearlyProfit(userId, goal) {
  // Logic: Realized Profit (from transactions) + Unrealized Profit (current holdings)
  // Simplified for now: Just calculate Total Profit from all portfolios? 
  // Or strictly profit generated THIS year? 
  // Strictly yearly profit is hard for Unrealized. 
  // Let's assume this means "Total Portfolio Profit Target" for simplicity if no specific year logic
  // OR if year is present, Realized Profit in that year.

  // For now: Total Realized Profit in Year
  const year = goal.metadata?.year || new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Realized profit from sell transactions
  // Simplified: (Sell Price - WACC) * Qty. 
  // We'll trust the stored 'amount' vs valid cost logic if available, 
  // but usually we calculate on the fly.

  // Note: Nepse API usually doesn't store realized profit per txn directly unless we calculated it.
  // For MVP, let's use Total Portfolio Profit (Realized + Unrealized) if it's a "Net Worth" style goal,
  // But since it's "Yearly Profit", let's sum Realized Gains for the year.

  const sql = `
    SELECT SUM( (rate - 100) * quantity ) as rough_profit -- VERY ROUGH APPROXIMATION
    FROM transactions
    WHERE 1=0 -- Placeholder: Needs proper realized gain logic which is complex
  `;

  // Alternative: Just return 0 for now until Realized Gain module is robust
  return 0;
}

async function getStockHoldings(userId, goal) {
  const symbol = goal.metadata?.symbol;
  if (!symbol) return 0;

  // Sum quantity of specific stock across all portfolios (Buy - Sell + Bonus)
  const sql = `
    SELECT 
      SUM(CASE WHEN type IN ('SECONDARY_BUY', 'IPO', 'FPO', 'RIGHTS', 'AUCTION', 'BONUS') THEN quantity ELSE 0 END) - 
      SUM(CASE WHEN type = 'SECONDARY_SELL' THEN quantity ELSE 0 END) as net_qty
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    WHERE p.user_id = ? AND t.stock_symbol = ?
  `;

  const [rows] = await pool.execute(sql, [userId, symbol]);
  return rows[0].net_qty || 0;
}

async function getTotalPortfolioValue(userId) {
  // Sum of (Current Price * Quantity) for all holdings
  // This requires fetching current prices. 
  // For MVP speed, let's query the cached portfolio summaries if available or do a quick calculation
  /*
    Optimized:
    1. Get all current holdings (Buy - Sell)
    2. Get latest price for each symbol
    3. Sum
  */

  // 1. Get holdings
  const sql = `
    SELECT t.stock_symbol, 
      SUM(CASE WHEN t.type IN ('SECONDARY_BUY', 'IPO', 'FPO', 'RIGHTS', 'AUCTION', 'BONUS') THEN t.quantity 
                WHEN t.type = 'SECONDARY_SELL' THEN -t.quantity 
                ELSE 0 END) as quantity
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    WHERE p.user_id = ?
    GROUP BY t.stock_symbol
    HAVING quantity > 0
  `;
  const [holdings] = await pool.execute(sql, [userId]);

  if (holdings.length === 0) return 0;

  // 2. Get prices
  const symbols = holdings.map(h => h.stock_symbol);
  // We'll need to import getLatestPrices or just query company_details directly
  const placeholders = symbols.map(() => '?').join(',');
  const [prices] = await pool.execute(
    `SELECT symbol, last_traded_price, close_price FROM company_details WHERE symbol IN (${placeholders})`,
    symbols
  );

  const priceMap = {};
  prices.forEach(p => {
    priceMap[p.symbol] = p.last_traded_price || p.close_price || 0;
  });

  // 3. Sum
  let totalval = 0;
  for (const h of holdings) {
    const price = priceMap[h.stock_symbol] || 0;
    totalval += (h.quantity * price);
  }

  return totalval;
}

async function getSectorCount(userId) {
  // Count unique sectors in holdings
  const sql = `
    SELECT COUNT(DISTINCT c.sector_name) as cnt
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    JOIN company_details c ON t.stock_symbol = c.symbol
    WHERE p.user_id = ?
    GROUP BY t.stock_symbol
    HAVING SUM(CASE WHEN t.type = 'buy' THEN t.quantity ELSE -t.quantity END) > 0
  `;

  // The query above is slightly wrong because HAVING is per group.
  // We want count of sectors of ACTIVE holdings.

  // Simplified:
  // 1. Get active symbols
  // 2. Count distinct sectors

  const holdingsSql = `
    SELECT t.stock_symbol
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    WHERE p.user_id = ?
    GROUP BY t.stock_symbol
    HAVING SUM(CASE WHEN t.type IN ('SECONDARY_BUY', 'IPO', 'FPO', 'RIGHTS', 'AUCTION', 'BONUS') THEN t.quantity 
                    WHEN t.type = 'SECONDARY_SELL' THEN -t.quantity 
                    ELSE 0 END) > 0
  `;
  const [rows] = await pool.execute(holdingsSql, [userId]);
  if (rows.length === 0) return 0;

  const symbols = rows.map(r => r.stock_symbol);
  const placeholders = symbols.map(() => '?').join(',');

  const [sectors] = await pool.execute(
    `SELECT COUNT(DISTINCT sector_name) as cnt FROM company_details WHERE symbol IN (${placeholders})`,
    symbols
  );

  return sectors[0].cnt;
}

async function getDividendIncome(userId, goal) {
  const year = goal.metadata?.year;
  // This requires a table tracking *received* dividends, effectively transactions of type 'dividend'
  // OR we estimate based on 'dividends' table and holdings?
  // Since we don't have a 'user_dividends' table or 'dividend' transactions clearly defined in this context yet,
  // we'll return 0 or check if transactions table has type 'dividend' (assuming it might).

  const sql = `
    SELECT SUM(price * quantity) as total
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    WHERE p.user_id = ? AND t.type = 'DIVIDEND'
    ${year ? 'AND YEAR(t.date) = ?' : ''}
  `;

  const params = [userId];
  if (year) params.push(year);

  const [rows] = await pool.execute(sql, params);
  return rows[0].total || 0;
}

module.exports = {
  getGoals,
  createNewGoal,
  updateGoalDetails,
  removeGoal
};
