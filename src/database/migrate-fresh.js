const mysql = require('mysql2/promise');
const { runMigrations } = require('./migrate');
const { runSeeds } = require('./seed');
const logger = require('../utils/logger');

// Database configuration from environment variables
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db',
  multipleStatements: true,
  timezone: '+05:45'
};

/**
 * Drop all tables in the database
 */
async function dropAllTables() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    logger.info(`Dropping all tables in database: ${dbConfig.database}`);

    // Disable foreign key checks to allow dropping tables with dependencies
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Get all table names
    const [tables] = await connection.execute(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
      [dbConfig.database]
    );

    if (tables.length === 0) {
      logger.info('No tables found to drop.');
    } else {
      for (const row of tables) {
        const tableName = row.TABLE_NAME || row.table_name;
        logger.info(`Dropping table: ${tableName}`);
        await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
      logger.info(`Successfully dropped ${tables.length} table(s).`);
    }

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

  } catch (error) {
    logger.error('Failed to drop tables:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Main function to run migrate:fresh
 */
async function main() {
  try {
    logger.warn('CAUTION: This will drop all tables and delete all data!');

    // Drop all tables
    await dropAllTables();

    // Run migrations
    logger.info('Starting fresh migrations...');
    await runMigrations();

    // Run seeds
    logger.info('Starting database seeding...');
    await runSeeds();

    logger.info('migrate:fresh completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('migrate:fresh failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
