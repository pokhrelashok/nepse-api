const { pool } = require('../database');
const logger = require('../../utils/logger');

/**
 * Seed User BOIDs
 * Populates the user_boids table with data from the screenshot
 */
async function seed() {
  try {
    logger.info('Seeding user BOIDs...');

    // 1. Get or create a default user
    const [users] = await pool.execute('SELECT id FROM users LIMIT 1');
    let userId;

    if (users.length === 0) {
      const { generateUuid } = require('../../utils/uuid');
      userId = generateUuid();
      await pool.execute(
        'INSERT INTO users (id, email, password, full_name, status) VALUES (?, ?, ?, ?, ?)',
        [userId, 'dev@example.com', 'hashed_password', 'Dev User', 'active']
      );
      logger.info(`✓ Created default user: ${userId}`);
    } else {
      userId = users[0].id;
      logger.info(`Using existing user: ${userId}`);
    }

    // 2. BOIDs from the screenshot
    const boidsData = [
      { name: 'Ashok', boid: '1301670000015818', is_primary: true },
      { name: 'Laxman Adhikari', boid: '130107000060334', is_primary: false },
      { name: 'Ankit', boid: '130167000024187', is_primary: false },
      { name: 'Aaradhya', boid: '1301370007277768', is_primary: false },
      { name: 'Gyanu Kumari', boid: '1301670000074891', is_primary: false },
      { name: 'Shanta Devi Dahal', boid: '1301670000152017', is_primary: false },
      { name: 'Aarushi', boid: '1301670000307100', is_primary: false },
      { name: 'Anil', boid: '1301060001301530', is_primary: false },
      { name: 'Swexya', boid: '1301370002378649', is_primary: false },
      { name: 'Kamala Adhikari', boid: '130107000060349', is_primary: false },
      { name: 'Vauju Mom', boid: '1301070000051277', is_primary: false },
      { name: 'Sadikshya', boid: '1301670000329572', is_primary: false },
      { name: 'Vauju Dad', boid: '1301070000051321', is_primary: false },
      { name: 'Dad', boid: '1301120000423024', is_primary: false },
      { name: 'Mom', boid: '1301670000015803', is_primary: false },
      { name: 'Narayan Paudel', boid: '1301070000051281', is_primary: false },
      { name: 'Santosh Adhikari', boid: '1301070000051258', is_primary: false },
      { name: 'Sagar Dai', boid: '1301070000051262', is_primary: false },
      { name: 'Vauju', boid: '1301070000051317', is_primary: false },
      { name: 'me', boid: '1301040001988202', is_primary: false },
      { name: 'jasmine', boid: '1301780000036078', is_primary: false }
    ];

    // 3. Insert BOIDs
    const sql = `
      INSERT INTO user_boids (user_id, name, boid, is_primary)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        is_primary = VALUES(is_primary),
        updated_at = NOW()
    `;

    for (const item of boidsData) {
      // pad BOID if needed (though the input seems mostly 16 digits, some are missing leading zeros if interpreted as numbers, but here they are strings)
      let boid = item.boid;
      if (boid.length < 16) {
        boid = boid.padStart(16, '0');
      }

      await pool.execute(sql, [userId, item.name, boid, item.is_primary ? 1 : 0]);
    }

    logger.info(`✓ Successfully seeded ${boidsData.length} user BOIDs.`);
  } catch (error) {
    logger.error('Failed to seed user BOIDs:', error);
    throw error;
  }
}

module.exports = { seed };
