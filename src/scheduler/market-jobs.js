const { DateTime } = require('luxon');
const logger = require('../utils/logger');
const { saveMarketIndex, saveMarketSummary, insertTodayPrices } = require('../database/queries');
const { formatPricesForDatabase } = require('../utils/formatter');
const HolidayService = require('../services/holiday-service');

/**
 * Updates market index data
 * Called every 20 seconds during market hours
 */
async function updateMarketIndex(scheduler, scraper, isMarketOpen, force = false) {
  const jobKey = 'index_update';

  // Only update when market is open (check time in Nepal timezone)
  const nepalTime = DateTime.now().setZone('Asia/Kathmandu');
  const hour = nepalTime.hour;
  const minutes = nepalTime.minute;
  const currentTime = hour * 100 + minutes;
  const day = nepalTime.weekday;

  const isTradingDay = [1, 2, 3, 4, 7].includes(day);
  const isMarketHours = currentTime >= 1100 && currentTime < 1500 && isTradingDay;

  if (!force && !isMarketHours && !isMarketOpen.value) {
    return;
  }

  // Holiday check
  if (!force && await HolidayService.isHoliday()) {
    logger.info('Skipping market index update: Today is a market holiday');
    return;
  }

  if (scheduler.isJobRunning.get(jobKey)) {
    return;
  }

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Updating market index...');

  try {
    // Scrape market index - this also captures market status from the same page load
    const indexData = await scraper.scrapeMarketIndex();

    // Get status from index data (captured from same page as index)
    const status = indexData.marketStatus || 'CLOSED';
    const isOpen = status === 'OPEN' || status === 'PRE_OPEN';
    isMarketOpen.value = isOpen;

    // Save index and status to database
    await saveMarketIndex(indexData, status);
    const msg = `Index: ${indexData.nepseIndex} (${indexData.indexChange > 0 ? '+' : ''}${indexData.indexChange}) [${status}]`;

    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Index update failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Updates prices and market status
 * Called every 2 minutes during hours, or after close
 */
async function updatePricesAndStatus(scheduler, scraper, phase, force = false) {
  const jobKey = phase === 'AFTER_CLOSE' ? 'close_update' : 'price_update';

  // Holiday check
  if (!force && await HolidayService.isHoliday()) {
    logger.info(`Skipping ${jobKey}: Today is a market holiday`);
    return;
  }

  // Prevent overlapping runs
  if (scheduler.isJobRunning.get(jobKey)) {
    logger.warn(`${jobKey} is already running, skipping...`);
    return;
  }

  scheduler.isJobRunning.set(jobKey, true);

  // Set a safety timeout to clear the lock if the job hangs indefinitely (e.g., 10 minutes)
  if (scheduler._jobTimeouts && scheduler._jobTimeouts.get(jobKey)) {
    clearTimeout(scheduler._jobTimeouts.get(jobKey));
  }

  if (!scheduler._jobTimeouts) scheduler._jobTimeouts = new Map();

  const timeoutDuration = 10 * 60 * 1000; // 10 minutes
  const timeoutId = setTimeout(async () => {
    logger.error(`⚠️ Job ${jobKey} timed out after 10 minutes! forcing reset.`);
    scheduler.isJobRunning.set(jobKey, false);
    scheduler.updateStatus(jobKey, 'FAIL', 'Job timed out (watchdog)');
  }, timeoutDuration);

  scheduler._jobTimeouts.set(jobKey, timeoutId);

  scheduler.updateStatus(jobKey, 'START', `Starting ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update...`);

  logger.info(`Scheduled ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update started...`);

  try {
    // Unified scraping call
    const summary = await scraper.scrapeMarketSummary();
    const { status, isOpen, indexData } = summary;

    await saveMarketSummary(summary);

    let msg = `Market status: ${status}`;

    if ((force || (phase === 'DURING_HOURS' && isOpen))) {
      const prices = await scraper.scrapeTodayPrices();
      if (prices && prices.length > 0) {
        const formattedPrices = formatPricesForDatabase(prices);
        await insertTodayPrices(formattedPrices);
        const updateMsg = `Updated ${prices.length} stock prices`;
        msg = updateMsg;

        const NotificationService = require('../services/notification-service');
        await NotificationService.checkAndSendPriceAlerts();
      } else {
        msg = 'No price data received';
      }
    } else if (phase === 'AFTER_CLOSE') {
      msg = 'Post-market close status update completed';
    } else {
      msg = 'Market is closed, skipping price update';
    }

    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Scheduled update failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    if (scheduler._jobTimeouts && scheduler._jobTimeouts.get(jobKey)) {
      clearTimeout(scheduler._jobTimeouts.get(jobKey));
      scheduler._jobTimeouts.delete(jobKey);
    }
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  updateMarketIndex,
  updatePricesAndStatus
};
