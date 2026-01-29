const { pool } = require('../src/database/database');
const { syncIpoResults } = require('../src/scheduler/ipo-result-sync-scheduler');
const logger = require('../src/utils/logger');

async function cleanupAndSync() {
  try {
    logger.info('Starting cleanup and sync for LS Capital...');

    // 1. Delete all LS Capital results to ensure a clean state
    const deleteSql = "DELETE FROM ipo_results WHERE provider_id = 'ls-capital'";
    const [deleteResult] = await pool.execute(deleteSql);
    logger.info(`Deleted ${deleteResult.affectedRows} incorrect LS Capital results.`);

    // 2. Trigger a fresh sync
    const summary = await syncIpoResults();
    logger.info('Sync completed successfully!');
    logger.info(`Total scripts found: ${summary.totalScriptsFound}`);
    logger.info(`Total saved: ${summary.totalSaved}`);

    // 3. Verify specific cases
    const verifySql = "SELECT company_name, share_type, value FROM ipo_results WHERE provider_id = 'ls-capital' AND company_name LIKE '%Modi Energy%'";
    const [rows] = await pool.execute(verifySql);
    logger.info('Verified Modi Energy mappings:');
    rows.forEach(row => {
      logger.info(`- ${row.company_name} | ${row.share_type} | ID: ${row.value}`);
    });

  } catch (error) {
    logger.error('Cleanup and sync failed:', error);
  } finally {
    await pool.end();
  }
}

cleanupAndSync();
