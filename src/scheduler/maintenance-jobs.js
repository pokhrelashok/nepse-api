const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * System cleanup - removes old temp files and downloads
 * Called daily at 4:30 AM
 */
async function runSystemCleanup(scheduler) {
  const jobKey = 'cleanup_update';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Starting system cleanup...');

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
      if (file.startsWith('nepse-scraper-') || file.startsWith('puppeteer_dev_chrome_profile-')) {
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

    // Cleanup 3: Journal logs (Linux only) - Keep only 1 day of logs
    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process');
        execSync('journalctl --vacuum-time=1d', { stdio: 'ignore' });
        logger.info('✅ Vacuumed system journal logs to 1 day');
      } catch (err) {
        // Might fail if not root or journalctl not available, ignore
      }
    }

    scheduler.updateStatus(jobKey, 'SUCCESS', msg || 'Cleanup completed');
  } catch (error) {
    logger.error('System cleanup failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Database backup
 * Called daily at 5:00 AM (after cleanup)
 */
async function runDatabaseBackup(scheduler) {
  const jobKey = 'db_backup';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Starting database backup...');

  logger.info('💾 Starting scheduled database backup...');

  try {
    const { runDatabaseBackup } = require('../schedulers/backupScheduler');
    const result = await runDatabaseBackup();

    const msg = `Backup: ${result.backupFile}, Uploaded: ${result.uploadResult?.fileName || 'N/A'}`;
    logger.info(`✅ ${msg}`);

    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Scheduled database backup failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

/**
 * Notification check - triggers various notification types
 * Called daily at 9:00 AM
 */
async function runNotificationCheck(scheduler) {
  const jobKey = 'notification_check';
  if (scheduler.isJobRunning.get(jobKey)) return;

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Starting notification check...');

  logger.info('📧 Starting scheduled notification check...');

  try {
    const NotificationService = require('../services/notification-service');
    const result = await NotificationService.checkAndSendNotifications();

    const msg = result?.message || 'Notification check completed';
    logger.info(`✅ ${msg}`);

    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Scheduled notification check failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  runSystemCleanup,
  runDatabaseBackup,
  runNotificationCheck
};
