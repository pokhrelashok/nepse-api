const cron = require('node-cron');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { scrapeDividends } = require('./scrapers/dividend-scraper');
const { insertTodayPrices, updateMarketStatus, saveMarketIndex, getSecurityIdsWithoutDetails, getAllSecurityIds, insertCompanyDetails, insertDividends, insertFinancials } = require('./database/queries');
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
      indexUpdate: { lastRun: null, lastSuccess: null, successCount: 0, failCount: 0 },
      priceUpdate: { lastRun: null, lastSuccess: null, successCount: 0, failCount: 0 },
      closeUpdate: { lastRun: null, lastSuccess: null, successCount: 0, failCount: 0 },
      companyDetailsUpdate: { lastRun: null, lastSuccess: null, successCount: 0, failCount: 0 }
    };
  }

  // Get scheduler health/stats
  getHealth() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.getActiveJobs(),
      currentlyExecuting: Array.from(this.isJobRunning.entries()).filter(([, v]) => v).map(([k]) => k),
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

    this.jobs.set('indexUpdate', indexJob);
    this.jobs.set('priceUpdate', priceJob);
    this.jobs.set('closeUpdate', closeJob);
    this.jobs.set('companyDetailsUpdate', companyDetailsJob);

    // IPO Scraper (Once a day at 2:00 AM)
    const ipoJob = cron.schedule('0 2 * * *', async () => {
      await this.runIpoScrape();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('ipoUpdate', ipoJob);
    ipoJob.start();

    // Announced Dividends Scraper (Once a day at 2:30 AM)
    const dividendJob = cron.schedule('30 2 * * *', async () => {
      await this.runDividendScrape();
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });
    this.jobs.set('dividendUpdate', dividendJob);
    dividendJob.start();

    indexJob.start();
    priceJob.start();
    closeJob.start();
    companyDetailsJob.start();

    this.isRunning = true;
    logger.info('Scheduler started (index every 20s during hours, prices every 2 min, company details at 11:03)');
  }

  async updateMarketIndex() {
    const jobKey = 'indexUpdate';

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
    this.stats[jobKey].lastRun = new Date().toISOString();

    try {
      // Check market status
      const status = await this.scraper.scrapeMarketStatus();
      const isOpen = status === 'OPEN' || status === 'PRE_OPEN';
      this.isMarketOpen = isOpen;

      // Update market status in database
      await updateMarketStatus(status);

      if (isOpen) {
        // Scrape and save market index data
        const indexData = await this.scraper.scrapeMarketIndex();
        await saveMarketIndex(indexData);
        console.log(`📈 Index: ${indexData.nepseIndex} (${indexData.indexChange > 0 ? '+' : ''}${indexData.indexChange}) [${status}]`);

        this.stats[jobKey].lastSuccess = new Date().toISOString();
        this.stats[jobKey].successCount++;
      }
    } catch (error) {
      logger.error('Index update failed:', error);
      this.stats[jobKey].failCount++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async updatePricesAndStatus(phase) {
    const jobKey = phase === 'AFTER_CLOSE' ? 'closeUpdate' : 'priceUpdate';

    // Prevent overlapping runs
    if (this.isJobRunning.get(jobKey)) {
      logger.warn(`${jobKey} is already running, skipping...`);
      return;
    }

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].lastRun = new Date().toISOString();

    logger.info(`Scheduled ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update started...`);

    try {
      const status = await this.scraper.scrapeMarketStatus();
      const isOpen = status === 'OPEN' || status === 'PRE_OPEN';

      // Always update market status
      await updateMarketStatus(status);
      console.log(`📊 Market status updated: ${status}`);

      // Scrape and save market index data
      try {
        const indexData = await this.scraper.scrapeMarketIndex();
        await saveMarketIndex(indexData);
        console.log(`📈 Market index updated: ${indexData.nepseIndex} (${indexData.indexChange})`);
      } catch (indexError) {
        logger.warn('Failed to update market index:', indexError);
      }

      if (phase === 'DURING_HOURS' && isOpen) {
        console.log(`✅ Market is ${status}, updating prices...`);
        const prices = await this.scraper.scrapeTodayPrices();
        if (prices && prices.length > 0) {
          const formattedPrices = formatPricesForDatabase(prices);
          await insertTodayPrices(formattedPrices);
          console.log(`✅ Updated ${prices.length} stock prices`);
        } else {
          console.log('⚠️ No price data received');
        }
      } else if (phase === 'AFTER_CLOSE') {
        console.log('🔒 Post-market close status update completed');
      } else {
        console.log('🔒 Market is closed, skipping price update');
      }

      this.stats[jobKey].lastSuccess = new Date().toISOString();
      this.stats[jobKey].successCount++;
    } catch (error) {
      logger.error('Scheduled update failed:', error);
      this.stats[jobKey].failCount++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async updateCompanyDetails(fetchAll = false) {
    const jobKey = 'companyDetailsUpdate';

    // Prevent overlapping runs
    if (this.isJobRunning.get(jobKey)) {
      logger.warn(`${jobKey} is already running, skipping...`);
      return;
    }

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey].lastRun = new Date().toISOString();

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

      this.stats[jobKey].lastSuccess = new Date().toISOString();
      this.stats[jobKey].successCount++;
    } catch (error) {
      logger.error('Company details update failed:', error);
      this.stats[jobKey].failCount++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runIpoScrape() {
    const jobKey = 'ipoUpdate';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey] = this.stats[jobKey] || { lastRun: null, lastSuccess: null, successCount: 0, failCount: 0 };
    this.stats[jobKey].lastRun = new Date().toISOString();

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

      this.stats[jobKey].lastSuccess = new Date().toISOString();
      this.stats[jobKey].successCount++;
    } catch (error) {
      logger.error('Scheduled IPO scrape failed:', error);
      this.stats[jobKey].failCount++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async runDividendScrape() {
    const jobKey = 'dividendUpdate';
    if (this.isJobRunning.get(jobKey)) return;

    this.isJobRunning.set(jobKey, true);
    this.stats[jobKey] = this.stats[jobKey] || { lastRun: null, lastSuccess: null, successCount: 0, failCount: 0 };
    this.stats[jobKey].lastRun = new Date().toISOString();

    logger.info('Starting scheduled Announced Dividend scrape...');

    try {
      await scrapeDividends(false); // Default to incremental/page 1 if appropriate, maybe change to true if daily full check is needed

      this.stats[jobKey].lastSuccess = new Date().toISOString();
      this.stats[jobKey].successCount++;
    } catch (error) {
      logger.error('Scheduled Announced Dividend scrape failed:', error);
      this.stats[jobKey].failCount++;
    } finally {
      this.isJobRunning.set(jobKey, false);
    }
  }

  async stopPriceUpdateSchedule() {
    const job = this.jobs.get('priceUpdate');
    if (job) {
      job.stop();
      this.jobs.delete('priceUpdate');
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