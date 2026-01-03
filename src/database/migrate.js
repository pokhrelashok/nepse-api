
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

// Database configuration from environment variables
const dbConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db',
  multipleStatements: true, // Allow multiple SQL statements
  timezone: '+05:45'
};

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const MIGRATIONS_TABLE = 'migrations';

/**
 * Create the migrations tracking table if it doesn't exist
 */
async function createMigrationsTable(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration VARCHAR(255) NOT NULL UNIQUE,
      batch INT NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_migrations_batch (batch)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  await connection.execute(sql);
  logger.info('Migrations table ready.');
}

/**
 * Get the next batch number
 */
async function getNextBatch(connection) {
  const [rows] = await connection.execute(
    `SELECT MAX(batch) as max_batch FROM ${MIGRATIONS_TABLE}`
  );
  return (rows[0].max_batch || 0) + 1;
}

/**
 * Get list of already executed migrations
 */
async function getExecutedMigrations(connection) {
  const [rows] = await connection.execute(
    `SELECT migration FROM ${MIGRATIONS_TABLE} ORDER BY id`
  );
  return rows.map(row => row.migration);
}

/**
 * Get all migration files from the migrations directory
 */
async function getMigrationFiles() {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort by filename (timestamp prefix ensures correct order)
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn(`Migrations directory not found: ${MIGRATIONS_DIR}`);
      return [];
    }
    throw error;
  }
}

/**
 * Read and return the contents of a migration file
 */
async function readMigrationFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  return await fs.readFile(filePath, 'utf8');
}

/**
 * Execute a single migration
 */
async function executeMigration(connection, filename, batch) {
  const sql = await readMigrationFile(filename);

  try {
    // Execute the migration SQL
    await connection.query(sql);

    // Record the migration
    await connection.execute(
      `INSERT INTO ${MIGRATIONS_TABLE} (migration, batch) VALUES (?, ?)`,
      [filename, batch]
    );

    logger.info(`✓ Migrated: ${filename}`);
    return { success: true, filename };
  } catch (error) {
    logger.error(`✗ Failed to migrate: ${filename}`, error);
    throw error;
  }
}

/**
 * Run pending migrations
 */
async function runMigrations(options = {}) {
  const { dryRun = false } = options;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    logger.info('Connected to database.');

    // Create migrations table if it doesn't exist
    await createMigrationsTable(connection);

    // Get executed migrations
    const executedMigrations = await getExecutedMigrations(connection);

    // Get all migration files
    const allMigrations = await getMigrationFiles();

    // Filter out already executed migrations
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );

    if (pendingMigrations.length === 0) {
      logger.info('Nothing to migrate.');
      return { executed: [], pending: [] };
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(m => logger.info(`  - ${m}`));

    if (dryRun) {
      logger.info('\nDry run mode - no migrations executed.');
      return { executed: [], pending: pendingMigrations };
    }

    // Get next batch number
    const batch = await getNextBatch(connection);

    // Execute each pending migration
    const executed = [];
    for (const migration of pendingMigrations) {
      await executeMigration(connection, migration, batch);
      executed.push(migration);
    }

    logger.info(`\n✓ Migrated ${executed.length} file(s) successfully.`);
    return { executed, pending: [] };

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Create migrations table if it doesn't exist
    await createMigrationsTable(connection);

    // Get executed migrations
    const executedMigrations = await getExecutedMigrations(connection);

    // Get all migration files
    const allMigrations = await getMigrationFiles();

    // Separate executed and pending
    const pending = allMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );

    console.log('\n=== Migration Status ===\n');

    if (executedMigrations.length > 0) {
      console.log('Executed migrations:');
      executedMigrations.forEach(m => console.log(`  ✓ ${m}`));
    } else {
      console.log('No migrations executed yet.');
    }

    if (pending.length > 0) {
      console.log('\nPending migrations:');
      pending.forEach(m => console.log(`  ○ ${m}`));
    } else {
      console.log('\nNo pending migrations.');
    }

    console.log(`\nTotal: ${allMigrations.length} | Executed: ${executedMigrations.length} | Pending: ${pending.length}\n`);

    return { executed: executedMigrations, pending };

  } catch (error) {
    logger.error('Failed to get migration status:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;

      case 'dry-run':
        await runMigrations({ dryRun: true });
        break;

      default:
        await runMigrations();
        break;
    }
    process.exit(0);
  } catch (error) {
    logger.error('Migration command failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  showStatus
};
