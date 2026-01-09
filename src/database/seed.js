const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { pool } = require('./database');

/**
 * Run all seed files in the seeds directory
 */
async function runSeeds() {
  try {
    logger.info('Starting database seeding...');

    const seedsDir = path.join(__dirname, 'seeds');

    // Check if seeds directory exists
    if (!fs.existsSync(seedsDir)) {
      logger.warn('Seeds directory not found. Skipping seeding.');
      return;
    }

    // Get all seed files (sorted alphabetically)
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    if (seedFiles.length === 0) {
      logger.info('No seed files found.');
      return;
    }

    logger.info(`Found ${seedFiles.length} seed file(s)`);

    // Run each seed file
    for (const file of seedFiles) {
      const seedPath = path.join(seedsDir, file);
      logger.info(`Running seed: ${file}`);

      const seedModule = require(seedPath);

      if (typeof seedModule.seed !== 'function') {
        logger.warn(`Seed file ${file} does not export a 'seed' function. Skipping...`);
        continue;
      }

      await seedModule.seed();
    }

    logger.info('✓ Database seeding completed successfully!');
  } catch (error) {
    logger.error('Failed to run seeds:', error);
    throw error;
  }
}

/**
 * Main function to run seeds
 */
async function main() {
  try {
    await runSeeds();
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    if (pool) {
      await pool.end();
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runSeeds };
