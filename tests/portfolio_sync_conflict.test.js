const request = require('supertest');
const app = require('../src/server');
const mysql = require('mysql2/promise');
const admin = require('../src/config/firebase');
const { createApiKey, deleteApiKey } = require('../src/database/apiKeyQueries');

// Mock Firebase Admin
jest.mock('../src/config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-sync-uid-456',
      email: 'sync@example.com',
      name: 'Sync Test User',
      picture: 'https://example.com/sync-avatar.jpg'
    })
  }),
  messaging: () => ({
    subscribeToTopic: jest.fn().mockResolvedValue({ success: true })
  }),
  credential: {
    cert: jest.fn()
  },
  initializeApp: jest.fn()
}));

// DB Config
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db'
};

describe('Portfolio Sync Conflict Resolution API', () => {
  let connection;
  let userId;
  let apiKey;
  let apiKeyId;
  const token = 'Bearer mock-valid-token';

  beforeAll(async () => {
    connection = await mysql.createConnection(dbConfig);

    // Create API key for tests
    const apiKeyResult = await createApiKey('Sync Test Key');
    apiKey = apiKeyResult.apiKey;
    apiKeyId = apiKeyResult.id;

    // Clean up test data from previous runs
    await connection.execute('DELETE FROM users WHERE google_id = ?', ['test-sync-uid-456']);

    // Create test user via auth endpoint
    const authRes = await request(app)
      .post('/api/auth/google')
      .send({ token: 'mock-valid-token' });

    userId = authRes.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
    if (apiKeyId) {
      await deleteApiKey(apiKeyId);
    }
    if (connection) await connection.end();
  });

  beforeEach(async () => {
    // Clean up portfolios before each test
    await connection.execute('DELETE FROM portfolios WHERE user_id = ?', [userId]);
  });

  describe('POST /api/portfolios/check-conflict', () => {
    it('should return no conflict when counts match', async () => {
      // Create 2 portfolios with 3 transactions total
      const portfolio1 = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .set('x-api-key', apiKey)
        .send({ name: 'Portfolio 1', color: '#FF0000' });

      const portfolio2 = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ name: 'Portfolio 2', color: '#00FF00' });

      await request(app)
        .post(`/api/portfolios/${portfolio1.body.id}/transactions`)
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          stock_symbol: 'NABIL',
          type: 'SECONDARY_BUY',
          quantity: 10,
          price: 500
        });

      await request(app)
        .post(`/api/portfolios/${portfolio1.body.id}/transactions`)
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          stock_symbol: 'NICA',
          type: 'IPO',
          quantity: 20,
          price: 300
        });

      await request(app)
        .post(`/api/portfolios/${portfolio2.body.id}/transactions`)
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          stock_symbol: 'HDL',
          type: 'SECONDARY_BUY',
          quantity: 15,
          price: 400
        });

      // Check conflict with matching counts
      const res = await request(app)
        .post('/api/portfolios/check-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          local_portfolio_count: 2,
          local_transaction_count: 3
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.has_conflict).toBe(false);
      expect(res.body.server_portfolio_count).toBe(2);
      expect(res.body.server_transaction_count).toBe(3);
      expect(res.body.server_data).toBeNull();
    });

    it('should detect conflict when portfolio counts differ', async () => {
      // Create 1 portfolio
      const portfolio = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ name: 'Portfolio 1', color: '#FF0000' });

      // Check conflict with different count
      const res = await request(app)
        .post('/api/portfolios/check-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          local_portfolio_count: 2,
          local_transaction_count: 0
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.has_conflict).toBe(true);
      expect(res.body.server_portfolio_count).toBe(1);
      expect(res.body.server_data).toBeDefined();
      expect(res.body.server_data.portfolios).toHaveLength(1);
    });

    it('should detect conflict when transaction counts differ', async () => {
      const portfolio = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ name: 'Portfolio 1' });

      await request(app)
        .post(`/api/portfolios/${portfolio.body.id}/transactions`)
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          stock_symbol: 'NABIL',
          type: 'SECONDARY_BUY',
          quantity: 10,
          price: 500
        });

      const res = await request(app)
        .post('/api/portfolios/check-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          local_portfolio_count: 1,
          local_transaction_count: 5
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.has_conflict).toBe(true);
      expect(res.body.server_transaction_count).toBe(1);
      expect(res.body.server_data).toBeDefined();
    });

    it('should return server data when conflict exists', async () => {
      const portfolio = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ name: 'Test Portfolio' });

      await request(app)
        .post(`/api/portfolios/${portfolio.body.id}/transactions`)
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          stock_symbol: 'NABIL',
          type: 'SECONDARY_BUY',
          quantity: 10,
          price: 500
        });

      const res = await request(app)
        .post('/api/portfolios/check-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          local_portfolio_count: 0,
          local_transaction_count: 0
        });

      expect(res.body.server_data).toBeDefined();
      expect(res.body.server_data.portfolios).toHaveLength(1);
      expect(res.body.server_data.portfolios[0].name).toBe('Test Portfolio');
      expect(res.body.server_data.portfolios[0].stocks).toHaveLength(1);
      expect(res.body.server_data.portfolios[0].stocks[0].symbol).toBe('NABIL');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/portfolios/check-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({
          local_portfolio_count: 1
          // missing local_transaction_count
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/portfolios/upload-local', () => {
    it('should successfully upload local data', async () => {
      const localData = {
        portfolios: [
          {
            id: 'test-portfolio-uuid-1',
            name: 'Local Portfolio 1',
            stocks: [
              {
                symbol: 'NABIL',
                transactions: [
                  {
                    id: 'test-transaction-uuid-1',
                    type: 'SECONDARY_BUY',
                    quantity: 10,
                    price: 500,
                    date: Date.now()
                  }
                ]
              }
            ]
          }
        ],
        metadata: [],
        selected_portfolio_id: 'test-portfolio-uuid-1'
      };

      const res = await request(app)
        .post('/api/portfolios/upload-local')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send(localData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Local data uploaded successfully');

      // Verify data was uploaded
      const portfolios = await request(app)
        .get('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey);

      expect(portfolios.body).toHaveLength(1);
      expect(portfolios.body[0].name).toBe('Local Portfolio 1');
    });

    it('should replace existing server data', async () => {
      // Create existing portfolio
      await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ name: 'Old Portfolio' });

      const localData = {
        portfolios: [
          {
            id: 'test-portfolio-uuid-2',
            name: 'New Portfolio',
            stocks: []
          }
        ]
      };

      const res = await request(app)
        .post('/api/portfolios/upload-local')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send(localData);

      expect(res.statusCode).toEqual(200);

      // Verify old data is gone
      const portfolios = await request(app)
        .get('/api/portfolios')
        .set('Authorization', token)
        .set('x-api-key', apiKey);

      expect(portfolios.body).toHaveLength(1);
      expect(portfolios.body[0].name).toBe('New Portfolio');
    });

    it('should validate portfolio structure', async () => {
      const invalidData = {
        portfolios: [
          {
            // missing id
            name: 'Invalid Portfolio'
          }
        ]
      };

      const res = await request(app)
        .post('/api/portfolios/upload-local')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send(invalidData);

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('id and name');
    });

    it('should validate transaction types', async () => {
      const invalidData = {
        portfolios: [
          {
            id: 'test-portfolio-uuid-3',
            name: 'Test Portfolio',
            stocks: [
              {
                symbol: 'NABIL',
                transactions: [
                  {
                    id: 'test-transaction-uuid-2',
                    type: 'INVALID_TYPE',
                    quantity: 10,
                    price: 500,
                    date: Date.now()
                  }
                ]
              }
            ]
          }
        ]
      };

      const res = await request(app)
        .post('/api/portfolios/upload-local')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send(invalidData);

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('Invalid transaction type');
    });

    it('should handle empty portfolios array', async () => {
      const res = await request(app)
        .post('/api/portfolios/upload-local')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ portfolios: [] });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/portfolios/resolve-conflict', () => {
    describe('USE_SERVER strategy', () => {
      it('should return current server data without modifications', async () => {
        // Create server data
        const portfolio = await request(app)
          .post('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ name: 'Server Portfolio' });

        await request(app)
          .post(`/api/portfolios/${portfolio.body.id}/transactions`)
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            stock_symbol: 'NABIL',
            type: 'SECONDARY_BUY',
            quantity: 10,
            price: 500
          });

        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ strategy: 'USE_SERVER' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.portfolios).toHaveLength(1);
        expect(res.body.portfolios[0].name).toBe('Server Portfolio');
        expect(res.body.portfolios[0].stocks).toHaveLength(1);
      });
    });

    describe('USE_LOCAL strategy', () => {
      it('should replace server data with local data', async () => {
        // Create existing server data
        await request(app)
          .post('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ name: 'Old Server Portfolio' });

        const localData = {
          portfolios: [
            {
              id: 'test-portfolio-uuid-4',
              name: 'New Local Portfolio',
              stocks: [
                {
                  symbol: 'NICA',
                  transactions: [
                    {
                      id: 'test-transaction-uuid-3',
                      type: 'IPO',
                      quantity: 20,
                      price: 300,
                      date: Date.now()
                    }
                  ]
                }
              ]
            }
          ]
        };

        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            strategy: 'USE_LOCAL',
            local_data: localData
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.portfolios).toHaveLength(1);
        expect(res.body.portfolios[0].name).toBe('New Local Portfolio');

        // Verify server data was replaced
        const portfolios = await request(app)
          .get('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey);

        expect(portfolios.body).toHaveLength(1);
        expect(portfolios.body[0].name).toBe('New Local Portfolio');
      });

      it('should require local_data for USE_LOCAL strategy', async () => {
        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ strategy: 'USE_LOCAL' });

        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain('local_data');
      });
    });

    describe('MERGE strategy', () => {
      it('should merge portfolios based on timestamps', async () => {
        // Create older server portfolio
        const serverPortfolio = await request(app)
          .post('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ name: 'Old Server Portfolio' });

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 100));

        const now = Date.now();
        const localData = {
          portfolios: [
            {
              id: serverPortfolio.body.id,
              name: 'Updated Portfolio Name',
              last_updated: now,
              stocks: []
            }
          ]
        };

        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            strategy: 'MERGE',
            local_data: localData
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.portfolios).toHaveLength(1);
        expect(res.body.portfolios[0].name).toBe('Updated Portfolio Name');
      });

      it('should merge portfolios from both local and server', async () => {
        // Create server portfolio
        const serverPortfolio = await request(app)
          .post('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ name: 'Server Portfolio' });

        const localData = {
          portfolios: [
            {
              id: serverPortfolio.body.id,
              name: 'Updated Portfolio',
              last_updated: Date.now(),
              stocks: []
            }
          ]
        };

        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            strategy: 'MERGE',
            local_data: localData
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.portfolios).toHaveLength(1);
        // Portfolio should exist with one of the names
        expect(['Server Portfolio', 'Updated Portfolio']).toContain(res.body.portfolios[0].name);
      });

      it('should merge transactions from both sources', async () => {
        const portfolio = await request(app)
          .post('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ name: 'Merge Portfolio' });

        // Add server transaction
        const serverTx = await request(app)
          .post(`/api/portfolios/${portfolio.body.id}/transactions`)
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            stock_symbol: 'NABIL',
            type: 'SECONDARY_BUY',
            quantity: 10,
            price: 500
          });

        const localData = {
          portfolios: [
            {
              id: portfolio.body.id,
              name: 'Merge Portfolio',
              last_updated: Date.now(),
              stocks: [
                {
                  symbol: 'NICA',
                  transactions: [
                    {
                      id: 'test-transaction-uuid-5',
                      type: 'IPO',
                      quantity: 20,
                      price: 300,
                      date: Date.now()
                    }
                  ]
                }
              ]
            }
          ]
        };

        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            strategy: 'MERGE',
            local_data: localData
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.portfolios[0].stocks.length).toBeGreaterThanOrEqual(1);

        // Should have both NABIL and NICA stocks
        const symbols = res.body.portfolios[0].stocks.map(s => s.symbol);
        expect(symbols).toContain('NABIL');
        expect(symbols).toContain('NICA');
      });

      it('should add new portfolios from local data', async () => {
        const serverPortfolio = await request(app)
          .post('/api/portfolios')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ name: 'Server Portfolio' });

        const localData = {
          portfolios: [
            {
              id: serverPortfolio.body.id,
              name: 'Server Portfolio',
              last_updated: Date.now(),
              stocks: []
            },
            {
              id: 'test-portfolio-uuid-5',
              name: 'New Local Portfolio',
              last_updated: Date.now(),
              stocks: []
            }
          ]
        };

        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({
            strategy: 'MERGE',
            local_data: localData
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.portfolios).toHaveLength(2);

        const names = res.body.portfolios.map(p => p.name);
        expect(names).toContain('Server Portfolio');
        expect(names).toContain('New Local Portfolio');
      });

      it('should require local_data for MERGE strategy', async () => {
        const res = await request(app)
          .post('/api/portfolios/resolve-conflict')
          .set('Authorization', token)
          .set('x-api-key', apiKey)
          .send({ strategy: 'MERGE' });

        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain('local_data');
      });
    });

    it('should validate strategy parameter', async () => {
      const res = await request(app)
        .post('/api/portfolios/resolve-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({ strategy: 'INVALID_STRATEGY' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it('should require strategy parameter', async () => {
      const res = await request(app)
        .post('/api/portfolios/resolve-conflict')
        .set('Authorization', token)
        .set('x-api-key', apiKey)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
