const express = require('express');
const router = express.Router();
const { pool } = require('../../database/database');
const logger = require('../../utils/logger');
const { generateUuid } = require('../../utils/uuid');
const { validatePortfolio, checkPortfolioOwnership, requireUser } = require('./validation');
const { formatResponse } = require('../../utils/formatter');

/**
 * @route GET /api/portfolios
 * @desc Get all portfolios for the logged-in user
 */
router.get('/', async (req, res) => {
  if (!requireUser(req, res)) return;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC',
      [req.currentUser.id]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Get Portfolios Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/portfolios
 * @desc Create or Update (Sync) a portfolio
 */
router.post('/', async (req, res) => {
  if (!requireUser(req, res)) return;

  const { isValid, error, data } = validatePortfolio(req.body, true);
  if (!isValid) return res.status(400).json({ error });

  const { id, name, color } = data;

  try {
    let portfolioId = id || generateUuid();

    // Check ownership if ID provided
    if (id) {
      const [existing] = await pool.execute('SELECT user_id FROM portfolios WHERE id = ?', [id]);
      if (existing.length > 0 && existing[0].user_id !== req.currentUser.id) {
        return res.status(403).json({ error: 'Portfolio ID conflict or forbidden' });
      }
    }

    await pool.execute(
      `INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color)`,
      [portfolioId, req.currentUser.id, name.trim(), color || '#00E676']
    );

    const [newItem] = await pool.execute('SELECT * FROM portfolios WHERE id = ?', [portfolioId]);
    res.json(newItem[0]);
  } catch (error) {
    logger.error('Create/Sync Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route PUT /api/portfolios/:id
 * @desc Update a portfolio (Legacy - Sync uses POST with ID)
 */
router.put('/:id', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;
  const { isValid, error, data } = validatePortfolio(req.body, false);
  if (!isValid) return res.status(400).json({ error });

  const { name, color } = data;

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    await pool.execute(
      'UPDATE portfolios SET name = ?, color = ? WHERE id = ?',
      [name, color, portfolioId]
    );

    const [updated] = await pool.execute('SELECT * FROM portfolios WHERE id = ?', [portfolioId]);
    res.json(updated[0]);
  } catch (error) {
    logger.error('Update Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route DELETE /api/portfolios/:id
 * @desc Delete a portfolio
 */
router.delete('/:id', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    await pool.execute('DELETE FROM portfolios WHERE id = ?', [portfolioId]);
    res.json({ success: true, message: 'Portfolio deleted' });
  } catch (error) {
    logger.error('Delete Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route GET /api/portfolios/:id/sector-breakdown
 * @desc Get sector-wise breakdown for a portfolio
 */
router.get('/:id/sector-breakdown', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // 1. Get all transactions for the portfolio and calculate current holdings per stock
    const [transactions] = await pool.execute(
      'SELECT stock_symbol, type, quantity, price FROM transactions WHERE portfolio_id = ?',
      [portfolioId]
    );

    const holdingsMap = new Map();
    transactions.forEach(t => {
      const symbol = t.stock_symbol.toUpperCase();
      if (!holdingsMap.has(symbol)) {
        holdingsMap.set(symbol, { units: 0, total_cost: 0 });
      }

      const holding = holdingsMap.get(symbol);
      const qty = parseFloat(t.quantity);
      const price = parseFloat(t.price);

      switch (t.type) {
        case 'IPO':
        case 'FPO':
        case 'AUCTION':
        case 'SECONDARY_BUY':
        case 'RIGHTS':
          holding.units += qty;
          holding.total_cost += (qty * price);
          break;
        case 'SECONDARY_SELL':
          if (holding.units > 0) {
            const avgCost = holding.total_cost / holding.units;
            holding.units -= qty;
            holding.total_cost -= (qty * avgCost);
          }
          break;
        case 'BONUS':
          holding.units += qty;
          break;
        case 'DIVIDEND':
          // Dividend doesn't change units or cost basis usually, just cash flow
          break;
      }
    });

    // Filter out stocks with zero units
    const activeHoldings = Array.from(holdingsMap.entries())
      .filter(([_, data]) => data.units > 0)
      .map(([symbol, data]) => ({ symbol, ...data }));

    if (activeHoldings.length === 0) {
      return res.json(formatResponse({
        sectors: [],
        total_portfolio_value: 0,
        daily_gain: 0,
        daily_percentage_change: 0
      }, 'Portfolio is empty'));
    }

    // 2. Fetch latest market data for these stocks
    const symbols = activeHoldings.map(h => h.symbol);
    const [marketData] = await pool.query(
      'SELECT symbol, sector_name, last_traded_price, previous_close FROM company_details WHERE symbol IN (?)',
      [symbols]
    );

    const marketDataMap = new Map();
    marketData.forEach(m => marketDataMap.set(m.symbol, m));

    // 3. Aggregate by sector
    const sectorMap = new Map();
    let totalPortfolioValue = 0;
    let totalDailyGain = 0;

    activeHoldings.forEach(holding => {
      const marketInfo = marketDataMap.get(holding.symbol);
      const sector = marketInfo?.sector_name || 'Unknown';
      const latestPrice = parseFloat(marketInfo?.last_traded_price) || 0;
      const prevClose = parseFloat(marketInfo?.previous_close) || 0;

      const marketValue = holding.units * latestPrice;
      const dailyGain = holding.units * (latestPrice - prevClose);
      const totalGain = marketValue - holding.total_cost;

      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, {
          sector_name: sector,
          total_value: 0,
          total_cost: 0,
          daily_gain: 0,
          total_gain: 0,
          stock_count: 0
        });
      }

      const sectorData = sectorMap.get(sector);
      sectorData.total_value += marketValue;
      sectorData.total_cost += holding.total_cost;
      sectorData.daily_gain += dailyGain;
      sectorData.total_gain += totalGain;
      sectorData.stock_count += 1;

      totalPortfolioValue += marketValue;
      totalDailyGain += dailyGain;
    });

    // 4. Calculate percentages and format result
    const sectorsResult = Array.from(sectorMap.values()).map(s => ({
      ...s,
      percentage: totalPortfolioValue > 0 ? (s.total_value / totalPortfolioValue) * 100 : 0,
      daily_percentage_change: (s.total_value - s.daily_gain) > 0
        ? (s.daily_gain / (s.total_value - s.daily_gain)) * 100
        : 0
    }));

    // Sort by value descending
    sectorsResult.sort((a, b) => b.total_value - a.total_value);

    res.json(formatResponse({
      sectors: sectorsResult,
      total_portfolio_value: totalPortfolioValue,
      daily_gain: totalDailyGain,
      daily_percentage_change: (totalPortfolioValue - totalDailyGain) > 0
        ? (totalDailyGain / (totalPortfolioValue - totalDailyGain)) * 100
        : 0,
      timestamp: new Date().toISOString()
    }, 'Sector breakdown retrieved successfully'));
  } catch (error) {
    logger.error('Sector Breakdown Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
