const logger = require('../utils/logger');
const HolidayService = require('../services/holiday-service');

/**
 * Archives today's stock prices
 * Called daily at 3:05 PM (after market close)
 */
async function archiveDailyPrices(scheduler) {
  const jobKey = 'price_archive';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping price archive: Today is a market holiday');
    scheduler.isJobRunning.set(jobKey, false);
    return;
  }

  await scheduler.updateStatus(jobKey, 'START', 'Starting daily price archive...');

  logger.info('📦 Starting daily price archive...');

  try {
    const { archiveTodaysPrices } = require('./jobs/archive-daily-prices');
    const result = await archiveTodaysPrices();

    const msg = `Archived ${result.recordsArchived} stock prices for ${result.date}`;
    logger.info(`✅ ${msg}`);

    await scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Daily price archive failed:', error);
    await scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Archives today's market index
 * Called daily at 3:06 PM (after price archive)
 */
async function archiveMarketIndex(scheduler) {
  const jobKey = 'market_index_archive';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping market index archive: Today is a market holiday');
    scheduler.isJobRunning.set(jobKey, false);
    return;
  }

  await scheduler.updateStatus(jobKey, 'START', 'Starting market index archive...');

  logger.info('📊 Starting daily market index archive...');

  try {
    const { archiveTodaysMarketIndex } = require('./jobs/archive-market-index');
    const result = await archiveTodaysMarketIndex();

    const msg = `Archived market index ${result.index} (${result.change}) for ${result.date}`;
    logger.info(`✅ ${msg}`);

    await scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Market index archive failed:', error);
    await scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  archiveDailyPrices,
  archiveMarketIndex
};
