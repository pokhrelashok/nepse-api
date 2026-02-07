const {
  getUsersForAdmin,
  getUserCountForAdmin,
  getUserStatsForAdmin,
  getTransactionsForAdminUsers
} = require('../../database/admin/admin-queries');
const { formatResponse, formatError } = require('../../utils/formatter');
const logger = require('../../utils/logger');
const { getNepaliStartOfDay } = require('../../utils/date-utils');

/**
 * Get all users for admin panel
 * GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const filter = req.query.filter || 'all';

    const [users, total] = await Promise.all([
      getUsersForAdmin(limit, offset, filter),
      getUserCountForAdmin(filter)
    ]);

    // Calculate total investment for each user
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const transactions = await getTransactionsForAdminUsers(userIds);

      // Group transactions by user
      const userTransactions = {};
      transactions.forEach(t => {
        if (!userTransactions[t.user_id]) userTransactions[t.user_id] = [];
        userTransactions[t.user_id].push(t);
      });

      // Calculate investment per user
      users.forEach(user => {
        const userTx = userTransactions[user.id] || [];
        const holdingsMap = new Map();

        userTx.forEach(t => {
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
            // Dividend doesn't affect cost basis
          }
        });

        // Sum up total cost of currently held units
        let totalInvestment = 0;
        holdingsMap.forEach(holding => {
          if (holding.units > 0) {
            totalInvestment += holding.total_cost;
          }
        });

        user.total_investment = totalInvestment;
      });
    }

    res.json(formatResponse({
      users,
      pagination: {
        limit,
        offset,
        total
      }
    }));
  } catch (error) {
    logger.error('Admin Users List Error:', error);
    res.status(500).json(formatError('Failed to fetch users', 500));
  }
};

/**
 * Get user statistics for dashboard
 * GET /api/admin/users/stats
 */
exports.getStats = async (req, res) => {
  try {
    const todayStart = getNepaliStartOfDay();
    const stats = await getUserStatsForAdmin(todayStart);
    res.json(formatResponse(stats));
  } catch (error) {
    logger.error('Admin User Stats Error:', error);
    res.status(500).json(formatError('Failed to fetch user stats', 500));
  }
};
