const cron = require('node-cron');
const logger = require('../utils/logger');
const BaseScheduler = require('./base-scheduler');
const { NepseScraper } = require('../scrapers/nepse-scraper');

// Import all job modules
const { updateMarketIndex, updatePricesAndStatus } = require('./market-jobs');
const { updateCompanyDetails } = require('./company-jobs');
const { runIpoScrape, runFpoScrape, runDividendScrape, runMergerScrape, runMarketIndicesHistoryScrape, runMutualFundScrape, runSipScrape, runIpoResultSync } = require('./data-jobs');
const { archiveDailyPrices, archiveMarketIndex } = require('./archive-jobs');
const { runSystemCleanup, runDatabaseBackup, runNotificationCheck } = require('./maintenance-jobs');
const { generateStockSummaries, generateDailyMarketBlog } = require('./ai-analysis-jobs');
const { calculateFinancialMetrics } = require('./financial-metrics-jobs');
const { runHolidaySync } = require('./holiday-jobs');
const HolidayService = require('../services/holiday-service');

/**
 * Main Scheduler class that orchestrates all scheduled jobs
 */
class Scheduler extends BaseScheduler {
  constructor() {
    super();
    this.scraper = new NepseScraper();
    this.isMarketOpen = { value: false }; // Use object for reference passing
    this._jobTimeouts = new Map();
  }

