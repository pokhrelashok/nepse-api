const express = require('express');
const router = express.Router();
const { pool } = require('../../database/database');
const logger = require('../../utils/logger');
const { generateUuid } = require('../../utils/uuid');
const { validatePortfolio, checkPortfolioOwnership, requireUser } = require('./validation');

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

module.exports = router;
