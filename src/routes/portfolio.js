const express = require('express');
const router = express.Router();
const { pool } = require('../database/database');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');

// Apply auth middleware to all portfolio routes
router.use(verifyToken);

// Transaction Types Enum
const TRANSACTION_TYPES = [
  'IPO', 'FPO', 'AUCTION', 'RIGHTS',
  'SECONDARY_BUY', 'SECONDARY_SELL',
  'BONUS', 'DIVIDEND'
];

/**
 * @route GET /api/portfolios
 * @desc Get all portfolios for the logged-in user
 */
router.get('/', async (req, res) => {
  if (!req.currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

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
 * @route GET /api/portfolios/sync
 * @desc Get all portfolios with stocks and transactions in nested format for app sync
 */
router.get('/sync', async (req, res) => {
  if (!req.currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Get all portfolios for user
    const [portfolios] = await pool.execute(
      'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC',
      [req.currentUser.id]
    );

    // Get all transactions for all user's portfolios
    const portfolioIds = portfolios.map(p => p.id);

    let allTransactions = [];
    if (portfolioIds.length > 0) {
      const placeholders = portfolioIds.map(() => '?').join(',');
      const [transactions] = await pool.execute(
        `SELECT * FROM transactions WHERE portfolio_id IN (${placeholders}) ORDER BY transaction_date DESC, created_at DESC`,
        portfolioIds
      );
      allTransactions = transactions;
    }

    // Build the nested response structure
    const portfoliosData = portfolios.map(portfolio => {
      // Get transactions for this portfolio
      const portfolioTransactions = allTransactions.filter(t => t.portfolio_id === portfolio.id);

      // Group transactions by stock symbol
      const stocksMap = new Map();
      portfolioTransactions.forEach(t => {
        const symbol = t.stock_symbol || 'UNKNOWN';
        if (!stocksMap.has(symbol)) {
          stocksMap.set(symbol, {
            symbol: symbol,
            name: t.company_name || symbol, // Use company_name if available
            transactions: []
          });
        }
        stocksMap.get(symbol).transactions.push({
          id: t.id.toString(),
          type: t.transaction_type,
          quantity: t.quantity,
          price: parseFloat(t.price) || 0,
          date: new Date(t.transaction_date).getTime()
        });
      });

      // Find the latest transaction date for lastUpdated
      const lastUpdated = portfolioTransactions.length > 0
        ? Math.max(...portfolioTransactions.map(t => new Date(t.updated_at || t.created_at).getTime()))
        : new Date(portfolio.updated_at || portfolio.created_at).getTime();

      return {
        portfolioId: portfolio.id.toString(),
        portfolioName: portfolio.name,
        stocks: Array.from(stocksMap.values()),
        lastUpdated: lastUpdated
      };
    });

    // Build metadata
    const metadata = portfolios.map(p => ({
      id: p.id.toString(),
      name: p.name,
      createdAt: new Date(p.created_at).getTime(),
      lastUpdated: new Date(p.updated_at || p.created_at).getTime()
    }));

    // Default selected portfolio is the first one
    const selectedPortfolioId = portfolios.length > 0 ? portfolios[0].id.toString() : null;

    res.json({
      portfolios: portfoliosData,
      metadata: metadata,
      selectedPortfolioId: selectedPortfolioId
    });

  } catch (error) {
    logger.error('Get Portfolios Sync Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/portfolios
 * @desc Create a new portfolio
 */
router.post('/', async (req, res) => {
  const { name, color } = req.body;

  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Portfolio name required' });
  }
  if (name.length > 50) {
    return res.status(400).json({ error: 'Portfolio name too long (max 50 chars)' });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO portfolios (user_id, name, color) VALUES (?, ?, ?)',
      [req.currentUser.id, name.trim(), color || '#000000']
    );

    const [newItem] = await pool.execute('SELECT * FROM portfolios WHERE id = ?', [result.insertId]);
    res.json(newItem[0]);
  } catch (error) {
    logger.error('Create Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route PUT /api/portfolios/:id
 * @desc Update a portfolio
 */
router.put('/:id', async (req, res) => {
  const { name, color } = req.body;
  const portfolioId = req.params.id;

  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  // Validation
  if (name && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Invalid portfolio name' });
  }
  if (name && name.length > 50) {
    return res.status(400).json({ error: 'Portfolio name too long (max 50 chars)' });
  }

  try {
    // Verify ownership
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );

    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

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
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  try {
    // Verify ownership
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );

    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    await pool.execute('DELETE FROM portfolios WHERE id = ?', [portfolioId]);
    res.json({ success: true, message: 'Portfolio deleted' });
  } catch (error) {
    logger.error('Delete Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Transactions ---

/**
 * @route GET /api/portfolios/:id/transactions
 * @desc Get transactions for a portfolio
 */
router.get('/:id/transactions', async (req, res) => {
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  try {
    // Verify ownership
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );

    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    const [rows] = await pool.execute(
      'SELECT * FROM transactions WHERE portfolio_id = ? ORDER BY transaction_date DESC, created_at DESC',
      [portfolioId]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Get Transactions Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/portfolios/:id/transactions
 * @desc Add a transaction
 */
router.post('/:id/transactions', async (req, res) => {
  const portfolioId = req.params.id;
  const { company_id, stock_symbol, transaction_type, quantity, price, transaction_date } = req.body;

  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  // Validation
  if (!transaction_type || !TRANSACTION_TYPES.includes(transaction_type)) {
    return res.status(400).json({
      error: 'Invalid transaction type',
      validTypes: TRANSACTION_TYPES
    });
  }

  if (quantity === undefined || isNaN(quantity) || parseFloat(quantity) <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  if (price === undefined || isNaN(price) || parseFloat(price) < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number' });
  }

  // Ensure either company_id or stock_symbol is present (prefer symbol as it's more robust for text-based system)
  if (!company_id && !stock_symbol) {
    return res.status(400).json({ error: 'Stock symbol is required' });
  }

  try {
    // Verify ownership
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    const [result] = await pool.execute(
      `INSERT INTO transactions 
            (portfolio_id, company_id, stock_symbol, transaction_type, quantity, price, transaction_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        portfolioId,
        company_id || null,
        stock_symbol ? stock_symbol.toUpperCase() : null,
        transaction_type,
        quantity,
        price,
        transaction_date || new Date()
      ]
    );

    const [newItem] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
    res.json(newItem[0]);
  } catch (error) {
    logger.error('Add Transaction Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route DELETE /api/portfolios/:id/transactions/:tid
 * @desc Delete a transaction
 */
router.delete('/:id/transactions/:tid', async (req, res) => {
  const { id: portfolioId, tid: transactionId } = req.params;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  try {
    // Verify ownership of portfolio
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    // Verify transaction belongs to portfolio
    const [tCheck] = await pool.execute(
      'SELECT id FROM transactions WHERE id = ? AND portfolio_id = ?',
      [transactionId, portfolioId]
    );
    if (tCheck.length === 0) return res.status(404).json({ error: 'Transaction not found or mismatch' });

    await pool.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    logger.error('Delete Transaction Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
