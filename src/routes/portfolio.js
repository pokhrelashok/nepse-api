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
        `SELECT * FROM transactions WHERE portfolio_id IN (${placeholders}) ORDER BY date DESC, created_at DESC`,
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
          type: t.type,
          quantity: t.quantity,
          price: parseFloat(t.price) || 0,
          date: new Date(t.date).getTime()
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
        last_updated: lastUpdated
      };
    });


    // Build metadata (Optional, depends on client needs, but keeping it for now)
    const metadata = portfolios.map(p => ({
      id: p.id.toString(),
      name: p.name,
      created_at: new Date(p.created_at).getTime(),
      last_updated: new Date(p.updated_at || p.created_at).getTime()
    }));


    // Default selected portfolio is the first one
    const selected_portfolio_id = portfolios.length > 0 ? portfolios[0].id.toString() : null;

    res.json({
      portfolios: portfoliosData,
      metadata: metadata,
      selected_portfolio_id: selected_portfolio_id
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
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    stock_symbol: { type: 'string', required: true, message: 'Stock symbol is required' },
    type: { type: 'enum', values: TRANSACTION_TYPES, required: true, message: 'Invalid transaction type' },
    quantity: { type: 'number', positive: true, required: true, message: 'Quantity must be a positive number' },
    price: { type: 'number', min: 0, required: true, message: 'Price must be a non-negative number' },
    date: { type: 'string' },
    id: { type: 'string' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { id, stock_symbol, type, quantity, price, date } = data;


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
            (id, portfolio_id, stock_symbol, type, quantity, price, date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
            stock_symbol = VALUES(stock_symbol),
            type = VALUES(type),
            quantity = VALUES(quantity),
            price = VALUES(price),
            date = VALUES(date)
            `,

      [
        transactionId,
        portfolioId,
        stock_symbol.toUpperCase(),
        type,
        quantity,
        price,
        date || new Date()
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

/**
 * @route DELETE /api/portfolios/:id/transactions
 * @desc Delete all transactions for a portfolio
 */
router.delete('/:id/transactions', async (req, res) => {
  const portfolioId = req.params.id;
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  try {
    // Verify ownership of portfolio
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

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
  const portfolioId = req.params.id;
  const { transactions } = req.body;

  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Transactions array required' });
  }

  try {
    // Verify ownership
    const [check] = await pool.execute(
      'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
      [portfolioId, req.currentUser.id]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Portfolio not found' });

    const results = {
      imported: 0,
      errors: []
    };

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const t of transactions) {
        // Basic validation for each item
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
          [
            transactionId,
            portfolioId,
            t.stock_symbol.toUpperCase(),
            t.type,
            t.quantity,
            t.price,
            t.date || new Date()
          ]
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

/**
 * @route POST /api/portfolios/check-conflict
 * @desc Check if there's a sync conflict between local and server data
 */
router.post('/check-conflict', async (req, res) => {
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    local_portfolio_count: { type: 'number', min: 0, required: true, message: 'Local portfolio count required' },
    local_transaction_count: { type: 'number', min: 0, required: true, message: 'Local transaction count required' }
  });

  if (!isValid) return res.status(400).json({ error });
  const { local_portfolio_count, local_transaction_count } = data;

  try {
    // Count server portfolios
    const [portfolioCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM portfolios WHERE user_id = ?',
      [req.currentUser.id]
    );
    const server_portfolio_count = portfolioCount[0].count;

    // Count server transactions for user's portfolios
    const [transactionCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id = ?)`,
      [req.currentUser.id]
    );
    const server_transaction_count = transactionCount[0].count;

    // Check for conflict
    const has_conflict =
      local_portfolio_count !== server_portfolio_count ||
      local_transaction_count !== server_transaction_count;

    // If conflict exists, fetch full server data
    let server_data = null;
    if (has_conflict) {
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
          `SELECT * FROM transactions WHERE portfolio_id IN (${placeholders}) ORDER BY date DESC, created_at DESC`,
          portfolioIds
        );
        allTransactions = transactions;
      }

      // Build the nested response structure
      const portfoliosData = portfolios.map(portfolio => {
        const portfolioTransactions = allTransactions.filter(t => t.portfolio_id === portfolio.id);

        // Group transactions by stock symbol
        const stocksMap = new Map();
        portfolioTransactions.forEach(t => {
          const symbol = t.stock_symbol || 'UNKNOWN';
          if (!stocksMap.has(symbol)) {
            stocksMap.set(symbol, {
              symbol: symbol,
              transactions: []
            });
          }
          stocksMap.get(symbol).transactions.push({
            id: t.id.toString(),
            type: t.type,
            quantity: t.quantity,
            price: parseFloat(t.price) || 0,
            date: new Date(t.date).getTime()
          });
        });

        const lastUpdated = portfolioTransactions.length > 0
          ? Math.max(...portfolioTransactions.map(t => new Date(t.updated_at || t.created_at).getTime()))
          : new Date(portfolio.updated_at || portfolio.created_at).getTime();

        return {
          id: portfolio.id.toString(),
          name: portfolio.name,
          stocks: Array.from(stocksMap.values()),
          last_updated: lastUpdated
        };
      });

      const metadata = portfolios.map(p => ({
        id: p.id.toString(),
        name: p.name,
        created_at: new Date(p.created_at).getTime(),
        last_updated: new Date(p.updated_at || p.created_at).getTime()
      }));

      const selected_portfolio_id = portfolios.length > 0 ? portfolios[0].id.toString() : null;

      server_data = {
        portfolios: portfoliosData,
        metadata: metadata,
        selected_portfolio_id: selected_portfolio_id
      };
    }

    res.json({
      has_conflict,
      server_portfolio_count,
      server_transaction_count,
      server_data
    });

  } catch (error) {
    logger.error('Check Conflict Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/portfolios/upload-local
 * @desc Upload local data to replace all server data
 */
router.post('/upload-local', async (req, res) => {
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    portfolios: { type: 'array', required: true, message: 'Portfolios array required' },
    metadata: { type: 'array', required: false },
    selected_portfolio_id: { type: 'string', required: false }
  });

  if (!isValid) return res.status(400).json({ error });
  const { portfolios, metadata, selected_portfolio_id } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete all existing portfolios (cascade deletes transactions)
    await connection.execute(
      'DELETE FROM portfolios WHERE user_id = ?',
      [req.currentUser.id]
    );

    // Insert new portfolios and transactions
    for (const portfolio of portfolios) {
      if (!portfolio.id || !portfolio.name) {
        await connection.rollback();
        return res.status(400).json({ error: 'Each portfolio must have id and name' });
      }

      // Insert portfolio
      await connection.execute(
        'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
        [portfolio.id, req.currentUser.id, portfolio.name, '#000000']
      );

      // Insert transactions for this portfolio
      if (portfolio.stocks && Array.isArray(portfolio.stocks)) {
        for (const stock of portfolio.stocks) {
          if (stock.transactions && Array.isArray(stock.transactions)) {
            for (const transaction of stock.transactions) {
              if (!transaction.id || !transaction.type || transaction.quantity === undefined || transaction.price === undefined) {
                await connection.rollback();
                return res.status(400).json({ error: 'Invalid transaction data' });
              }

              if (!TRANSACTION_TYPES.includes(transaction.type)) {
                await connection.rollback();
                return res.status(400).json({ error: `Invalid transaction type: ${transaction.type}` });
              }

              const transactionDate = transaction.date ? new Date(transaction.date) : new Date();

              await connection.execute(
                `INSERT INTO transactions 
                 (id, portfolio_id, stock_symbol, type, quantity, price, date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  transaction.id,
                  portfolio.id,
                  stock.symbol.toUpperCase(),
                  transaction.type,
                  transaction.quantity,
                  transaction.price,
                  transactionDate
                ]
              );
            }
          }
        }
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Local data uploaded successfully'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Upload Local Data Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
});

/**
 * @route POST /api/portfolios/resolve-conflict
 * @desc Resolve sync conflict using specified strategy
 */
router.post('/resolve-conflict', async (req, res) => {
  if (!req.currentUser) return res.status(404).json({ error: 'User not found' });

  const { isValid, error, data } = validate(req.body, {
    strategy: { type: 'enum', values: ['MERGE', 'USE_LOCAL', 'USE_SERVER'], required: true, message: 'Strategy must be MERGE, USE_LOCAL, or USE_SERVER' },
    local_data: { type: 'object', required: false }
  });

  if (!isValid) return res.status(400).json({ error });
  const { strategy, local_data } = data;

  try {
    // USE_SERVER: Just return current server data
    if (strategy === 'USE_SERVER') {
      const [portfolios] = await pool.execute(
        'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC',
        [req.currentUser.id]
      );

      const portfolioIds = portfolios.map(p => p.id);
      let allTransactions = [];
      if (portfolioIds.length > 0) {
        const placeholders = portfolioIds.map(() => '?').join(',');
        const [transactions] = await pool.execute(
          `SELECT * FROM transactions WHERE portfolio_id IN (${placeholders}) ORDER BY date DESC, created_at DESC`,
          portfolioIds
        );
        allTransactions = transactions;
      }

      const portfoliosData = portfolios.map(portfolio => {
        const portfolioTransactions = allTransactions.filter(t => t.portfolio_id === portfolio.id);
        const stocksMap = new Map();

        portfolioTransactions.forEach(t => {
          const symbol = t.stock_symbol || 'UNKNOWN';
          if (!stocksMap.has(symbol)) {
            stocksMap.set(symbol, { symbol: symbol, transactions: [] });
          }
          stocksMap.get(symbol).transactions.push({
            id: t.id.toString(),
            type: t.type,
            quantity: t.quantity,
            price: parseFloat(t.price) || 0,
            date: new Date(t.date).getTime()
          });
        });

        const lastUpdated = portfolioTransactions.length > 0
          ? Math.max(...portfolioTransactions.map(t => new Date(t.updated_at || t.created_at).getTime()))
          : new Date(portfolio.updated_at || portfolio.created_at).getTime();

        return {
          id: portfolio.id.toString(),
          name: portfolio.name,
          stocks: Array.from(stocksMap.values()),
          last_updated: lastUpdated
        };
      });

      const metadata = portfolios.map(p => ({
        id: p.id.toString(),
        name: p.name,
        created_at: new Date(p.created_at).getTime(),
        last_updated: new Date(p.updated_at || p.created_at).getTime()
      }));

      const selected_portfolio_id = portfolios.length > 0 ? portfolios[0].id.toString() : null;

      return res.json({
        portfolios: portfoliosData,
        metadata: metadata,
        selected_portfolio_id: selected_portfolio_id
      });
    }

    // USE_LOCAL: Replace all server data with local data
    if (strategy === 'USE_LOCAL') {
      if (!local_data || !local_data.portfolios) {
        return res.status(400).json({ error: 'local_data with portfolios required for USE_LOCAL strategy' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        await connection.execute('DELETE FROM portfolios WHERE user_id = ?', [req.currentUser.id]);

        for (const portfolio of local_data.portfolios) {
          if (!portfolio.id || !portfolio.name) {
            await connection.rollback();
            return res.status(400).json({ error: 'Each portfolio must have id and name' });
          }

          await connection.execute(
            'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
            [portfolio.id, req.currentUser.id, portfolio.name, '#000000']
          );

          if (portfolio.stocks && Array.isArray(portfolio.stocks)) {
            for (const stock of portfolio.stocks) {
              if (stock.transactions && Array.isArray(stock.transactions)) {
                for (const transaction of stock.transactions) {
                  if (!transaction.id || !transaction.type) {
                    await connection.rollback();
                    return res.status(400).json({ error: 'Invalid transaction data' });
                  }

                  if (!TRANSACTION_TYPES.includes(transaction.type)) {
                    await connection.rollback();
                    return res.status(400).json({ error: `Invalid transaction type: ${transaction.type}` });
                  }

                  const transactionDate = transaction.date ? new Date(transaction.date) : new Date();

                  await connection.execute(
                    `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [transaction.id, portfolio.id, stock.symbol.toUpperCase(), transaction.type,
                    transaction.quantity, transaction.price, transactionDate]
                  );
                }
              }
            }
          }
        }

        await connection.commit();

        // Return the uploaded data
        return res.json({
          portfolios: local_data.portfolios,
          metadata: local_data.metadata || [],
          selected_portfolio_id: local_data.selected_portfolio_id || null
        });

      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // MERGE: Merge local and server data based on timestamps
    if (strategy === 'MERGE') {
      if (!local_data || !local_data.portfolios) {
        return res.status(400).json({ error: 'local_data with portfolios required for MERGE strategy' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Fetch current server data
        const [serverPortfolios] = await connection.execute(
          'SELECT * FROM portfolios WHERE user_id = ?',
          [req.currentUser.id]
        );

        const serverPortfolioIds = serverPortfolios.map(p => p.id);
        let serverTransactions = [];
        if (serverPortfolioIds.length > 0) {
          const placeholders = serverPortfolioIds.map(() => '?').join(',');
          const [transactions] = await connection.execute(
            `SELECT * FROM transactions WHERE portfolio_id IN (${placeholders})`,
            serverPortfolioIds
          );
          serverTransactions = transactions;
        }

        // Build maps for easier merging
        const serverPortfolioMap = new Map(serverPortfolios.map(p => [p.id, p]));
        const serverTransactionMap = new Map(serverTransactions.map(t => [t.id, t]));

        // Merge portfolios
        const mergedPortfolios = new Map();

        // Add server portfolios
        serverPortfolios.forEach(p => {
          mergedPortfolios.set(p.id, {
            id: p.id,
            name: p.name,
            color: p.color,
            updated_at: new Date(p.updated_at || p.created_at).getTime(),
            stocks: new Map()
          });
        });

        // Merge with local portfolios (keep most recent)
        local_data.portfolios.forEach(localP => {
          const localUpdated = localP.last_updated || 0;
          const existing = mergedPortfolios.get(localP.id);

          if (!existing || localUpdated > existing.updated_at) {
            mergedPortfolios.set(localP.id, {
              id: localP.id,
              name: localP.name,
              color: '#000000',
              updated_at: localUpdated,
              stocks: new Map()
            });
          }
        });

        // Merge transactions
        const mergedTransactions = new Map();

        // Add server transactions
        serverTransactions.forEach(t => {
          mergedTransactions.set(t.id, {
            id: t.id,
            portfolio_id: t.portfolio_id,
            stock_symbol: t.stock_symbol,
            type: t.type,
            quantity: t.quantity,
            price: t.price,
            date: t.date,
            updated_at: new Date(t.updated_at || t.created_at).getTime()
          });
        });

        // Merge with local transactions (keep most recent)
        local_data.portfolios.forEach(localP => {
          if (localP.stocks && Array.isArray(localP.stocks)) {
            localP.stocks.forEach(stock => {
              if (stock.transactions && Array.isArray(stock.transactions)) {
                stock.transactions.forEach(localT => {
                  const localUpdated = localT.date || 0;
                  const existing = mergedTransactions.get(localT.id);

                  if (!existing || localUpdated > existing.updated_at) {
                    mergedTransactions.set(localT.id, {
                      id: localT.id,
                      portfolio_id: localP.id,
                      stock_symbol: stock.symbol,
                      type: localT.type,
                      quantity: localT.quantity,
                      price: localT.price,
                      date: new Date(localT.date),
                      updated_at: localUpdated
                    });
                  }
                });
              }
            });
          }
        });

        // Delete all existing data
        await connection.execute('DELETE FROM portfolios WHERE user_id = ?', [req.currentUser.id]);

        // Insert merged portfolios
        for (const portfolio of mergedPortfolios.values()) {
          await connection.execute(
            'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
            [portfolio.id, req.currentUser.id, portfolio.name, portfolio.color]
          );
        }

        // Insert merged transactions
        for (const transaction of mergedTransactions.values()) {
          // Only insert if portfolio exists in merged set
          if (mergedPortfolios.has(transaction.portfolio_id)) {
            await connection.execute(
              `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                transaction.id,
                transaction.portfolio_id,
                transaction.stock_symbol.toUpperCase(),
                transaction.type,
                transaction.quantity,
                transaction.price,
                transaction.date
              ]
            );
          }
        }

        await connection.commit();

        // Fetch and return the merged result
        const [finalPortfolios] = await pool.execute(
          'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC',
          [req.currentUser.id]
        );

        const finalPortfolioIds = finalPortfolios.map(p => p.id);
        let finalTransactions = [];
        if (finalPortfolioIds.length > 0) {
          const placeholders = finalPortfolioIds.map(() => '?').join(',');
          const [transactions] = await pool.execute(
            `SELECT * FROM transactions WHERE portfolio_id IN (${placeholders}) ORDER BY date DESC, created_at DESC`,
            finalPortfolioIds
          );
          finalTransactions = transactions;
        }

        const portfoliosData = finalPortfolios.map(portfolio => {
          const portfolioTransactions = finalTransactions.filter(t => t.portfolio_id === portfolio.id);
          const stocksMap = new Map();

          portfolioTransactions.forEach(t => {
            const symbol = t.stock_symbol || 'UNKNOWN';
            if (!stocksMap.has(symbol)) {
              stocksMap.set(symbol, { symbol: symbol, transactions: [] });
            }
            stocksMap.get(symbol).transactions.push({
              id: t.id.toString(),
              type: t.type,
              quantity: t.quantity,
              price: parseFloat(t.price) || 0,
              date: new Date(t.date).getTime()
            });
          });

          const lastUpdated = portfolioTransactions.length > 0
            ? Math.max(...portfolioTransactions.map(t => new Date(t.updated_at || t.created_at).getTime()))
            : new Date(portfolio.updated_at || portfolio.created_at).getTime();

          return {
            id: portfolio.id.toString(),
            name: portfolio.name,
            stocks: Array.from(stocksMap.values()),
            last_updated: lastUpdated
          };
        });

        const metadata = finalPortfolios.map(p => ({
          id: p.id.toString(),
          name: p.name,
          created_at: new Date(p.created_at).getTime(),
          last_updated: new Date(p.updated_at || p.created_at).getTime()
        }));

        const selected_portfolio_id = finalPortfolios.length > 0 ? finalPortfolios[0].id.toString() : null;

        return res.json({
          portfolios: portfoliosData,
          metadata: metadata,
          selected_portfolio_id: selected_portfolio_id
        });

      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

  } catch (error) {
    logger.error('Resolve Conflict Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
