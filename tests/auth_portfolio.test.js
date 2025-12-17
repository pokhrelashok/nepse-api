const request = require('supertest');
const app = require('../src/server');
const mysql = require('mysql2/promise');
const admin = require('../src/config/firebase');

// Mock Firebase Admin
jest.mock('../src/config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-google-uid-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg'
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

describe('Auth & Portfolio API', () => {
  let connection;
  let server;
  let createdPortfolioId;

  beforeAll(async () => {
    // Connect to DB to clean up test data/ensure table exists
    connection = await mysql.createConnection(dbConfig);
    // Clean up partials from previous runs
    await connection.execute('DELETE FROM users WHERE google_id = ?', ['test-google-uid-123']);
  });

  afterAll(async () => {
    if (connection) await connection.end();
  });

  describe('POST /api/auth/google', () => {
    it('should create a new user from Google Token', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ token: 'mock-valid-token' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.google_id).toBe('test-google-uid-123');
    });

    it('should update existing user on subsequent login', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ token: 'mock-valid-token' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.email).toBe('test@example.com');
    });
  });

  describe('Portfolio CRUD', () => {
    const token = 'Bearer mock-valid-token';

    it('should create a portfolio', async () => {
      const res = await request(app)
        .post('/api/portfolios')
        .set('Authorization', token)
        .send({ name: 'My Test Portfolio', color: '#FF5733' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.name).toBe('My Test Portfolio');
      createdPortfolioId = res.body.id;
    });

    it('should list portfolios', async () => {
      const res = await request(app)
        .get('/api/portfolios')
        .set('Authorization', token);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const found = res.body.find(p => p.id === createdPortfolioId);
      expect(found).toBeDefined();
    });

    it('should add a transaction', async () => {
      const res = await request(app)
        .post(`/api/portfolios/${createdPortfolioId}/transactions`)
        .set('Authorization', token)
        .send({
          stock_symbol: 'NABIL',
          transaction_type: 'SECONDARY_BUY',
          quantity: 10,
          price: 500
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.stock_symbol).toBe('NABIL');
      expect(res.body.quantity).toBe(10);
    });

    it('should delete the portfolio', async () => {
      const res = await request(app)
        .delete(`/api/portfolios/${createdPortfolioId}`)
        .set('Authorization', token);

      expect(res.statusCode).toEqual(200);
    });
  });
});
