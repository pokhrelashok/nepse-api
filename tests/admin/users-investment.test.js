const { describe, test, expect, beforeEach, mock } = require('bun:test');

// Mock dependencies BEFORE requiring the controller
mock.module('../../src/database/admin/admin-queries', () => {
  return {
    getUsersForAdmin: mock(),
    getUserCountForAdmin: mock(),
    getTransactionsForAdminUsers: mock(),
    getUserStatsForAdmin: mock()
  };
});

mock.module('../../src/utils/logger', () => ({
  error: mock(),
  info: mock()
}));

// Now require dependencies
const { getAllUsers } = require('../../src/controllers/admin/admin-users-controller');
const adminQueries = require('../../src/database/admin/admin-queries');

describe('Admin Users Controller - Total Investment', () => {
  let req, res;

  beforeEach(() => {
    req = { query: {} };
    res = {
      json: mock(),
      status: mock().mockReturnThis(),
    };
    // Reset mocks
    adminQueries.getUsersForAdmin.mockClear();
    adminQueries.getUserCountForAdmin.mockClear();
    adminQueries.getTransactionsForAdminUsers.mockClear();
  });

  test('should calculate total investment correctly excluding sold stocks', async () => {
    // Mock Users
    const mockUsers = [
      { id: 'user1', display_name: 'Investor One' },
      { id: 'user2', display_name: 'Investor Two' }
    ];

    // Mock Transactions
    // User 1: Bought 100 @ 100, Sold 50. Holding: 50 * 100 = 5000.
    // User 2: Bought 50 @ 200, Bonus 10. Holding: 60 units (cost basis stays at 50*200=10000). 
    // Note: bonus usually reduces cost per unit or adds units with 0 cost.
    // The implementation sums total_cost.

    const mockTransactions = [
      // User 1
      { user_id: 'user1', stock_symbol: 'NABIL', type: 'SECONDARY_BUY', quantity: 100, price: 100 },
      { user_id: 'user1', stock_symbol: 'NABIL', type: 'SECONDARY_SELL', quantity: 50, price: 150 }, // Sell doesn't use price for cost reduction, uses avg cost.

      // User 2
      { user_id: 'user2', stock_symbol: 'CBBL', type: 'SECONDARY_BUY', quantity: 50, price: 200 },
      { user_id: 'user2', stock_symbol: 'CBBL', type: 'BONUS', quantity: 10, price: 0 }
    ];

    adminQueries.getUsersForAdmin.mockResolvedValue(mockUsers);
    adminQueries.getUserCountForAdmin.mockResolvedValue(2);

    adminQueries.getTransactionsForAdminUsers.mockResolvedValue(mockTransactions);

    await getAllUsers(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];

    // User 1 Calculation:
    // Buy 100 @ 100 -> Cost: 10000, Units: 100. Avg Cost: 100.
    // Sell 50 -> Reduce Cost by 50 * 100 = 5000. Remaining Cost: 5000.
    // Expected Investment: 5000.
    const user1 = result.data.users.find(u => u.id === 'user1');
    expect(user1.total_investment).toBe(5000);

    // User 2 Calculation:
    // Buy 50 @ 200 -> Cost: 10000, Units: 50.
    // Bonus 10 -> Cost: 10000, Units: 60.
    // Expected Investment: 10000.
    const user2 = result.data.users.find(u => u.id === 'user2');
    expect(user2.total_investment).toBe(10000);
  });

  test('should handle empty transactions', async () => {
    const mockUsers = [{ id: 'user3', display_name: 'No Investor' }];
    adminQueries.getUsersForAdmin.mockResolvedValue(mockUsers);
    adminQueries.getUserCountForAdmin.mockResolvedValue(1);
    adminQueries.getTransactionsForAdminUsers.mockResolvedValue([]);

    await getAllUsers(req, res);

    const result = res.json.mock.calls[0][0];
    const user3 = result.data.users.find(u => u.id === 'user3');
    expect(user3.total_investment).toBe(0);
  });
});
