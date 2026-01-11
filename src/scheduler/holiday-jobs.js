const logger = require('../utils/logger');
const HolidayService = require('../services/holiday-service');

/**
 * Runs the holiday synchronization job
 * @param {Object} scheduler The scheduler instance
 */
async function runHolidaySync(scheduler) {
  const jobKey = 'holiday_sync';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);
  await scheduler.updateStatus(jobKey, 'START', 'Syncing holidays from ShareHub...');

  try {
    const result = await HolidayService.syncHolidays();
    const msg = `Successfully synced ${result.count} holidays`;
    logger.info(`✅ ${msg}`);
    await scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Holiday sync job failed:', error);
    await scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  runHolidaySync
};
