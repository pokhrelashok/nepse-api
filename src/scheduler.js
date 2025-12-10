const cron = require('node-cron');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { insertTodayPrices, updateMarketStatus } = require('./database/queries');
const { formatPricesForDatabase } = require('./utils/formatter');

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.scraper = new NepseScraper();
    this.isRunning = false;
  }

  async startPriceUpdateSchedule() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting price update scheduler...');

    // Price updates every 2 minutes during market hours (10 AM - 3 PM)
    const priceJob = cron.schedule('*/2 10-15 * * 1-5', async () => {
      await this.updatePricesAndStatus('DURING_HOURS');
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    // Market close status update (2 minutes after 3 PM)
    const closeJob = cron.schedule('2 15 * * 1-5', async () => {
      await this.updatePricesAndStatus('AFTER_CLOSE');
    }, {
      scheduled: false,
      timezone: 'Asia/Kathmandu'
    });

    this.jobs.set('priceUpdate', priceJob);
    this.jobs.set('closeUpdate', closeJob);

    priceJob.start();
    closeJob.start();

    this.isRunning = true;
    console.log('📅 Price update schedule started (every 2 min during hours + close update)');
  }

  async updatePricesAndStatus(phase) {
    console.log(`🕐 Scheduled ${phase === 'AFTER_CLOSE' ? 'close' : 'price'} update started...`);

    try {
      const isOpen = await this.scraper.scrapeMarketStatus();

      // Always update market status
      await updateMarketStatus(isOpen);
      console.log(`📊 Market status updated: ${isOpen ? 'OPEN' : 'CLOSED'}`);

      if (phase === 'DURING_HOURS' && isOpen) {
        console.log('✅ Market is open, updating prices...');
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
    } catch (error) {
      console.error('❌ Scheduled update failed:', error.message);
    }
  } async stopPriceUpdateSchedule() {
    const job = this.jobs.get('priceUpdate');
    if (job) {
      job.stop();
      this.jobs.delete('priceUpdate');
      console.log('🛑 Price update schedule stopped');
    }
  }

  async stopAllSchedules() {
    console.log('🛑 Stopping all scheduled jobs...');

    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`🛑 Stopped schedule: ${name}`);
    }
    this.jobs.clear();

    if (this.scraper) {
      await this.scraper.close();
      console.log('🛑 Scraper resources cleaned up');
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