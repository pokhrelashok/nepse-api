const { DateTime } = require('luxon');
const { saveSchedulerStatus, getSchedulerStatus } = require('../database/queries');
const logger = require('../utils/logger');

/**
 * Base Scheduler - Handles stats tracking and status management
 */
class BaseScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.isMarketOpen = false;
    this.isJobRunning = new Map();
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

  async getHealth() {
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

      // Clean up any numeric keys that might have been added by previous bug
      // to the in-memory stats object
      for (const key of Object.keys(this.stats)) {
        if (!isNaN(key)) {
          delete this.stats[key];
        }
      }

      if (dbStats && Array.isArray(dbStats)) {
        logger.info('Loading scheduler stats from database...');
        for (const row of dbStats) {
          const key = row.job_name;
          // Only update if we track this job (ignore numeric keys if they leaked into DB)
          if (key && isNaN(key) && this.stats[key]) {
            this.stats[key] = { ...this.stats[key], ...row };
          }
        }
      } else if (dbStats && typeof dbStats === 'object') {
        // Fallback for object format
        logger.info('Loading scheduler stats from database (object format)...');
        for (const [key, val] of Object.entries(dbStats)) {
          if (isNaN(key) && this.stats[key]) {
            this.stats[key] = { ...this.stats[key], ...val };
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load scheduler stats from DB:', error);
    }
  }

  async updateStatus(jobKey, type, message = null) {
    const timestamp = new Date().toISOString();
    const todayStr = DateTime.now().setZone('Asia/Kathmandu').toISODate();

    if (!this.stats[jobKey]) {
      this.stats[jobKey] = {
        last_run: null, last_success: null,
        success_count: 0, fail_count: 0,
        today_success_count: 0, today_fail_count: 0, stats_date: null,
        status: 'IDLE', message: null
      };
    }
    const stat = this.stats[jobKey];

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
      stat.message = message || 'Completed successfully';
    } else if (type === 'FAIL') {
      stat.fail_count++;
      stat.today_fail_count++;
      stat.status = 'FAILED';
      stat.message = message || 'Failed';
    }

    saveSchedulerStatus(jobKey, stat).catch(() => { });
  }

  getActiveJobs() {
    return Array.from(this.jobs.keys());
  }

  async waitForJobsToFinish(timeoutMs = 15000) {
    const startTime = Date.now();
    while (Array.from(this.isJobRunning.values()).some(v => v)) {
      if (Date.now() - startTime > timeoutMs) {
        logger.warn('Timeout waiting for jobs to finish');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async stopAllSchedules() {
    logger.info('Stopping all scheduled jobs...');
    this.isRunning = false;

    for (const [name, job] of this.jobs.entries()) {
      if (job && job.stop) {
        job.stop();
        logger.info(`✅ Stopped job: ${name}`);
      }
    }

    await this.waitForJobsToFinish();

    this.jobs.clear();
    logger.info('✅ All jobs completed successfully');
  }
}

module.exports = BaseScheduler;
