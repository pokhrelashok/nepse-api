const { pool } = require('../database');
const { generateUuid } = require('../../utils/uuid');
const logger = require('../../utils/logger');

/**
 * Seed API Keys
 * Creates a default API key for development/testing
 */
async function seed() {
  try {
    logger.info('Seeding API keys...');

    const id = generateUuid();
    const name = 'Default API Key';
    const apiKey = 'npt_82bc05f3a46fa9d92bf92f7213f1d18245f4445b62ecfabdc0357074f4fd60f1';
    const status = 'active';

    // Check if API key already exists
    const [existing] = await pool.execute(
      'SELECT id FROM api_keys WHERE api_key = ?',
      [apiKey]
    );

    if (existing.length > 0) {
      logger.info('Default API key already exists. Skipping...');
      return;
    }

    // Insert the API key
    const sql = `
      INSERT INTO api_keys (id, name, api_key, status)
      VALUES (?, ?, ?, ?)
    `;

    await pool.execute(sql, [id, name, apiKey, status]);
    logger.info(`✓ Created API key: ${name}`);
    logger.info(`  Key: ${apiKey}`);
  } catch (error) {
    logger.error('Failed to seed API keys:', error);
    throw error;
  }
}

module.exports = { seed };
