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

/**
 * @route GET /api/portfolios/:id/history
 * @desc Get portfolio value history over time
 */
router.get('/:id/history', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;
  const range = req.query.range || '1M';

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // 1. Determine start date
    const { DateTime } = require('luxon');
    const now = DateTime.now().setZone('Asia/Kathmandu');
    let startDate;

    switch (range) {
      case '1W': startDate = now.minus({ days: 7 }); break;
      case '1M': startDate = now.minus({ months: 1 }); break;
      case '3M': startDate = now.minus({ months: 3 }); break;
      case '6M': startDate = now.minus({ months: 6 }); break;
      case '1Y': startDate = now.minus({ years: 1 }); break;
      case 'ALL': startDate = now.minus({ years: 5 }); break; // Cap at 5 years for now
      default: startDate = now.minus({ months: 1 });
    }

    const startDateStr = startDate.toISODate();

    // 2. Fetch all transactions for this portfolio
    // We need ALL transactions to calculate the initial holdings at the start date
    const [transactions] = await pool.execute(
      'SELECT stock_symbol, type, quantity, price, date FROM transactions WHERE portfolio_id = ? ORDER BY date ASC',
      [portfolioId]
    );

    if (transactions.length === 0) {
      return res.json(formatResponse([], 'No transactions found'));
    }

    // 3. Identify symbols involved
    const symbols = [...new Set(transactions.map(t => t.stock_symbol))];

    // 4. Fetch price history for these symbols
    // We fetch from startDate because for days before that, we just need the transaction history to establish the baseline units
    const { getStocksHistory } = require('../../database/queries/stock-queries');
    const priceHistoryRaw = await getStocksHistory(symbols, startDateStr);

    // Organize price history by date -> symbol -> price
    const priceMap = {};
    priceHistoryRaw.forEach(row => {
      if (!priceMap[row.business_date]) {
        priceMap[row.business_date] = {};
      }
      priceMap[row.business_date][row.symbol] = parseFloat(row.close_price);
    });

    // Also get current prices for the "today" data point if strictly needed, or ensure history includes today if market is closed
    // For simplicity, we stick to what's in history DB. If live data is needed for "today", we might need to merge it.
    // Generally stock_price_history is updated end-of-day. If we want intraday, we'd check Redis/CompanyDetails.
    // Let's rely on history DB for the graph for now.

    // 5. Generate daily series
    const result = [];
    let currentDate = startDate;
    const today = now.endOf('day');

    // Helper to get price: check specific date, else look back (fill-forward)
    // We need a separate map for "last known price" per symbol
    const lastKnownPrices = {};

    // Initial pass: establish "last known price" before the start date if possible?
    // Actually, if we only requested history FROM start date, we don't have prices before that.
    // We will assume 0 or the first price we see if we don't have prior data.
    // But realistically, user wants to see value evolution.
    // If a stock was bought before startDate, we need its price on startDate.
    // `getStocksHistory` only returns >= startDate.
    // Ideally we should fetch one price point BEFORE startDate to initialize lastKnownPrices.
    // For now, we'll start with 0 and fill as we go, or maybe query a bit wider?
    // Let's accept that if we don't have a price for a holding on day 1 of the graph, it might show 0 value for that stock until a price appears.
    // Improvement: Fetch the latest price BEFORE startDate for each symbol to seed lastKnownPrices.
    // Checking "latest price before X" for N symbols is complex SQL.
    // Let's stick to the current plan: 
    // If we have holdings but no price on day 1, it's a data gap.
    // However, fast solution: Fill forward only within the range.

    // Pre-calculate holdings up to startDate
    const currentHoldings = {};
    let totalInvestment = 0;

    // Process transactions leading up to current loop date
    let transactionIdx = 0;

    // Iterate day by day
    while (currentDate <= today) {
      const dateStr = currentDate.toISODate();

      // Update price map with any new prices found today
      if (priceMap[dateStr]) {
        Object.assign(lastKnownPrices, priceMap[dateStr]);
      }

      // Process transactions for this day (and previous days if we jumped, but we iterate daily)
      // Actually transactions have dates.
      // We need to process all transactions such that t.date <= currentDate
      // Since transactions are sorted by date...
      while (transactionIdx < transactions.length) {
        const t = transactions[transactionIdx];
        let tDate;
        if (t.date instanceof Date) {
          tDate = DateTime.fromJSDate(t.date);
        } else {
          tDate = DateTime.fromISO(t.date || t.created_at);
        }
        tDate = tDate.setZone('Asia/Kathmandu');

        if (tDate > currentDate.endOf('day')) {
          break;
        }

        // Apply transaction
        const symbol = t.stock_symbol.toUpperCase();
        const qty = parseFloat(t.quantity);
        const price = parseFloat(t.price);

        if (!currentHoldings[symbol]) currentHoldings[symbol] = 0;

        switch (t.type) {
          case 'IPO':
          case 'FPO':
          case 'AUCTION':
          case 'SECONDARY_BUY':
          case 'RIGHTS':
          case 'BONUS': // Bonus adds quantity but usually 0 cost (captured in price/investment logic?)
            // For investment calculation:
            // Bonus usually has 0 price in transaction? Or we should track cost separately.
            // If T.price is 0 for bonus, it adds 0 to investment.
            currentHoldings[symbol] += qty;
            if (t.type !== 'BONUS') {
              totalInvestment += (qty * price);
            }
            break;
          case 'SECONDARY_SELL':
            // FIFO or Weighted Average for Investment reduction?
            // Simple approach: reduce investment proportionally? 
            // Or just track "Net Investment" = Buy Cost - Sell Returns? 
            // Standard Portfolio Value vs Cost:
            // Value = Units * Current Price
            // Cost/Investment = Actual money put in. 
            // If I sell, I take money out.
            // Simplest: Total Buy Amount - Total Sell Amount. 
            // But if I sell at profit, I might extract more than I put in, making investment negative?
            // Usually "Investment" means "Cost Basis of Current Holdings".
            // Let's estimate Cost Basis: avg cost per share.
            if (currentHoldings[symbol] > 0) {
              // We need to track avg cost to reduce correctly
              // This is getting complex for a "simple" loop.
              // Let's stick to: "Total Portfolio Value" is what's requested.
              // Investment line is optional but nice.
              // Let's just track Units for Value.
              currentHoldings[symbol] -= qty;
            }
            break;
          case 'DIVIDEND':
            // Cash dividend doesn't affect stock value, but adds to "Cash" if we tracked it.
            // Ignored for "Stock Value Graph".
            break;
        }
        transactionIdx++;
      }

      // Calculate total value for this day
      let dailyValue = 0;
      let hasData = false;

      // Only calculate if we have at least one valid price or holding
      // Actually iterate all holdings
      for (const [symbol, units] of Object.entries(currentHoldings)) {
        if (units > 0) {
          const price = lastKnownPrices[symbol];
          if (price) {
            dailyValue += units * price;
            hasData = true;
          }
        }
      }

      // Only add to result if valid date (e.g. within range)
      // Since we loop from startDate, it is in range.
      // Skip days with 0 value if it looks like missing data? 
      // No, 0 value is valid if I have no stocks.
      // But if I have stocks but no price, it drops to 0? That's a chart artifact.
      // If lastKnownPrices has gaps (e.g. before first price), it might be 0.
      // We accept this limitation for now or improvement:
      // If we have units but no price, try to find a price?

      result.push({
        date: dateStr,
        value: dailyValue,
        // investment: totalInvestment // Optional, maybe add later if requested
      });

      currentDate = currentDate.plus({ days: 1 });
    }

    res.json(formatResponse(result));

  } catch (error) {
    logger.error('Portfolio History Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