  async startPriceUpdateSchedule() {
    await this.loadStats();

    logger.info('Starting scheduled jobs...');

    // Market Index Update (Every 20 seconds during market hours - when market is open)
    const indexJob = cron.schedule('*/20 * * * * *', async () => {
      await updateMarketIndex(this, this.scraper, this.isMarketOpen);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('index_update', indexJob);

    // Price Update (Every 30 seconds from 11 AM to 3 PM, Sunday-Thursday)
    const priceJob = cron.schedule('*/30 * 11-14 * * 0-4', async () => {
      await updatePricesAndStatus(this, this.scraper, 'DURING_HOURS');
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('price_update', priceJob);

    // After-Close Final Price Fetch and Status Check (At 3:01 PM)
    const closeJob = cron.schedule('1 15 * * 0-4', async () => {
      await updatePricesAndStatus(this, this.scraper, 'AFTER_CLOSE');
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('close_update', closeJob);

    // Company Details Update (Daily at 2:00 AM)
    const companyDetailsJob = cron.schedule('0 2 * * *', async () => {
      await updateCompanyDetails(this, this.scraper, false);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('company_details_update', companyDetailsJob);

    // IPO Scraper (Daily at 2:00 AM)
    const ipoJob = cron.schedule('0 2 * * *', async () => {
      await runIpoScrape(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('ipo_update', ipoJob);
    ipoJob.start();

    // FPO Scraper (Daily at 2:15 AM)
    const fpoJob = cron.schedule('15 2 * * *', async () => {
      await runFpoScrape(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('fpo_update', fpoJob);
    fpoJob.start();

    // Announced Dividends Scraper (Daily at 2:30 AM)
    const dividendJob = cron.schedule('30 2 * * *', async () => {
      await runDividendScrape(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('dividend_update', dividendJob);
    dividendJob.start();

    // Merger/Acquisition Scraper (Daily at 2:45 AM)
    const mergerJob = cron.schedule('45 2 * * *', async () => {
      await runMergerScrape(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('merger_update', mergerJob);
    mergerJob.start();

    // Mutual Fund NAV Scraper (Daily at 3:00 AM)
    const mutualFundJob = cron.schedule('0 3 * * *', async () => {
      await runMutualFundScrape(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('mutual_fund_update', mutualFundJob);
    mutualFundJob.start();

    // SIP Scraper (Daily at 3:15 AM)
    const sipJob = cron.schedule('15 3 * * *', async () => {
      await runSipScrape(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('sip_update', sipJob);
    sipJob.start();

    // System Cleanup (Daily at 4:30 AM - when no other jobs are running)
    const cleanupJob = cron.schedule('30 4 * * *', async () => {
      await runSystemCleanup(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('cleanup_update', cleanupJob);
    cleanupJob.start();

    // Notifications (Daily at 9:00 AM)
    const notificationJob = cron.schedule('0 9 * * *', async () => {
      await runNotificationCheck(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('notification_check', notificationJob);
    notificationJob.start();

    // IPO Result Sync (Daily at 10:30 AM)
    const ipoResultSyncJob = cron.schedule('30 10 * * *', async () => {
      await runIpoResultSync(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('ipo_result_sync', ipoResultSyncJob);
    ipoResultSyncJob.start();

    // Database Backup (Daily at 5:00 AM - after cleanup)
    const backupJob = cron.schedule('0 5 * * *', async () => {
      await runDatabaseBackup(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('db_backup', backupJob);
    backupJob.start();

    // Daily Price Archive (at 3:05 PM, a few minutes after market closes)
    const archiveJob = cron.schedule('5 15 * * 0-4', async () => {
      await archiveDailyPrices(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('price_archive', archiveJob);
    archiveJob.start();

    // Daily Market Index Archive (at 3:06 PM, after price archive)
    const marketIndexArchiveJob = cron.schedule('6 15 * * 0-4', async () => {
      await archiveMarketIndex(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('market_index_archive', marketIndexArchiveJob);
    marketIndexArchiveJob.start();

    // AI Stock Summary Generation (at 4:00 PM, after all data archiving is complete)
    // aiSummaryJob.start(); // Disabled in favor of on-demand generation

    // Daily Market Summary Blog Generation (at 4:30 PM, after all data archiving and stock summaries)
    const dailyMarketBlogJob = cron.schedule('30 16 * * 0-4', async () => {
      await generateDailyMarketBlog(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('daily_market_blog_generation', dailyMarketBlogJob);
    dailyMarketBlogJob.start();

    // Financial Metrics Calculation (at 3:30 PM, after market close, before AI summary)
    const financialMetricsJob = cron.schedule('30 15 * * 0-4', async () => {
      await calculateFinancialMetrics(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('financial_metrics_calculation', financialMetricsJob);
    financialMetricsJob.start();

    // Holiday Synchronization (Daily at 1:00 AM)
    const holidayJob = cron.schedule('0 1 * * *', async () => {
      await runHolidaySync(this);
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('holiday_sync', holidayJob);
    holidayJob.start();

    // Start core market jobs
    indexJob.start();
    priceJob.start();
    closeJob.start();
    companyDetailsJob.start();

    // Market Indices History Scraper - DISABLED
    // This scraper fetches historical data from NEPSE's API and should ONLY be used
    // for one-time historical backfills, NOT for daily updates.
    // 
    // Problem: NEPSE's historical API returns stale data (closing_index=0) for today's date
    // which overwrites the correct data archived by archiveMarketIndex at 3:06 PM.
    // 
    // Solution: Use archiveMarketIndex (3:06 PM) for daily archiving from live Redis data.
    // Only run runMarketIndicesHistoryScrape manually when backfilling historical data.
    //
    // To manually run historical backfill:
    //   bun run scripts/backfill-market-history.js
    //
    // const indexHistoryJob = cron.schedule('10 15 * * 0-4', async () => {
    //   await runMarketIndicesHistoryScrape(this);
    // }, {
    //   scheduled: false,
    //   timezone: 'Asia/Kathmandu'
    // });
    // this.jobs.set('index_history_update', indexHistoryJob);
    // indexHistoryJob.start();

    this.isRunning = true;
    logger.info('Scheduler started (index every 20s during hours, prices every 2 min from 11 AM, archive at 3:05 PM)');
  }

  async stopPriceUpdateSchedule() {
    const job = this.jobs.get('price_update');
    if (job) {
      job.stop();
      this.jobs.delete('price_update');
    }
  }

  async stopAllSchedules() {
    logger.info('Stopping all scheduled jobs...');

    for (const [name, job] of this.jobs) {
      job.stop();
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
