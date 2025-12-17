const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');

// DB Config (should be shared)
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db',
  timezone: '+05:45'
};

// Apply auth middleware to all portfolio routes
router.use(verifyToken);

/**
 * @route GET /api/portfolios
 * @desc Get all portfolios for the logged-in user
 */
router.get('/', async (req, res) => {
  if (!req.currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC',
      [req.currentUser.id]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Get Portfolios Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @route POST /api/portfolios
 * @desc Create a new portfolio
 */
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });
  if (!name) return res.status(400).json({ error: 'Portfolio name required' });

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO portfolios (user_id, name, color) VALUES (?, ?, ?)',
      [req.currentUser.id, name, color || '#000000']
    );

    const [newItem] = await connection.execute('SELECT * FROM portfolios WHERE id = ?', [result.insertId]);
    res.json(newItem[0]);
  } catch (error) {
    logger.error('Create Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
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

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Verify ownership
    const [check] = await connection.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );

    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    await connection.execute(
      'UPDATE portfolios SET name = ?, color = ? WHERE id = ?',
      [name, color, portfolioId]
    );

    const [updated] = await connection.execute('SELECT * FROM portfolios WHERE id = ?', [portfolioId]);
    res.json(updated[0]);
  } catch (error) {
    logger.error('Update Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @route DELETE /api/portfolios/:id
 * @desc Delete a portfolio
 */
router.delete('/:id', async (req, res) => {
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Verify ownership
    const [check] = await connection.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );

    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    await connection.execute('DELETE FROM portfolios WHERE id = ?', [portfolioId]);
    res.json({ success: true, message: 'Portfolio deleted' });
  } catch (error) {
    logger.error('Delete Portfolio Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
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

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Verify ownership
    const [check] = await connection.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );

    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    const [rows] = await connection.execute(
      'SELECT * FROM transactions WHERE portfolio_id = ? ORDER BY transaction_date DESC, created_at DESC',
      [portfolioId]
    );
    res.json(rows);
  } catch (error) {
    logger.error('Get Transactions Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @route POST /api/portfolios/:id/transactions
 * @desc Add a transaction
 */
router.post('/:id/transactions', async (req, res) => {
  const portfolioId = req.params.id;
  // transaction_type enum: IPO, FPO, AUCTION, RIGHTS, SECONDARY_BUY, SECONDARY_SELL, BONUS, DIVIDEND
  const { company_id, stock_symbol, transaction_type, quantity, price, transaction_date } = req.body;

  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });
  if (!transaction_type || quantity === undefined || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Verify ownership
    const [check] = await connection.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    const [result] = await connection.execute(
      `INSERT INTO transactions 
            (portfolio_id, company_id, stock_symbol, transaction_type, quantity, price, transaction_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [portfolioId, company_id || null, stock_symbol || null, transaction_type, quantity, price, transaction_date || new Date()]
    );

    const [newItem] = await connection.execute('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
    res.json(newItem[0]);
  } catch (error) {
    logger.error('Add Transaction Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
  }
});

/**
 * @route DELETE /api/portfolios/:id/transactions/:tid
 * @desc Delete a transaction
 */
router.delete('/:id/transactions/:tid', async (req, res) => {
  const { id: portfolioId, tid: transactionId } = req.params;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Verify ownership of portfolio
    const [check] = await connection.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    // Verify transaction belongs to portfolio
    // (SQL enforces cascade delete, but for explicit delete we should check)
    const [tCheck] = await connection.execute(
      'SELECT id FROM transactions WHERE id = ? AND portfolio_id = ?',
      [transactionId, portfolioId]
    );
    if (tCheck.length === 0) return res.status(404).json({ error: 'Transaction not found or mismatch' });

    await connection.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    logger.error('Delete Transaction Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
