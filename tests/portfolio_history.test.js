import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mock } from "bun:test";
import request from "supertest";
import mysql from "mysql2/promise";
import { DateTime } from "luxon";

// 1. Mock Authentication
mock.module("../src/config/firebase", () => {
  const mockUser = {
    uid: 'history-test-uid',
    email: 'history-test@example.com',
    name: 'History Test User',
    picture: 'https://example.com/avatar.jpg'
  };
  const mockAuth = {
    // Allow any token check to pass for testing
    verifyIdToken: async (token) => {
      return mockUser; // Always succeed for this test scope
    }
  };
  return {
    default: {
      auth: () => mockAuth,
      messaging: () => ({ subscribeToTopic: async () => ({ success: true }) }),
      credential: { cert: () => { } },
      initializeApp: () => { }
    },
    auth: () => mockAuth,
    messaging: () => ({ subscribeToTopic: async () => ({ success: true }) }),
    credential: { cert: () => { } },
    initializeApp: () => { }
  };
});

// Import App AFTER Mocks
const { default: app } = await import("../src/server");

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db'
};

const token = 'Bearer valid-token';
const TEST_API_KEY = 'test-api-key-history-123';
let portfolioId;
let connection;

const SYMBOL_A = 'TEST_AH';
const SYMBOL_B = 'TEST_BH';

describe('Portfolio History Graph API', () => {

  beforeAll(async () => {
    connection = await mysql.createConnection(dbConfig);

    // Cleanup first
    try {
      await connection.execute('DELETE FROM users WHERE google_id = ?', ['history-test-uid']);
      await connection.execute(`DELETE FROM company_details WHERE symbol IN (?, ?)`, [SYMBOL_A, SYMBOL_B]);
      await connection.execute(`DELETE FROM stock_price_history WHERE symbol IN (?, ?)`, [SYMBOL_A, SYMBOL_B]);
      await connection.execute('DELETE FROM api_keys WHERE api_key = ?', [TEST_API_KEY]);
    } catch (e) { console.log('Cleanup error', e.message); }

    // Insert Valid API Key
    await connection.execute(
      `INSERT INTO api_keys (id, name, api_key, status) VALUES (?, ?, ?, 'active')`,
      ['history-test-key-id', 'History Test Key', TEST_API_KEY]
    );

    // Init User (Endpoint requires API key now!)
    await request(app).post('/api/auth/google').set('x-api-key', TEST_API_KEY).send({ token: 'valid-token' });

    // Seed Data
    const now = DateTime.now().setZone('Asia/Kathmandu');

    // Seed Company Details
    await connection.execute(`INSERT IGNORE INTO company_details (symbol, company_name, security_id) VALUES 
         ('${SYMBOL_A}', 'Test Company A Hist', 999993),
         ('${SYMBOL_B}', 'Test Company B Hist', 999994)
    `);

    // Seed History
    const historyInserts = [];
    for (let i = 35; i >= 0; i--) {
      const date = now.minus({ days: i }).toISODate();
      const priceA = 100;
      const priceB = 200 + (35 - i) * 10;

      historyInserts.push(`('${SYMBOL_A}', '${date}', ${priceA}, 1000)`);
      historyInserts.push(`('${SYMBOL_B}', '${date}', ${priceB}, 1000)`);
    }

    const sql = `INSERT INTO stock_price_history (symbol, business_date, close_price, total_traded_quantity) VALUES ${historyInserts.join(',')}`;
    await connection.execute(sql);
  });

  afterAll(async () => {
    if (connection) {
      await connection.execute('DELETE FROM users WHERE google_id = ?', ['history-test-uid']);
      await connection.execute(`DELETE FROM company_details WHERE symbol IN (?, ?)`, [SYMBOL_A, SYMBOL_B]);
      await connection.execute(`DELETE FROM stock_price_history WHERE symbol IN (?, ?)`, [SYMBOL_A, SYMBOL_B]);
      await connection.execute('DELETE FROM api_keys WHERE api_key = ?', [TEST_API_KEY]);
      await connection.end();
    }
  });

  it('setup: create portfolio', async () => {
    const res = await request(app)
      .post('/api/portfolios')
      .set('Authorization', token)
      .set('x-api-key', TEST_API_KEY)
      .send({ name: 'History Test Portfolio', color: '#123456' });

    expect(res.statusCode).toBe(200);
    portfolioId = res.body.id;
  });

  it('setup: add transactions', async () => {
    const dateA = DateTime.now().minus({ days: 30 }).setZone('Asia/Kathmandu').toISODate();
    const res1 = await request(app)
      .post(`/api/portfolios/${portfolioId}/transactions`)
      .set('Authorization', token)
      .set('x-api-key', TEST_API_KEY)
      .send({
        stock_symbol: SYMBOL_A,
        type: 'SECONDARY_BUY',
        quantity: 10,
        price: 90,
        date: dateA
      });
    expect(res1.statusCode).toBe(200);

    const dateB = DateTime.now().minus({ days: 10 }).setZone('Asia/Kathmandu').toISODate();
    const res2 = await request(app)
      .post(`/api/portfolios/${portfolioId}/transactions`)
      .set('Authorization', token)
      .set('x-api-key', TEST_API_KEY)
      .send({
        stock_symbol: SYMBOL_B,
        type: 'SECONDARY_BUY',
        quantity: 5,
        price: 250,
        date: dateB
      });
    expect(res2.statusCode).toBe(200);
  });

  it('verifies 1M history', async () => {
    const res = await request(app)
      .get(`/api/portfolios/${portfolioId}/history?range=1M`)
      .set('Authorization', token)
      .set('x-api-key', TEST_API_KEY);

    expect(res.statusCode).toBe(200);
    const history = res.body.data;

    expect(history.length).toBeGreaterThan(0);

    const findValue = (daysAgo) => {
      const d = DateTime.now().minus({ days: daysAgo }).toISODate();
      return history.find(h => h.date === d)?.value;
    }

    const val20 = findValue(20);
    expect(val20).toBe(1000);

    const val5 = findValue(5);
    expect(val5).toBe(3500);
  });
});
