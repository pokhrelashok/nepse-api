const express = require('express');
const router = express.Router();
const { pool } = require('../database/database');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');
const { generateUuid } = require('../utils/uuid');
const { validate } = require('../utils/validator');

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
            // name: t.company_name || symbol, // company_name no longer in transactions
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
        id: portfolio.id.toString(), // Client expects "id"
        name: portfolio.name,
        stocks: Array.from(stocksMap.values()),
        lastUpdated: lastUpdated
      };
    });

    // Build metadata (Optional, depends on client needs, but keeping it for now)
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
 * @desc Create or Update (Sync) a new portfolio
 */
router.post('/', async (req, res) => {
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    name: { type: 'string', required: true, max: 50, message: 'Portfolio name required' },
    color: { type: 'string', default: '#000000' },
    id: { type: 'string' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { id, name, color } = data;

  try {
    let portfolioId = id;
    if (!portfolioId) {
      portfolioId = generateUuid();
    }

    // Upsert (Insert or Update if exists)
    // NOTE: If client sends an ID, we assume they want to create it with that ID or update it.

    // Check ownership if it exists to avoid overwriting others' data (UUID collision unlikely but good practice)
    if (id) {
      const [existing] = await pool.execute('SELECT user_id FROM portfolios WHERE id = ?', [id]);
      if (existing.length > 0 && existing[0].user_id !== req.currentUser.id) {
        return res.status(403).json({ error: 'Portfolio ID conflict or forbidden' });
      }
    }

    await pool.execute(
      `INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color)`,
      [portfolioId, req.currentUser.id, name.trim(), color || '#000000']
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
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    name: { type: 'string', max: 50 },
    color: { type: 'string' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { name, color } = data;

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
 * @desc Add or Update (Sync) a transaction
 */
router.post('/:id/transactions', async (req, res) => {
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    stock_symbol: { type: 'string', required: true, message: 'Stock symbol is required' },
    transaction_type: { type: 'enum', values: TRANSACTION_TYPES, required: true, message: 'Invalid transaction type' },
    quantity: { type: 'number', positive: true, required: true, message: 'Quantity must be a positive number' },
    price: { type: 'number', min: 0, required: true, message: 'Price must be a non-negative number' },
    transaction_date: { type: 'string' },
    id: { type: 'string' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { id, stock_symbol, transaction_type, quantity, price, transaction_date } = data;

  try {
    // Verify ownership of portfolio
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    let transactionId = id;
    if (!transactionId) {
      transactionId = generateUuid();
    }

    // If ID provided, check for conflicts if needed, but for simplicity we assume Upsert is safe for ownership if portfolio ownership is verified.
    // However, if updating an existing transaction, we should ensure it belongs to the same portfolio.
    if (id) {
      const [tCheck] = await pool.execute('SELECT portfolio_id FROM transactions WHERE id = ?', [id]);
      if (tCheck.length > 0 && tCheck[0].portfolio_id !== portfolioId) {
        return res.status(403).json({ error: 'Transaction belongs to different portfolio' });
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO transactions 
            (id, portfolio_id, stock_symbol, transaction_type, quantity, price, transaction_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
            stock_symbol = VALUES(stock_symbol),
            transaction_type = VALUES(transaction_type),
            quantity = VALUES(quantity),
            price = VALUES(price),
            transaction_date = VALUES(transaction_date)
            `,
      [
        transactionId,
        portfolioId,
        stock_symbol.toUpperCase(),
        transaction_type,
        quantity,
        price,
        transaction_date || new Date()
      ]
    );

    const [newItem] = await pool.execute('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    res.json(newItem[0]);
  } catch (error) {
    logger.error('Add/Sync Transaction Error:', error);
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
