const { validate } = require('../../utils/validator');

/**
 * Validation schemas for portfolio routes
 */

// Transaction Types Enum
const TRANSACTION_TYPES = [
  'IPO', 'FPO', 'AUCTION', 'RIGHTS',
  'SECONDARY_BUY', 'SECONDARY_SELL',
  'BONUS', 'DIVIDEND',
  'MERGER_OUT', 'MERGER_IN'
];

/**
 * Validate portfolio creation/update data
 */
function validatePortfolio(data, requireName = true) {
  return validate(data, {
    name: { type: 'string', required: requireName, max: 50, message: 'Portfolio name required' },
    color: { type: 'string', default: '#00E676' },
    id: { type: 'string' }
  });
}

/**
 * Validate transaction data
 */
function validateTransaction(data) {
  return validate(data, {
    id: { type: 'string' },
    type: { type: 'string', required: true, message: 'Transaction type required' },
    stock_symbol: { type: 'string', required: true, message: 'Stock symbol required' },
    quantity: { type: 'number', required: true, message: 'Quantity required' },
    price: { type: 'number', required: true, message: 'Price required' },
    date: { type: 'string', required: true, message: 'Date required' },
    remarks: { type: 'string', required: false, max: 255 }
  });
}

/**
 * Check if user owns portfolio
 */
async function checkPortfolioOwnership(pool, portfolioId, userId) {
  const [check] = await pool.execute(
    'SELECT id FROM portfolios WHERE id = ? AND user_id = ?',
    [portfolioId, userId]
  );
  return check.length > 0;
}

/**
 * Verify request has authenticated user
 */
function requireUser(req, res) {
  if (!req.currentUser) {
    res.status(404).json({ error: 'User not found' });
    return false;
  }
  return true;
}

module.exports = {
  TRANSACTION_TYPES,
  validatePortfolio,
  validateTransaction,
  checkPortfolioOwnership,
  requireUser
};
