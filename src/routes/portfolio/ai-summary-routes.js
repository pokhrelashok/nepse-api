const express = require('express');
const router = express.Router();
const { pool } = require('../../database/database');
const logger = require('../../utils/logger');
const { checkPortfolioOwnership, requireUser } = require('./validation');
const { generatePortfolioSummary } = require('../../services/ai-analysis-service');
const { DateTime } = require('luxon');

/**
 * @route POST /api/portfolios/:id/ai-summary
 * @desc Generate or get AI-powered portfolio summary
 */
router.post('/:id/ai-summary', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;
  const userId = req.currentUser.id;

  try {
    // 1. Check ownership
    if (!(await checkPortfolioOwnership(pool, portfolioId, userId))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // 2. Fetch portfolio details
    const [portfolios] = await pool.execute(
      'SELECT name, ai_summary, ai_summary_updated_at FROM portfolios WHERE id = ?',
      [portfolioId]
    );
    const portfolio = portfolios[0];

    // 3. Check if we need to regenerate
    // Logic: If summary exists and date is today, return existing. 
    // Otherwise, or if user "wants" to recompute (POST implies triggering action)
    // The user request said: "This will be computed only when the user wants to so need a seperate api"
    // and "if the data is of an old date recompute"

    // For now, let's always recompute if requested via POST, 
    // OR if it's stale (older than today's trading data)

    // To implement "recompute if old date", we need the latest trading date
    const [marketIndex] = await pool.execute('SELECT trading_date FROM market_index ORDER BY trading_date DESC LIMIT 1');
    const latestBusinessDate = marketIndex[0]?.trading_date;

    const summaryDate = portfolio.ai_summary_updated_at
      ? DateTime.fromJSDate(new Date(portfolio.ai_summary_updated_at)).toISODate()
      : null;

    if (portfolio.ai_summary && summaryDate === latestBusinessDate) {
      // If summary is up to date, we could return it, but POST usually means "do it"
      // User said: "send a new data if old date". 
      // I'll recompute if summary is null OR summaryDate < latestBusinessDate
    }

    // 4. Fetch holdings
    const [transactions] = await pool.execute(
      `SELECT t.*, cd.company_name, cd.sector_name, cd.ai_summary as stock_ai_summary, 
              sp.last_traded_price, sp.change, sp.percentage_change
       FROM transactions t
       LEFT JOIN company_details cd ON t.stock_symbol = cd.symbol
       LEFT JOIN stock_prices sp ON t.stock_symbol = sp.symbol
       WHERE t.portfolio_id = ?`,
      [portfolioId]
    );

    // Aggregate holdings
    const holdingsMap = new Map();
    transactions.forEach(t => {
      const symbol = t.stock_symbol;
      if (!holdingsMap.has(symbol)) {
        holdingsMap.set(symbol, {
          symbol,
          company_name: t.company_name,
          quantity: 0,
          current_price: parseFloat(t.last_traded_price) || 0,
          price_change_pct: parseFloat(t.percentage_change) || 0,
          ai_summary: t.stock_ai_summary,
          sector: t.sector_name
        });
      }

      const h = holdingsMap.get(symbol);
      if (['IPO', 'FPO', 'AUCTION', 'RIGHTS', 'SECONDARY_BUY', 'BONUS'].includes(t.type)) {
        h.quantity += t.quantity;
      } else if (['SECONDARY_SELL'].includes(t.type)) {
        h.quantity -= t.quantity;
      }
    });

    const holdings = Array.from(holdingsMap.values())
      .filter(h => h.quantity > 0)
      .map(h => ({
        ...h,
        current_value: h.quantity * h.current_price
      }));

    if (holdings.length === 0) {
      return res.status(400).json({ error: 'No holdings found in portfolio' });
    }

    // 5. Generate AI Summary
    const aiResult = await generatePortfolioSummary(portfolio.name, holdings);

    if (aiResult) {
      // 6. Save and Return
      await pool.execute(
        'UPDATE portfolios SET ai_summary = ?, ai_summary_updated_at = NOW() WHERE id = ?',
        [JSON.stringify(aiResult), portfolioId]
      );

      return res.json({
        ...aiResult,
        updated_at: new Date().toISOString()
      });
    } else {
      return res.status(500).json({ error: 'Failed to generate AI summary' });
    }

  } catch (error) {
    logger.error('Portfolio AI Summary Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
