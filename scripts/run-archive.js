#!/usr/bin/env node

/**
 * Manually run the daily price archive job
 * Usage: node scripts/run-archive.js
 */

const { archiveTodaysPrices } = require('../src/scheduler/jobs/archive-daily-prices');
const { pool } = require('../src/database/database');

async function runArchive() {
  console.log('📦 Running daily price archive...\n');

  try {
    const result = await archiveTodaysPrices();

    console.log(`\n✅ SUCCESS: Archived ${result.recordsArchived} stock prices for ${result.date}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runArchive();
