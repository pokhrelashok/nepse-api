/**
 * Database Backup Scheduler
 * Creates MySQL dumps and uploads them to Backblaze B2 cloud storage
 * Scheduled to run daily at 5:00 AM Nepal time
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const B2 = require('backblaze-b2');
const logger = require('../utils/logger');

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp/nepse-backups';
const MAX_LOCAL_BACKUP_AGE_DAYS = 7;
const MAX_REMOTE_BACKUP_AGE_DAYS = 30;

// Database config from environment
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db'
};

// Backblaze config
const B2_CONFIG = {
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APPLICATION_KEY,
  bucketName: process.env.BACKBLAZE_BUCKET_NAME
};

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Create MySQL database dump
 * @returns {string} Path to the backup file
 */
function createDatabaseBackup() {
  ensureBackupDir();

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `nepse_db_backup_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  logger.info(`🗄️ Creating database backup: ${filename}`);

  // Build mysqldump command
  const mysqldumpCmd = [
    'mysqldump',
    `-h${DB_CONFIG.host}`,
    `-P${DB_CONFIG.port}`,
    `-u${DB_CONFIG.user}`,
    `-p${DB_CONFIG.password}`,
    '--single-transaction',
    '--quick',
    '--lock-tables=false',
    '--routines',
    '--triggers',
    DB_CONFIG.database,
    '|',
    'gzip',
    '>',
    filepath
  ].join(' ');

  try {
    execSync(mysqldumpCmd, {
      shell: '/bin/bash',
      stdio: 'pipe',
      timeout: 300000 // 5 minute timeout
    });

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    logger.info(`✅ Backup created: ${filename} (${sizeMB} MB)`);

    return filepath;
  } catch (error) {
    logger.error(`❌ Database backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Upload backup file to Backblaze B2
 * @param {string} filepath - Path to the backup file
 * @returns {Object} Upload result
 */
async function uploadToBackblaze(filepath) {
  if (!B2_CONFIG.applicationKeyId || !B2_CONFIG.applicationKey || !B2_CONFIG.bucketName) {
    throw new Error('Backblaze B2 credentials not configured');
  }

  const b2 = new B2({
    applicationKeyId: B2_CONFIG.applicationKeyId,
    applicationKey: B2_CONFIG.applicationKey
  });

  logger.info(`☁️ Uploading to Backblaze B2...`);

  try {
    // Authorize
    await b2.authorize();

    // Get bucket
    const { data: bucketData } = await b2.getBucket({ bucketName: B2_CONFIG.bucketName });
    const bucketId = bucketData.buckets[0].bucketId;

    // Get upload URL
    const { data: uploadUrlData } = await b2.getUploadUrl({ bucketId });

    // Read file and upload
    const filename = path.basename(filepath);
    const fileBuffer = fs.readFileSync(filepath);

    const { data: uploadData } = await b2.uploadFile({
      uploadUrl: uploadUrlData.uploadUrl,
      uploadAuthToken: uploadUrlData.authorizationToken,
      fileName: `backups/${filename}`,
      data: fileBuffer
    });

    logger.info(`✅ Uploaded to B2: ${uploadData.fileName} (${uploadData.contentLength} bytes)`);

    return {
      success: true,
      fileName: uploadData.fileName,
      fileId: uploadData.fileId,
      size: uploadData.contentLength
    };
  } catch (error) {
    logger.error(`❌ B2 upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Clean up old local backup files
 * @returns {number} Number of files deleted
 */
function cleanupLocalBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return 0;

  const now = Date.now();
  const maxAge = MAX_LOCAL_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  const files = fs.readdirSync(BACKUP_DIR);
  for (const file of files) {
    if (file.startsWith('nepse_db_backup_') && file.endsWith('.sql.gz')) {
      const filepath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filepath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filepath);
        deletedCount++;
        logger.info(`🗑️ Deleted old backup: ${file}`);
      }
    }
  }

  return deletedCount;
}

/**
 * Clean up old remote backups from Backblaze B2
 * @returns {number} Number of files deleted
 */
async function cleanupRemoteBackups() {
  if (!B2_CONFIG.applicationKeyId || !B2_CONFIG.applicationKey || !B2_CONFIG.bucketName) {
    logger.warn('⚠️ B2 credentials not configured, skipping remote cleanup');
    return 0;
  }

  const b2 = new B2({
    applicationKeyId: B2_CONFIG.applicationKeyId,
    applicationKey: B2_CONFIG.applicationKey
  });

  try {
    await b2.authorize();

    const { data: bucketData } = await b2.getBucket({ bucketName: B2_CONFIG.bucketName });
    const bucketId = bucketData.buckets[0].bucketId;

    // List files in backups folder
    const { data: fileList } = await b2.listFileNames({
      bucketId,
      prefix: 'backups/',
      maxFileCount: 100
    });

    const now = Date.now();
    const maxAge = MAX_REMOTE_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of fileList.files) {
      const age = now - file.uploadTimestamp;
      if (age > maxAge) {
        await b2.deleteFileVersion({
          fileId: file.fileId,
          fileName: file.fileName
        });
        deletedCount++;
        logger.info(`🗑️ Deleted remote backup: ${file.fileName}`);
      }
    }

    return deletedCount;
  } catch (error) {
    logger.error(`❌ Remote cleanup failed: ${error.message}`);
    return 0;
  }
}

/**
 * Main backup function - orchestrates the entire backup process
 * @returns {Object} Backup result
 */
async function runDatabaseBackup() {
  const startTime = Date.now();
  const result = {
    success: false,
    backupFile: null,
    uploadResult: null,
    localDeleted: 0,
    remoteDeleted: 0,
    duration: 0,
    error: null
  };

  try {
    // Step 1: Create database backup
    const backupPath = createDatabaseBackup();
    result.backupFile = path.basename(backupPath);

    // Step 2: Upload to Backblaze B2
    result.uploadResult = await uploadToBackblaze(backupPath);

    // Step 3: Cleanup old local backups
    result.localDeleted = cleanupLocalBackups();

    // Step 4: Cleanup old remote backups
    result.remoteDeleted = await cleanupRemoteBackups();

    result.success = true;
    result.duration = Date.now() - startTime;

    logger.info(`✅ Database backup completed in ${(result.duration / 1000).toFixed(1)}s`);

    return result;
  } catch (error) {
    result.error = error.message;
    result.duration = Date.now() - startTime;
    logger.error(`❌ Database backup failed: ${error.message}`);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });

  runDatabaseBackup()
    .then(result => {
      console.log('\n✅ Backup completed successfully');
      console.log(`   Backup: ${result.backupFile}`);
      console.log(`   Upload: ${result.uploadResult?.fileName || 'N/A'}`);
      console.log(`   Local cleaned: ${result.localDeleted} files`);
      console.log(`   Remote cleaned: ${result.remoteDeleted} files`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Backup failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  runDatabaseBackup,
  createDatabaseBackup,
  uploadToBackblaze,
  cleanupLocalBackups,
  cleanupRemoteBackups
};
