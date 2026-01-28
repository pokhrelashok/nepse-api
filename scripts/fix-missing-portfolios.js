const { pool } = require('../src/database/database');
const { generateUuid } = require('../src/utils/uuid');
const logger = require('../src/utils/logger');

async function fixMissingPortfolios() {
  logger.info('Starting script to fix users with no portfolios...');

  try {
    // 1. Find users with 0 portfolios
    const [users] = await pool.execute(`
      SELECT u.id, u.email 
      FROM users u 
      LEFT JOIN portfolios p ON u.id = p.user_id 
      WHERE p.id IS NULL
    `);

    if (users.length === 0) {
      logger.info('No users found with missing portfolios. All good!');
      return;
    }

    logger.info(`Found ${users.length} users with no portfolios.`);

    for (const user of users) {
      const portfolioId = generateUuid();
      const portfolioName = 'Mine';
      const portfolioColor = '#00E676';

      try {
        await pool.execute(
          'INSERT INTO portfolios (id, user_id, name, color) VALUES (?, ?, ?, ?)',
          [portfolioId, user.id, portfolioName, portfolioColor]
        );
        logger.info(`Created default portfolio "${portfolioName}" for user: ${user.email} (${user.id})`);
      } catch (insertError) {
        logger.error(`Failed to create portfolio for user ${user.email}:`, insertError.message);
      }
    }

    logger.info('Maintenance script completed successfully.');
  } catch (error) {
    logger.error('Error running maintenance script:', error);
  } finally {
    // Don't close the pool if we're part of a larger app, 
    // but since this is a standalone script, we might need to if it doesn't exit.
    // However, some pools stay open. Let's force exit after a delay if needed.
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

fixMissingPortfolios();
