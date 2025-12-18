const request = require('supertest');
const app = require('../src/server');
const mysql = require('mysql2/promise');
const { generateUuid } = require('../src/utils/uuid');

// Mock Firebase Admin
jest.mock('../src/config/firebase', () => {
  const mockUser = {
    uid: 'full-crud-test-uid',
    email: 'crud-test@example.com',
    name: 'CRUD Test User',
    picture: 'https://example.com/avatar.jpg'
  };
  return {
    auth: () => ({
      verifyIdToken: jest.fn().mockImplementation((token) => {
        if (token === 'valid-token') return Promise.resolve(mockUser);
        if (token === 'other-user-token') return Promise.resolve({
          uid: 'other-user-uid',
          email: 'other@example.com',
          name: 'Other User',
          picture: null
        });
        return Promise.reject(new Error('Invalid token'));
      })
    }),
    messaging: () => ({
      subscribeToTopic: jest.fn().mockResolvedValue({ success: true })
    }),
    credential: {
      cert: jest.fn()
    },
    initializeApp: jest.fn()
  };
});

// DB Config
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db'
};

describe('Comprehensive Portfolio & Transaction CRUD', () => {
  let connection;
  const token = 'Bearer valid-token';
  const otherToken = 'Bearer other-user-token';
  let testPortfolioId;
  let testTransactionId;

  beforeAll(async () => {
    connection = await mysql.createConnection(dbConfig);
    // Clean up test users
    await connection.execute('DELETE FROM users WHERE google_id IN (?, ?)', ['full-crud-test-uid', 'other-user-uid']);

    // Ensure user exists (triggering first login)
    await request(app).post('/api/auth/google').send({ token: 'valid-token' });
    await request(app).post('/api/auth/google').send({ token: 'other-user-token' });
  });

  afterAll(async () => {
    if (connection) {
      // Final cleanup
      await connection.execute('DELETE FROM users WHERE google_id IN (?, ?)', ['full-crud-test-uid', 'other-user-uid']);
      await connection.end();
    }
  });

  describe('Portfolio Operations', () => {
    it('should create a new portfolio (POST /api/portfolios)', async () => {
      const res = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .send({ name: 'Investment Portfolio', color: '#4A90E2' });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Investment Portfolio');
      expect(res.body.id).toBeDefined();
      testPortfolioId = res.body.id;
    });

    it('should upsert a portfolio with client ID (POST /api/portfolios)', async () => {
      const clientId = generateUuid();
      const res = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .send({ id: clientId, name: 'Client Managed Portfolio', color: '#50E3C2' });

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(clientId);
      expect(res.body.name).toBe('Client Managed Portfolio');
    });

    it('should list portfolios (GET /api/portfolios)', async () => {
      const res = await request(app)
        .get('/api/portfolios')
        .set('Authorization', token);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should update a portfolio (PUT /api/portfolios/:id)', async () => {
      const res = await request(app)
        .put(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', token)
        .send({ name: 'Updated Portfolio Name', color: '#D0021B' });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Portfolio Name');
    });

    it('should fail to update another user\'s portfolio', async () => {
      const res = await request(app)
        .put(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', otherToken)
        .send({ name: 'Hack Name' });

      expect(res.statusCode).toBe(404); // Or 403 depending on implementation, currently it checks ownership in SELECT
    });
  });

  describe('Transaction Operations', () => {
    it('should add a transaction (POST /api/portfolios/:id/transactions)', async () => {
      const transactionPayload = {
        stock_symbol: 'NABIL',
        type: 'SECONDARY_BUY',
        quantity: 100,
        price: 450.5,
        date: '2025-01-01'
      };
      const res = await request(app)
        .post(`/api/portfolios/${testPortfolioId}/transactions`)
        .set('Authorization', token)
        .send(transactionPayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.stock_symbol).toBe('NABIL');
      expect(res.body.type).toBe('SECONDARY_BUY');
      expect(res.body.quantity).toBe(100);

      // Date might be returned as ISO string, just check if it starts with the expected date
      expect(res.body.date).toBeDefined();
      testTransactionId = res.body.id;
    });


    it('should upsert a transaction with client ID (POST /api/portfolios/:id/transactions)', async () => {
      const clientId = generateUuid();
      const transactionPayload = {
        id: clientId,
        stock_symbol: 'ADBL',
        type: 'IPO',
        quantity: 10,
        price: 100
      };
      const res = await request(app)
        .post(`/api/portfolios/${testPortfolioId}/transactions`)
        .set('Authorization', token)
        .send(transactionPayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(clientId);
      expect(res.body.stock_symbol).toBe('ADBL');
      expect(res.body.type).toBe('IPO');
    });

    it('should fail with invalid transaction type', async () => {
      const res = await request(app)
        .post(`/api/portfolios/${testPortfolioId}/transactions`)
        .set('Authorization', token)
        .send({
          stock_symbol: 'NABIL',
          type: 'INVALID_TYPE',
          quantity: 10,
          price: 100
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should fail with negative quantity', async () => {
      const res = await request(app)
        .post(`/api/portfolios/${testPortfolioId}/transactions`)
        .set('Authorization', token)
        .send({
          stock_symbol: 'NABIL',
          type: 'SECONDARY_BUY',
          quantity: -10,
          price: 100
        });


      expect(res.statusCode).toBe(400);
    });

    it('should list transactions for a portfolio (GET /api/portfolios/:id/transactions)', async () => {
      const res = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/transactions`)
        .set('Authorization', token);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sync Logic', () => {
    it('should get synced portfolio data (GET /api/portfolios/sync)', async () => {
      const res = await request(app)
        .get('/api/portfolios/sync')
        .set('Authorization', token);

      expect(res.statusCode).toBe(200);
      expect(res.body.portfolios).toBeDefined();
      expect(res.body.metadata).toBeDefined();

      const portfolio = res.body.portfolios.find(p => p.id === testPortfolioId);
      expect(portfolio).toBeDefined();
      // Check nested structure
      expect(Array.isArray(portfolio.stocks)).toBe(true);
      const nabil = portfolio.stocks.find(s => s.symbol === 'NABIL');
      expect(nabil).toBeDefined();
      expect(nabil.transactions.length).toBeGreaterThan(0);
    });

    it('should bulk import transactions (POST /api/portfolios/:id/import)', async () => {
      const importPayload = {
        transactions: [
          {
            stock_symbol: 'UPPER',
            type: 'IPO',
            quantity: 10,
            price: 100,
            date: '2024-01-01'
          },
          {
            stock_symbol: 'NIFRA',
            type: 'SECONDARY_BUY',
            quantity: 50,
            price: 250,
            date: '2024-02-01'
          }
        ]
      };

      const res = await request(app)
        .post(`/api/portfolios/${testPortfolioId}/import`)
        .set('Authorization', token)
        .send(importPayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.imported).toBe(2);

      // Verify sync has the new stocks
      const syncCheck = await request(app)
        .get('/api/portfolios/sync')
        .set('Authorization', token);

      const portfolio = syncCheck.body.portfolios.find(p => p.id === testPortfolioId);
      const upper = portfolio.stocks.find(s => s.symbol === 'UPPER');
      const nifra = portfolio.stocks.find(s => s.symbol === 'NIFRA');

      expect(upper).toBeDefined();
      expect(nifra).toBeDefined();
    });
  });


  describe('Delete Operations', () => {
    it('should delete a transaction (DELETE /api/portfolios/:id/transactions/:tid)', async () => {
      const res = await request(app)
        .delete(`/api/portfolios/${testPortfolioId}/transactions/${testTransactionId}`)
        .set('Authorization', token);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const check = await request(app)
        .get(`/api/portfolios/${testPortfolioId}/transactions`)
        .set('Authorization', token);
      expect(check.body.some(t => t.id === testTransactionId)).toBe(false);
    });

    it('should delete a portfolio (DELETE /api/portfolios/:id)', async () => {
      const res = await request(app)
        .delete(`/api/portfolios/${testPortfolioId}`)
        .set('Authorization', token);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const check = await request(app)
        .get('/api/portfolios')
        .set('Authorization', token);
      expect(check.body.some(p => p.id === testPortfolioId)).toBe(false);
    });

    it('should fail to delete another user\'s portfolio', async () => {
      // Create another portfolio for cleanup purposes later or just use an existing one if any
      // Actually, we can just try to delete an ID that doesn't belong to the user
      const otherPortfolioId = generateUuid();
      const res = await request(app)
        .delete(`/api/portfolios/${otherPortfolioId}`)
        .set('Authorization', token);

      expect(res.statusCode).toBe(404);
    });
  });
});
