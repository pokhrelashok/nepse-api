const cron = require('node-cron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { scrapeDividends } = require('./scrapers/dividend-scraper');
const { insertTodayPrices, saveMarketIndex, saveMarketSummary, getSecurityIdsWithoutDetails, getAllSecurityIds, insertCompanyDetails, insertDividends, insertFinancials, saveSchedulerStatus, getSchedulerStatus } = require('./database/queries');
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
      index_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      price_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      close_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      company_details_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      cleanup_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      price_archive: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      market_index_archive: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      index_history_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      ipo_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      fpo_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      dividend_update: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      db_backup: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null },
      notification_check: { last_run: null, last_success: null, success_count: 0, fail_count: 0, today_success_count: 0, today_fail_count: 0, stats_date: null, status: 'IDLE', message: null }
    };


  }

  // Get scheduler health/stats
  async getHealth() {
    // Ensure stats are up to date from DB if needed, but we try to keep them in sync
    // For extra safety, we could fetch from DB here, but let's rely on memory for speed + DB init
    return {
      is_running: this.isRunning,
      active_jobs: this.getActiveJobs(),
      currently_executing: Array.from(this.isJobRunning.entries()).filter(([, v]) => v).map(([k]) => k),
      stats: this.stats
    };
  }

  async loadStats() {
    try {
      const dbStats = await getSchedulerStatus();
      if (dbStats && Object.keys(dbStats).length > 0) {
        logger.info('Loading scheduler stats from database...');
        // Merge DB stats into this.stats
        // We only overwrite if DB has data
        for (const [key, val] of Object.entries(dbStats)) {
          if (this.stats[key]) {
            this.stats[key] = { ...this.stats[key], ...val };
          } else {
            this.stats[key] = val;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load scheduler stats from DB:', error);
    }
  }

  async updateStatus(jobKey, type, message = null) {
    const timestamp = new Date().toISOString();

    // Get today's date in Nepal timezone
    const now = new Date();
    const nepaliDate = new Date(now.getTime() + (5.75 * 60 * 60 * 1000));
    const todayStr = nepaliDate.toISOString().split('T')[0];

    // Initialize if missing
    if (!this.stats[jobKey]) {
      this.stats[jobKey] = {
        last_run: null, last_success: null,
        success_count: 0, fail_count: 0,
        today_success_count: 0, today_fail_count: 0, stats_date: null,
        status: 'IDLE', message: null
      };
    }
    const stat = this.stats[jobKey];

    // Reset daily counts if date has changed
    if (stat.stats_date !== todayStr) {
      stat.today_success_count = 0;
      stat.today_fail_count = 0;
      stat.stats_date = todayStr;
    }

    if (type === 'START') {
      stat.last_run = timestamp;
      stat.status = 'RUNNING';
      if (message) stat.message = message;
    } else if (type === 'SUCCESS') {
      stat.last_success = timestamp;
      stat.success_count++;
      stat.today_success_count++;
      stat.status = 'SUCCESS';
      // Only Keep success message if provided, otherwise keep "Running..." message or set to "Completed"
      stat.message = message || 'Completed successfully';
    } else if (type === 'FAIL') {
      stat.fail_count++;
      stat.today_fail_count++;
      stat.status = 'FAILED';
      stat.message = message || 'Failed';
    }

    // Fire and forget - don't await DB write
    saveSchedulerStatus(jobKey, stat).catch(err => {
      // Reducing log noise for DB errors on status updates
      // console.error('Failed to save scheduler status:', err.message);
    });
  }



  async startPriceUpdateSchedule() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting price update scheduler...');

    // Load persisted stats
    await this.loadStats();

    // Market index updates every 20 seconds during market hours (10 AM - 3 PM)
    const indexJob = cron.schedule('*/20 * * * * *', async () => {
      await this.updateMarketIndex();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    // Price updates every 1 minutes during market hours (11 AM - 3 PM)
    const priceJob = cron.schedule('*/1 11-15 * * 0-4', async () => {
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

    // FPO Scraper (Once a day at 2:15 AM - after IPO scraper)
    const fpoJob = cron.schedule('15 2 * * *', async () => {
      await this.runFpoScrape();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('fpo_update', fpoJob);

    fpoJob.start();

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
      await this.runNotificationCheck();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('notification_check', notificationJob);

    dividendJob.start();
    cleanupJob.start();
    notificationJob.start();

    // Database Backup (Daily at 5:00 AM - after cleanup)
    const backupJob = cron.schedule('0 5 * * *', async () => {
      await this.runDatabaseBackup();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('db_backup', backupJob);
    backupJob.start();

    // Daily Price Archive (at 3:05 PM, a few minutes after market closes)
    const archiveJob = cron.schedule('5 15 * * 0-4', async () => {
      await this.archiveDailyPrices();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('price_archive', archiveJob);
    archiveJob.start();

    // Daily Market Index Archive (at 3:06 PM, after price archive)
    const marketIndexArchiveJob = cron.schedule('6 15 * * 0-4', async () => {
      await this.archiveMarketIndex();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('market_index_archive', marketIndexArchiveJob);
    marketIndexArchiveJob.start();

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
    logger.info('Scheduler started (index every 20s during hours, prices every 2 min from 11 AM, archive at 3:05 PM)');
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

    // Market hours: 11:00 AM - 3 PM on Sun-Thu (days 0-4)
    // Starting at 11 AM to avoid stale cached data from NEPSE website before trading begins
    const isMarketHours = currentTime >= 1100 && currentTime < 1500 && day >= 0 && day <= 4;

    if (!isMarketHours && !this.isMarketOpen) {
      // Skip silently outside market hours
      return;
    }

    // Prevent overlapping runs
    if (this.isJobRunning.get(jobKey)) {
      return;
    }

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Updating market index...');

    try {
      // Scrape market index - this also captures market status from the same page load
      const indexData = await this.scraper.scrapeMarketIndex();

      // Get status from index data (captured from same page as index)
      const status = indexData.marketStatus || 'CLOSED';
      const isOpen = status === 'OPEN' || status === 'PRE_OPEN';
      this.isMarketOpen = isOpen;

      // Save index and status to database
      await saveMarketIndex(indexData, status);
      const msg = `Index: ${indexData.nepseIndex} (${indexData.indexChange > 0 ? '+' : ''}${indexData.indexChange}) [${status}]`;
      console.log(`📈 ${msg}`);

      this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Index update failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
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

    // Safety: Update last run time in DB to indicate liveliness, 
    // but primarily we trust in-memory. However, if we crashed, DB has old state.
    // If we are starting fresh (constructor), we loaded stats. 
    // If stats say RUNNING but we just started, we should probably reset it? (Already handled in constructor implicitly by isRunning=false)
    // The issue here is if the JOB hangs but process doesn't restart.

    // Set a safety timeout to clear the lock if the job hangs indefinitely (e.g., 10 minutes)
    // Only set if not already set (though we cleared it in finally)
    if (this._jobTimeouts && this._jobTimeouts.get(jobKey)) {
      clearTimeout(this._jobTimeouts.get(jobKey));
    }

    if (!this._jobTimeouts) this._jobTimeouts = new Map();

    const timeoutDuration = 10 * 60 * 1000; // 10 minutes
    const timeoutId = setTimeout(async () => {
      logger.error(`⚠️ Job ${jobKey} timed out after 10 minutes! forcing reset.`);
      this.isJobRunning.set(jobKey, false);
      this.updateStatus(jobKey, 'FAIL', 'Job timed out (watchdog)');
    }, timeoutDuration);

    this._jobTimeouts.set(jobKey, timeoutId);

    this.updateStatus(jobKey, 'START', `Starting ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update...`);

    logger.info(`Scheduled ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update started...`);

    try {
      // Unified scraping call
      const summary = await this.scraper.scrapeMarketSummary();
      const { status, isOpen, indexData } = summary;

      // Save summary (index + status)
      await saveMarketSummary(summary);
      console.log(`📊 Market status: ${status}, Index: ${indexData.nepseIndex} (${indexData.indexChange})`);

      let msg = `Market status: ${status}`;

      if (phase === 'DURING_HOURS' && isOpen) {
        console.log(`✅ Market is ${status}, updating prices...`);
        const prices = await this.scraper.scrapeTodayPrices();
        if (prices && prices.length > 0) {
          const formattedPrices = formatPricesForDatabase(prices);
          await insertTodayPrices(formattedPrices);
          const updateMsg = `Updated ${prices.length} stock prices`;
          console.log(`✅ ${updateMsg}`);
          msg = updateMsg;

          // Trigger price alerts check
          const NotificationService = require('./services/notification-service');
          await NotificationService.checkAndSendPriceAlerts();
        } else {
          console.log('⚠️ No price data received');
          msg = 'No price data received';
        }
      } else if (phase === 'AFTER_CLOSE') {
        msg = 'Post-market close status update completed';
        console.log(`🔒 ${msg}`);
      } else {
        msg = 'Market is closed, skipping price update';
        console.log(`🔒 ${msg}`);
      }

      this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Scheduled update failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      if (this._jobTimeouts && this._jobTimeouts.get(jobKey)) {
        clearTimeout(this._jobTimeouts.get(jobKey));
        this._jobTimeouts.delete(jobKey);
      }
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
    this.updateStatus(jobKey, 'START', `Starting company details update (fetchAll: ${fetchAll})...`);


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
        const msg = 'No companies found to update';
        console.log(`✅ ${msg}`);
        this.updateStatus(jobKey, 'SUCCESS', msg);
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

      const msg = `Scraped and saved details for ${details.length} companies`;
      console.log(`✅ ${msg}`);

      this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Company details update failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async runIpoScrape() {
    const jobKey = 'ipo_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting IPO scrape...');


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

      this.updateStatus(jobKey, 'SUCCESS', 'IPO scrape completed');
    } catch (error) {
      logger.error('Scheduled IPO scrape failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async runFpoScrape() {
    const jobKey = 'fpo_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting FPO scrape...');

    logger.info('Starting scheduled FPO scrape...');

    try {
      const { scrapeFpos } = require('./scrapers/fpo-scraper');
      await scrapeFpos(false);

      this.updateStatus(jobKey, 'SUCCESS', 'FPO scrape completed');
    } catch (error) {
      logger.error('Scheduled FPO scrape failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runDividendScrape() {
    const jobKey = 'dividend_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting Dividend scrape...');


    logger.info('Starting scheduled Announced Dividend scrape...');

    try {
      await scrapeDividends(false); // Default to incremental/page 1 if appropriate, maybe change to true if daily full check is needed

      this.updateStatus(jobKey, 'SUCCESS', 'Dividend scrape completed');
    } catch (error) {
      logger.error('Scheduled Announced Dividend scrape failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {

      this.isJobRunning.set(jobKey, false);
    }
  }

  async archiveDailyPrices() {
    const jobKey = 'price_archive';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    await this.updateStatus(jobKey, 'START', 'Starting daily price archive...');

    logger.info('📦 Starting daily price archive...');

    try {
      const { archiveTodaysPrices } = require('./schedulers/archiveDailyPrices');
      const result = await archiveTodaysPrices();

      const msg = `Archived ${result.recordsArchived} stock prices for ${result.date}`;
      logger.info(`✅ ${msg}`);

      await this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Daily price archive failed:', error);
      await this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async archiveMarketIndex() {
    const jobKey = 'market_index_archive';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    await this.updateStatus(jobKey, 'START', 'Starting market index archive...');

    logger.info('📊 Starting daily market index archive...');

    try {
      const { archiveTodaysMarketIndex } = require('./schedulers/archiveMarketIndex');
      const result = await archiveTodaysMarketIndex();

      const msg = `Archived market index ${result.index} (${result.change}) for ${result.date}`;
      logger.info(`✅ ${msg}`);

      await this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Market index archive failed:', error);
      await this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runMarketIndicesHistoryScrape() {
    const jobKey = 'index_history_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting market indices history scrape...');

    logger.info('📊 Starting nightly market indices history scrape...');

    try {
      const { scrapeMarketIndicesHistory } = require('./scrapers/nepse-scraper');
      const { saveMarketIndexHistory } = require('./database/queries');

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

      this.updateStatus(jobKey, 'SUCCESS', `Saved ${count} historical records`);
    } catch (error) {
      logger.error('Scheduled market indices history scrape failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runSystemCleanup() {
    const jobKey = 'cleanup_update';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting system cleanup...');

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

      let msg = '';
      if (deletedCount > 0) {
        logger.info(`✅ Cleaned up ${deletedCount} old temp directories (kept ${keptCount} recent ones)`);
        msg += `Cleaned ${deletedCount} temp dirs. `;
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
            msg += `Cleaned ${csvDeletedCount} CSV files.`;
          }
        }
      } catch (err) {
        // Directory doesn't exist or no permissions - this is fine on dev machines
        logger.info('ℹ️ Downloads directory not accessible (expected on dev machines)');
      }

      this.updateStatus(jobKey, 'SUCCESS', msg || 'Cleanup completed');
    } catch (error) {
      logger.error('System cleanup failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runDatabaseBackup() {
    const jobKey = 'db_backup';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting database backup...');

    logger.info('💾 Starting scheduled database backup...');

    try {
      const { runDatabaseBackup } = require('./schedulers/backupScheduler');
      const result = await runDatabaseBackup();

      const msg = `Backup: ${result.backupFile}, Uploaded: ${result.uploadResult?.fileName || 'N/A'}`;
      logger.info(`✅ ${msg}`);

      this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Scheduled database backup failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runNotificationCheck() {
    const jobKey = 'notification_check';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.updateStatus(jobKey, 'START', 'Starting notification check...');

    logger.info('📧 Starting scheduled notification check...');

    try {
      const NotificationService = require('./services/notification-service');
      const result = await NotificationService.checkAndSendNotifications();

      const msg = result?.message || 'Notification check completed';
      logger.info(`✅ ${msg}`);

      this.updateStatus(jobKey, 'SUCCESS', msg);
    } catch (error) {
      logger.error('Scheduled notification check failed:', error);
      this.updateStatus(jobKey, 'FAIL', error.message);
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

  async waitForJobsToFinish(timeoutMs = 15000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const activeJobs = Array.from(this.isJobRunning.entries())
        .filter(([_, isRunning]) => isRunning)
        .map(([key, _]) => key);

      if (activeJobs.length === 0) {
        return true;
      }

      logger.info(`Waiting for jobs to complete: ${activeJobs.join(', ')}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  async stopAllSchedules() {
    logger.info('Stopping all scheduled jobs...');

    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`🛑 Stopped schedule: ${name}`);
    }
    this.jobs.clear();

    const graceful = await this.waitForJobsToFinish();
    if (!graceful) {
      logger.warn('⚠️ Some jobs did not finish in time, forcing shutdown...');
    } else {
      logger.info('✅ All jobs completed successfully');
    }

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