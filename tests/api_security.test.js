const request = require('supertest');
const app = require('../src/server');
const { pool } = require('../src/database/database');
const { createApiKey, deleteApiKey } = require('../src/database/apiKeyQueries');

describe('API Key Security', () => {
  let validApiKey;
  let keyId;

  beforeAll(async () => {
    // Create a test API key
    const result = await createApiKey('Test Key');
    validApiKey = result.apiKey;
    keyId = result.id;
  });

  afterAll(async () => {
    // Clean up
    await deleteApiKey(keyId);
    await pool.end();
  });

  test('GET /api/health should be accessible without API key', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('GET /api/market/status should fail without API key', async () => {
    const res = await request(app).get('/api/market/status');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('API Key Required');
  });

  test('GET /api/market/status should fail with invalid API key', async () => {
    const res = await request(app)
      .get('/api/market/status')
      .set('x-api-key', 'invalid-key');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Invalid API Key');
  });

  test('GET /api/market/status should succeed with valid API key', async () => {
    const res = await request(app)
      .get('/api/market/status')
      .set('x-api-key', validApiKey);

    // Status depends on DB state, but it should not be 401/403
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
  });

  test('Admin login should be accessible without API Key', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'wrongpassword' });

    // Should return 401 (Invalid credentials) not 401 (API Key Required)
    // The error message differs
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});
