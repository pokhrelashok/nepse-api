const logger = require('../utils/logger');
const HolidayService = require('../services/holiday-service');

/**
 * Scrapes IPO data
 * Called daily at 2:00 AM
 */
async function runIpoScrape(scheduler) {
  const jobKey = 'ipo_update';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping IPO scrape: Today is a market holiday');
    scheduler.isJobRunning.set(jobKey, false);
    return;
  }

  scheduler.updateStatus(jobKey, 'START', 'Starting IPO scrape...');

  logger.info('Starting scheduled IPO scrape...');

  try {
    const { scrapeIpos } = require('../scrapers/ipo-scraper');
    await scrapeIpos(false);

    scheduler.updateStatus(jobKey, 'SUCCESS', 'IPO scrape completed');
  } catch (error) {
    logger.error('Scheduled IPO scrape failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Scrapes FPO data
 * Called daily at 2:15 AM
 */
async function runFpoScrape(scheduler) {
  const jobKey = 'fpo_update';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping FPO scrape: Today is a market holiday');
    scheduler.isJobRunning.set(jobKey, false);
    return;
  }

  scheduler.updateStatus(jobKey, 'START', 'Starting FPO scrape...');

  logger.info('Starting scheduled FPO scrape...');

  try {
    const { scrapeFpos } = require('../scrapers/fpo-scraper');
    await scrapeFpos(false);

    scheduler.updateStatus(jobKey, 'SUCCESS', 'FPO scrape completed');
  } catch (error) {
    logger.error('Scheduled FPO scrape failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Scrapes announced dividend data
 * Called daily at 2:30 AM
 */
async function runDividendScrape(scheduler) {
  const jobKey = 'dividend_update';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping Dividend scrape: Today is a market holiday');
    scheduler.isJobRunning.set(jobKey, false);
    return;
  }

  scheduler.updateStatus(jobKey, 'START', 'Starting Dividend scrape...');

  logger.info('Starting scheduled Announced Dividend scrape...');

  try {
    const { scrapeDividends } = require('../scrapers/dividend-scraper');
    await scrapeDividends(false);

    scheduler.updateStatus(jobKey, 'SUCCESS', 'Dividend scrape completed');
  } catch (error) {
    logger.error('Scheduled Announced Dividend scrape failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Scrapes historical market indices data
 * DISABLED BY DEFAULT - Only for manual backfills
 * 
 * Problem: NEPSE's historical API returns stale data (closing_index=0) for today's date
 * which overwrites the correct data archived by archiveMarketIndex.
 * 
 * Solution: Use archiveMarketIndex for daily archiving from live Redis data.
 * Only run this manually when backfilling historical data.
 */
async function runMarketIndicesHistoryScrape(scheduler) {
  const jobKey = 'index_history_update';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Starting market indices history scrape...');

  logger.info('📊 Starting nightly market indices history scrape...');

  try {
    const { scrapeMarketIndicesHistory } = require('../scrapers/nepse-scraper');
    const { saveMarketIndexHistory } = require('../database/queries');

    const data = await scrapeMarketIndicesHistory();
    let count = 0;

    if (data && data.length > 0) {
      const indexNames = {
        58: 'NEPSE Index',
        57: 'Sensitive Index',
        59: 'Float Index',
        60: 'Sensitive Float Index'
      };

      const formattedData = data.map(record => ({
        business_date: record.businessDate,
        exchange_index_id: record.exchangeIndexId,
        index_name: indexNames[record.exchangeIndexId] || `Index ${record.exchangeIndexId}`,
        closing_index: parseFloat(record.closingIndex) || 0,
        open_index: parseFloat(record.openIndex) || 0,
        high_index: parseFloat(record.highIndex) || 0,
        low_index: parseFloat(record.lowIndex) || 0,
        fifty_two_week_high: parseFloat(record.fiftyTwoWeekHigh) || 0,
        fifty_two_week_low: parseFloat(record.fiftyTwoWeekLow) || 0,
        turnover_value: parseFloat(record.turnoverValue) || 0,
        turnover_volume: parseFloat(record.turnoverVolume) || 0,
        total_transaction: parseInt(record.totalTransaction) || 0,
        abs_change: parseFloat(record.absChange) || 0,
        percentage_change: parseFloat(record.percentageChange) || 0
      }));

      count = await saveMarketIndexHistory(formattedData);
      logger.info(`✅ Successfully saved ${count} historical index records`);
    }

    scheduler.updateStatus(jobKey, 'SUCCESS', `Saved ${count} historical records`);
  } catch (error) {
    logger.error('Scheduled market indices history scrape failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  runIpoScrape,
  runFpoScrape,
  runDividendScrape,
  runMarketIndicesHistoryScrape
};
