const express = require('express');
const router = express.Router();
const { pool } = require('../../database/database');
const logger = require('../../utils/logger');
const { validate } = require('../../utils/validator');
const { TRANSACTION_TYPES, requireUser } = require('./validation');

/**
 * Helper to format portfolio data for sync
 */
function formatPortfoliosData(portfolios, allTransactions) {
  return portfolios.map(portfolio => {
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
      color: portfolio.color || '#00E676',
      stocks: Array.from(stocksMap.values()),
      last_updated: lastUpdated
    };
  });
}

/**
 * Helper to get portfolios with transactions
 */
async function getPortfoliosWithTransactions(userId) {
  const [portfolios] = await pool.execute(
    'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
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

  const portfoliosData = formatPortfoliosData(portfolios, allTransactions);

  const metadata = portfolios.map(p => ({
    id: p.id.toString(),
    name: p.name,
    created_at: new Date(p.created_at).getTime(),
    last_updated: new Date(p.updated_at || p.created_at).getTime()
  }));

  const selected_portfolio_id = portfolios.length > 0 ? portfolios[0].id.toString() : null;

  return {
    portfolios: portfoliosData,
    metadata,
    selected_portfolio_id
  };
}

/**
 * @route GET /api/portfolios/sync
 * @desc Get all portfolios with stocks and transactions in nested format for app sync
 */
router.get('/sync', async (req, res) => {
  if (!requireUser(req, res)) return;

  try {
    const data = await getPortfoliosWithTransactions(req.currentUser.id);
    res.json(data);
  } catch (error) {
    logger.error('Get Portfolios Sync Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/portfolios/check-conflict
 * @desc Check if there's a sync conflict between local and server data
 */
router.post('/check-conflict', async (req, res) => {
  if (!requireUser(req, res)) return;

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

    // Count server transactions
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
      server_data = await getPortfoliosWithTransactions(req.currentUser.id);
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
  if (!requireUser(req, res)) return;

  const { isValid, error, data } = validate(req.body, {
    portfolios: { type: 'array', required: true, message: 'Portfolios array required' },
    metadata: { type: 'array', required: false },
    selected_portfolio_id: { type: 'string', required: false }
  });

  if (!isValid) return res.status(400).json({ error });
  const { portfolios } = data;

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

      await connection.execute(
        'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
        [portfolio.id, req.currentUser.id, portfolio.name, portfolio.color || '#00E676']
      );

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
                [transaction.id, portfolio.id, stock.symbol.toUpperCase(), transaction.type, transaction.quantity, transaction.price, transactionDate]
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
  if (!requireUser(req, res)) return;

  const { isValid, error, data } = validate(req.body, {
    strategy: { type: 'enum', values: ['MERGE', 'USE_LOCAL', 'USE_SERVER'], required: true, message: 'Strategy must be MERGE, USE_LOCAL, or USE_SERVER' },
    local_data: { type: 'object', required: false }
  });

  if (!isValid) return res.status(400).json({ error });
  const { strategy, local_data } = data;

  try {
    // USE_SERVER: Just return current server data
    if (strategy === 'USE_SERVER') {
      const result = await getPortfoliosWithTransactions(req.currentUser.id);
      return res.json(result);
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
            [portfolio.id, req.currentUser.id, portfolio.name, portfolio.color || '#00E676']
          );

          if (portfolio.stocks && Array.isArray(portfolio.stocks)) {
            for (const stock of portfolio.stocks) {
              if (stock.transactions && Array.isArray(stock.transactions)) {
                for (const transaction of stock.transactions) {
                  const transactionDate = transaction.date ? new Date(transaction.date) : new Date();
                  await connection.execute(
                    `INSERT INTO transactions (id, portfolio_id, stock_symbol, type, quantity, price, date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [transaction.id, portfolio.id, stock.symbol.toUpperCase(), transaction.type, transaction.quantity, transaction.price, transactionDate]
                  );
                }
              }
            }
          }
        }

        await connection.commit();
        const result = await getPortfoliosWithTransactions(req.currentUser.id);
        return res.json(result);
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // MERGE: Combine local and server data
    if (strategy === 'MERGE') {
      if (!local_data || !local_data.portfolios) {
        return res.status(400).json({ error: 'local_data with portfolios required for MERGE strategy' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Keep server data, add any missing local portfolios/transactions
        const [serverPortfolios] = await connection.execute(
          'SELECT id FROM portfolios WHERE user_id = ?',
          [req.currentUser.id]
        );
        const serverPortfolioIds = new Set(serverPortfolios.map(p => p.id));

        for (const portfolio of local_data.portfolios) {
          if (!serverPortfolioIds.has(portfolio.id)) {
            await connection.execute(
              'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
              [portfolio.id, req.currentUser.id, portfolio.name, portfolio.color || '#00E676']
            );
          }

          if (portfolio.stocks && Array.isArray(portfolio.stocks)) {
            for (const stock of portfolio.stocks) {
              if (stock.transactions && Array.isArray(stock.transactions)) {
                for (const transaction of stock.transactions) {
                  await connection.execute(
                    `INSERT IGNORE INTO transactions 
                     (id, portfolio_id, stock_symbol, type, quantity, price, date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [transaction.id, portfolio.id, stock.symbol.toUpperCase(), transaction.type, transaction.quantity, transaction.price, transaction.date ? new Date(transaction.date) : new Date()]
                  );
                }
              }
            }
          }
        }

        await connection.commit();
        const result = await getPortfoliosWithTransactions(req.currentUser.id);
        return res.json(result);
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    res.status(400).json({ error: 'Invalid strategy' });
  } catch (error) {
    logger.error('Resolve Conflict Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
