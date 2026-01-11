const { runHolidaySync } = require('../src/scheduler/holiday-jobs');
const logger = require('../src/utils/logger');

// Mock scheduler
const scheduler = {
  isJobRunning: new Map(),
  updateStatus: async (key, status, message) => {
    logger.info(`[Job Status Update] ${key}: ${status} - ${message}`);
  }
};

async function test() {
  logger.info('Starting manual holiday sync test...');
  try {
    await runHolidaySync(scheduler);
    logger.info('Manual holiday sync test completed.');
  } catch (error) {
    logger.error('Manual holiday sync test failed:', error);
  } finally {
    // Give it a moment to finish logging
    setTimeout(() => process.exit(0), 1000);
  }
}

test();
