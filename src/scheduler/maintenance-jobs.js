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
    const MAX_AGE_MS = 3600 * 1000;

    let deletedCount = 0;
    let keptCount = 0;
    let totalBytesDeleted = 0;

    // Helper function to get directory size recursively
    function getDirectorySize(dirPath) {
      let totalSize = 0;
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          try {
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
              totalSize += getDirectorySize(itemPath);
            } else {
              totalSize += stats.size;
            }
          } catch (err) {
            // Skip files we can't access
          }
        }
      } catch (err) {
        // Skip directories we can't access
      }
      return totalSize;
    }

    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      if (file.startsWith('nepse-scraper-') || file.startsWith('puppeteer_dev_chrome_profile-')) {
        const filePath = path.join(tmpDir, file);
        try {
          const stats = fs.statSync(filePath);
          const age = now - stats.mtimeMs;

          if (age > MAX_AGE_MS) {
            // Calculate size before deletion
            const size = stats.isDirectory() ? getDirectorySize(filePath) : stats.size;
            totalBytesDeleted += size;

            fs.rmSync(filePath, { recursive: true, force: true });
            deletedCount++;
          } else {
            keptCount++;
          }
        } catch (err) {
        }
      }
    }

    let msg = '';
    let totalFilesDeleted = deletedCount;

    if (deletedCount > 0) {
      const mbDeleted = (totalBytesDeleted / (1024 * 1024)).toFixed(2);
      logger.info(`✅ Cleaned up ${deletedCount} old temp directories (${mbDeleted} MB, kept ${keptCount} recent ones)`);
      msg += `Cleaned ${deletedCount} temp dirs (${mbDeleted} MB). `;
    } else if (keptCount > 0) {
      logger.info(`ℹ️ No old temp directories to clean (found ${keptCount} active/recent ones)`);
    } else {
      logger.info('ℹ️ No temp directories found');
    }

    const downloadsDir = '/home/nepse/Downloads';
    let csvDeletedCount = 0;
    let csvBytesDeleted = 0;

    try {
      if (fs.existsSync(downloadsDir)) {
        const downloadFiles = fs.readdirSync(downloadsDir);

        for (const file of downloadFiles) {
          if (file.toLowerCase().endsWith('.csv')) {
            const filePath = path.join(downloadsDir, file);
            try {
              const stats = fs.statSync(filePath);
              const age = now - stats.mtimeMs;

              if (age > MAX_AGE_MS) {
                csvBytesDeleted += stats.size;
                fs.unlinkSync(filePath);
                csvDeletedCount++;
              }
            } catch (err) {
            }
          }
        }

        if (csvDeletedCount > 0) {
          const csvMbDeleted = (csvBytesDeleted / (1024 * 1024)).toFixed(2);
          logger.info(`✅ Cleaned up ${csvDeletedCount} old CSV files from Downloads directory (${csvMbDeleted} MB)`);
          msg += `Cleaned ${csvDeletedCount} CSV files (${csvMbDeleted} MB). `;
          totalFilesDeleted += csvDeletedCount;
          totalBytesDeleted += csvBytesDeleted;
        }
      }
    } catch (err) {
    }

    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process');

        // 1. Clean System Journals (limit size to 50M)
        execSync('journalctl --vacuum-size=50M', { stdio: 'ignore' });

        // 2. Clean Apt Cache
        execSync('apt-get clean', { stdio: 'ignore' });

        // 3. Clean Old Log Files (*.gz and *.1)
        execSync("find /var/log -type f -name '*.gz' -delete", { stdio: 'ignore' });
        execSync("find /var/log -type f -name '*.1' -delete", { stdio: 'ignore' });

        logger.info('✅ Performed deep system cleanup (journals, apt cache, old logs)');
        msg += 'Deep system cleanup executed.';
      } catch (err) {
        logger.warn(`⚠️ Some system cleanup commands failed: ${err.message}`);
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
    const { runDatabaseBackup } = require('./jobs/backup-scheduler');
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
