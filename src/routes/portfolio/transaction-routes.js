const express = require('express');
const router = express.Router();
const { pool } = require('../../database/database');
const logger = require('../../utils/logger');
const { generateUuid } = require('../../utils/uuid');
const { TRANSACTION_TYPES, validateTransaction, checkPortfolioOwnership, requireUser } = require('./validation');

/**
 * @route GET /api/portfolios/:id/transactions
 * @desc Get transactions for a portfolio
 */
router.get('/:id/transactions', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM transactions WHERE portfolio_id = ? ORDER BY date DESC, created_at DESC',
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
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;
  const { isValid, error, data } = validateTransaction(req.body);
  if (!isValid) return res.status(400).json({ error });

  const { id, stock_symbol, type, quantity, price, date } = data;

  // Enforce positive quantity for all types except DIVIDEND
  if (type !== 'DIVIDEND' && quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number for this transaction type' });
  }

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    let transactionId = id || generateUuid();

    // Check transaction ownership if ID provided
    if (id) {
      const [tCheck] = await pool.execute('SELECT portfolio_id FROM transactions WHERE id = ?', [id]);
      if (tCheck.length > 0 && tCheck[0].portfolio_id !== portfolioId) {
        return res.status(403).json({ error: 'Transaction belongs to different portfolio' });
      }
    }

    await pool.execute(
      `INSERT INTO transactions 
       (id, portfolio_id, stock_symbol, type, quantity, price, date) 
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       stock_symbol = VALUES(stock_symbol),
       type = VALUES(type),
       quantity = VALUES(quantity),
       price = VALUES(price),
       date = VALUES(date)`,
      [transactionId, portfolioId, stock_symbol.toUpperCase(), type, quantity, price, date || new Date()]
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
  if (!requireUser(req, res)) return;

  const { id: portfolioId, tid: transactionId } = req.params;

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Verify transaction belongs to portfolio
    const [tCheck] = await pool.execute(
      'SELECT id FROM transactions WHERE id = ? AND portfolio_id = ?',
      [transactionId, portfolioId]
    );
    if (tCheck.length === 0) {
      return res.status(404).json({ error: 'Transaction not found or mismatch' });
    }

    await pool.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    logger.error('Delete Transaction Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route DELETE /api/portfolios/:id/transactions
 * @desc Delete all transactions for a portfolio
 */
router.delete('/:id/transactions', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    await pool.execute('DELETE FROM transactions WHERE portfolio_id = ?', [portfolioId]);
    res.json({ success: true, message: 'All transactions deleted for the portfolio' });
  } catch (error) {
    logger.error('Delete All Transactions Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/portfolios/:id/import
 * @desc Bulk import transactions for a portfolio
 */
router.post('/:id/import', async (req, res) => {
  if (!requireUser(req, res)) return;

  const portfolioId = req.params.id;
  const { transactions } = req.body;

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Transactions array required' });
  }

  try {
    if (!(await checkPortfolioOwnership(pool, portfolioId, req.currentUser.id))) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const results = { imported: 0, errors: [] };
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const t of transactions) {
        if (!t.stock_symbol || !t.type || t.quantity === undefined || t.price === undefined) {
          results.errors.push({ item: t, error: 'Missing required fields' });
          continue;
        }

        if (!TRANSACTION_TYPES.includes(t.type)) {
          results.errors.push({ item: t, error: 'Invalid transaction type' });
          continue;
        }

        const transactionId = t.id || generateUuid();

        await connection.execute(
          `INSERT INTO transactions 
           (id, portfolio_id, stock_symbol, type, quantity, price, date) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           stock_symbol = VALUES(stock_symbol),
           type = VALUES(type),
           quantity = VALUES(quantity),
           price = VALUES(price),
           date = VALUES(date)`,
          [transactionId, portfolioId, t.stock_symbol.toUpperCase(), t.type, t.quantity, t.price, t.date || new Date()]
        );
        results.imported++;
      }

      await connection.commit();
      res.json({
        success: true,
        message: `Imported ${results.imported} transactions`,
        results
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Import Transactions Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
