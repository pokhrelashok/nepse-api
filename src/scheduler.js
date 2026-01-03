const cron = require('node-cron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { scrapeDividends } = require('./scrapers/dividend-scraper');
const { insertTodayPrices, saveMarketIndex, saveMarketSummary, getSecurityIdsWithoutDetails, getAllSecurityIds, insertCompanyDetails, insertDividends, insertFinancials } = require('./database/queries');
const { formatPricesForDatabase } = require('./utils/formatter');
const logger = require('./utils/logger');

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.scraper = new NepseScraper();
    this.isRunning = false;
    this.isMarketOpen = false; // Track market status for index updates
    this.isJobRunning = new Map(); // Track if a specific job is currently executing
    this.stats = {
      index_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0 },
      price_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0 },
      close_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0 },
      company_details_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0 },
      cleanup_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0 },
      price_archive: { last_run: null, last_success: null, success_count: 0, fail_count: 0 }
    };

  }

  // Get scheduler health/stats
  getHealth() {
    return {
      is_running: this.isRunning,
      active_jobs: this.getActiveJobs(),
      currently_executing: Array.from(this.isJobRunning.entries()).filter(([, v]) => v).map(([k]) => k),
      stats: this.stats
    };
  }


  async startPriceUpdateSchedule() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting price update scheduler...');

    // Market index updates every 20 seconds during market hours (10 AM - 3 PM)
    const indexJob = cron.schedule('*/20 * * * * *', async () => {
      await this.updateMarketIndex();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    // Price updates every 2 minutes during market hours (10 AM - 3 PM)
    const priceJob = cron.schedule('*/2 10-15 * * 0-4', async () => {
      await this.updatePricesAndStatus('DURING_HOURS');
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    // Market close status update (2 minutes after 3 PM)
    const closeJob = cron.schedule('2 15 * * 0-4', async () => {
      await this.updatePricesAndStatus('AFTER_CLOSE');
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    // Company details update at midnight (00:00) every day to avoid collision
    const companyDetailsJob = cron.schedule('0 0 * * *', async () => {
      await this.updateCompanyDetails(true); // true = force update all
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    this.jobs.set('index_update', indexJob);
    this.jobs.set('price_update', priceJob);
    this.jobs.set('close_update', closeJob);
    this.jobs.set('company_details_update', companyDetailsJob);


    // IPO Scraper (Once a day at 2:00 AM)
    const ipoJob = cron.schedule('0 2 * * *', async () => {
      await this.runIpoScrape();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('ipo_update', ipoJob);

    ipoJob.start();

    // Announced Dividends Scraper (Once a day at 2:30 AM)
    const dividendJob = cron.schedule('30 2 * * *', async () => {
      await this.runDividendScrape();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('dividend_update', dividendJob);

    // System Cleanup (Once a day at 4:30 AM - when no other jobs are running)
    const cleanupJob = cron.schedule('30 4 * * *', async () => {
      await this.runSystemCleanup();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('cleanup_update', cleanupJob);

    // Notifications (Daily at 9:00 AM)
    const notificationJob = cron.schedule('0 9 * * *', async () => {
      const NotificationService = require('./services/notification-service');
      await NotificationService.checkAndSendNotifications();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('notification_check', notificationJob);

    dividendJob.start();
    cleanupJob.start();
    notificationJob.start();

    // Daily Price Archive (at 3:05 PM, a few minutes after market closes)
    const archiveJob = cron.schedule('5 15 * * 0-4', async () => {
      await this.archiveDailyPrices();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('price_archive', archiveJob);
    archiveJob.start();

    indexJob.start();
    priceJob.start();
    closeJob.start();
    companyDetailsJob.start();

    // Market Indices History (Daily at 3:10 PM, after price archive)
    const indexHistoryJob = cron.schedule('10 15 * * 0-4', async () => {
      await this.runMarketIndicesHistoryScrape();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('index_history_update', indexHistoryJob);
    indexHistoryJob.start();

    this.isRunning = true;
    logger.info('Scheduler started (index every 20s during hours, prices every 2 min, archive at 3:05 PM)');
  }

  async updateMarketIndex() {
    const jobKey = 'index_update';


    // Only update when market is open (check time in Nepal timezone)
    const now = new Date();
    const nepalTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
    const hour = nepalTime.getHours();
    const minutes = nepalTime.getMinutes();
    const currentTime = hour * 100 + minutes;
    const day = nepalTime.getDay(); // 0 = Sunday, 4 = Thursday

    // Market hours: 10:30 AM - 3 PM on Sun-Thu (days 0-4)
    // Pre-open starts at 10:30
    const isMarketHours = currentTime >= 1030 && currentTime < 1500 && day >= 0 && day <= 4;

    if (!isMarketHours && !this.isMarketOpen) {
      // Skip silently outside market hours
      return;
    }

    // Prevent overlapping runs
    if (this.isJobRunning.get(jobKey)) {
      return;
    }

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].last_run = new Date().toISOString();


    try {
      // Scrape market index - this also captures market status from the same page load
      const indexData = await this.scraper.scrapeMarketIndex();

      // Get status from index data (captured from same page as index)
      const status = indexData.marketStatus || 'CLOSED';
      const isOpen = status === 'OPEN' || status === 'PRE_OPEN';
      this.isMarketOpen = isOpen;

      // Save index and status to database
      await saveMarketIndex(indexData, status);
      console.log(`📈 Index: ${indexData.nepseIndex} (${indexData.indexChange > 0 ? '+' : ''}${indexData.indexChange}) [${status}]`);

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Index update failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async updatePricesAndStatus(phase) {
    const jobKey = phase === 'AFTER_CLOSE' ? 'close_update' : 'price_update';


    // Prevent overlapping runs
    if (this.isJobRunning.get(jobKey)) {
      logger.warn(`${jobKey} is already running, skipping...`);
      return;
    }

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].last_run = new Date().toISOString();


    logger.info(`Scheduled ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update started...`);

    try {
      // Unified scraping call
      const summary = await this.scraper.scrapeMarketSummary();
      const { status, isOpen, indexData } = summary;

      // Save summary (index + status)
      await saveMarketSummary(summary);
      console.log(`📊 Market status: ${status}, Index: ${indexData.nepseIndex} (${indexData.indexChange})`);

      if (phase === 'DURING_HOURS' && isOpen) {
        console.log(`✅ Market is ${status}, updating prices...`);
        const prices = await this.scraper.scrapeTodayPrices();
        if (prices && prices.length > 0) {
          const formattedPrices = formatPricesForDatabase(prices);
          await insertTodayPrices(formattedPrices);
          console.log(`✅ Updated ${prices.length} stock prices`);

          // Trigger price alerts check
          const NotificationService = require('./services/notification-service');
          await NotificationService.checkAndSendPriceAlerts();
        } else {
          console.log('⚠️ No price data received');
        }
      } else if (phase === 'AFTER_CLOSE') {
        console.log('🔒 Post-market close status update completed');
      } else {
        console.log('🔒 Market is closed, skipping price update');
      }

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Scheduled update failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async updateCompanyDetails(fetchAll = false) {
    const jobKey = 'company_details_update';


    // Prevent overlapping runs
    if (this.isJobRunning.get(jobKey)) {
      logger.warn(`${jobKey} is already running, skipping...`);
      return;
    }

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].last_run = new Date().toISOString();


    console.log(`🏢 Scheduled company details update started (fetchAll: ${fetchAll})...`);

    try {
      let companiesToScrape;

      if (fetchAll) {
        // Get ALL companies for full update
        companiesToScrape = await getAllSecurityIds();
      } else {
        // Only get missing companies
        companiesToScrape = await getSecurityIdsWithoutDetails();
      }

      if (!companiesToScrape || companiesToScrape.length === 0) {
        console.log('✅ No companies found to update');
        return;
      }

      console.log(`📊 Found ${companiesToScrape.length} companies to update...`);

      // Scrape details
      const details = await this.scraper.scrapeAllCompanyDetails(
        companiesToScrape,
        insertCompanyDetails,
        insertDividends,
        insertFinancials
      );

      console.log(`✅ Scraped and saved details for ${details.length} companies`);

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Company details update failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async runIpoScrape() {
    const jobKey = 'ipo_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey] = this.stats[jobKey] || { last_run: null, last_success: null, success_count: 0, fail_count: 0 };
    this.stats[jobKey].last_run = new Date().toISOString();


    logger.info('Starting scheduled IPO scrape...');

    try {
      const { scrapeIpos } = require('./scrapers/ipo-scraper');
      // Run with checkAll=true for nightly full check, or false for incremental.
      // User said "default we will only check the first page", but "add a --all flag".
      // For nightly job, maybe we should check a few pages or just page 1 if frequent?
      // "run this code once a day at night ... add any new listing"
      // Default behavior of scraper (without --all) is page 1?
      // My scraper implementation checks page 1 by default if checkAll is false.
      // But for nightly, maybe we want to be safe?
      // Let's stick to default (page 1) as requested "by default we will only check the first page".
      // If user wants --all, they can run manual script.
      await scrapeIpos(false);

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Scheduled IPO scrape failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async runDividendScrape() {
    const jobKey = 'dividend_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey] = this.stats[jobKey] || { last_run: null, last_success: null, success_count: 0, fail_count: 0 };
    this.stats[jobKey].last_run = new Date().toISOString();


    logger.info('Starting scheduled Announced Dividend scrape...');

    try {
      await scrapeDividends(false); // Default to incremental/page 1 if appropriate, maybe change to true if daily full check is needed

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Scheduled Announced Dividend scrape failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async archiveDailyPrices() {
    const jobKey = 'price_archive';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].last_run = new Date().toISOString();

    logger.info('📦 Starting daily price archive...');

    try {
      const { archiveTodaysPrices } = require('./schedulers/archiveDailyPrices');
      const result = await archiveTodaysPrices();

      logger.info(`✅ Archived ${result.recordsArchived} stock prices for ${result.date}`);

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Daily price archive failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runMarketIndicesHistoryScrape() {
    const jobKey = 'index_history_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey] = this.stats[jobKey] || { last_run: null, last_success: null, success_count: 0, fail_count: 0 };
    this.stats[jobKey].last_run = new Date().toISOString();

    logger.info('📊 Starting nightly market indices history scrape...');

    try {
      const { scrapeMarketIndicesHistory } = require('./scrapers/nepse-scraper');
      const { saveMarketIndexHistory } = require('./database/queries');

      const data = await scrapeMarketIndicesHistory();

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

        const count = await saveMarketIndexHistory(formattedData);
        logger.info(`✅ Successfully saved ${count} historical index records`);
      }

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('Scheduled market indices history scrape failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runSystemCleanup() {
    const jobKey = 'cleanup_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].last_run = new Date().toISOString();

    logger.info('🧹 Starting scheduled system cleanup...');

    try {
      const tmpDir = os.tmpdir();
      const now = Date.now();
      const MAX_AGE_MS = 3600 * 1000; // 1 hour

      // Cleanup 1: Temp directories created by scraper
      let deletedCount = 0;
      let keptCount = 0;

      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        if (file.startsWith('nepse-scraper-')) {
          const filePath = path.join(tmpDir, file);
          try {
            const stats = fs.statSync(filePath);
            const age = now - stats.mtimeMs;

            if (age > MAX_AGE_MS) {
              fs.rmSync(filePath, { recursive: true, force: true });
              deletedCount++;
            } else {
              keptCount++;
            }
          } catch (err) {
            // Ignore errors (file might be gone or locked)
          }
        }
      }

      if (deletedCount > 0) {
        logger.info(`✅ Cleaned up ${deletedCount} old temp directories (kept ${keptCount} recent ones)`);
      } else if (keptCount > 0) {
        logger.info(`ℹ️ No old temp directories to clean (found ${keptCount} active/recent ones)`);
      } else {
        logger.info('ℹ️ No temp directories found');
      }

      // Cleanup 2: Downloads directory (CSV files from NEPSE scraper)
      const downloadsDir = '/home/nepse/Downloads';
      let csvDeletedCount = 0;

      try {
        if (fs.existsSync(downloadsDir)) {
          const downloadFiles = fs.readdirSync(downloadsDir);

          for (const file of downloadFiles) {
            // Only clean up CSV files (from NEPSE downloads)
            if (file.toLowerCase().endsWith('.csv')) {
              const filePath = path.join(downloadsDir, file);
              try {
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > MAX_AGE_MS) {
                  fs.unlinkSync(filePath);
                  csvDeletedCount++;
                }
              } catch (err) {
                // Ignore errors (file might be gone or locked)
              }
            }
          }

          if (csvDeletedCount > 0) {
            logger.info(`✅ Cleaned up ${csvDeletedCount} old CSV files from Downloads directory`);
          }
        }
      } catch (err) {
        // Directory doesn't exist or no permissions - this is fine on dev machines
        logger.info('ℹ️ Downloads directory not accessible (expected on dev machines)');
      }

      this.stats[jobKey].last_success = new Date().toISOString();
      this.stats[jobKey].success_count++;
    } catch (error) {
      logger.error('System cleanup failed:', error);
      this.stats[jobKey].fail_count++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async stopPriceUpdateSchedule() {
    const job = this.jobs.get('price_update');
    if (job) {
      job.stop();
      this.jobs.delete('price_update');

      console.log('🛑 Price update schedule stopped');
    }
  }

  async stopAllSchedules() {
    logger.info('Stopping all scheduled jobs...');

    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`🛑 Stopped schedule: ${name}`);
    }
    this.jobs.clear();

    if (this.scraper) {
      await this.scraper.close();
      logger.info('Scraper resources cleaned up');
    }

    this.isRunning = false;
  }

  getActiveJobs() {
    return Array.from(this.jobs.keys());
  }

  isSchedulerRunning() {
    return this.isRunning;
  }
}

module.exports = Scheduler;