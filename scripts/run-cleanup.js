#!/usr/bin/env node

/**
 * Manually run the system cleanup job
 * Usage: node scripts/run-cleanup.js
 */

const { runSystemCleanup } = require('../src/scheduler/maintenance-jobs');
const logger = require('../src/utils/logger');

// Mock scheduler object required by the job
const mockScheduler = {
  isJobRunning: new Map(),
  updateStatus: (job, status, message) => {
    logger.info(`[CLEANUP STATUS] ${job}: ${status} - ${message}`);
  }
};

async function main() {
  console.log('🧹 Starting manual system cleanup...\n');

  try {
    await runSystemCleanup(mockScheduler);
    console.log('\n✅ Manual cleanup execution finished.');
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    // Force exit after a moment to let logs finish if needed
    setTimeout(() => process.exit(0), 500);
  }
}

main();
