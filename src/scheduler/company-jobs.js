const logger = require('../utils/logger');
const {
  getAllSecurityIds,
  getSecurityIdsWithoutDetails,
  getSecurityIdsFromRedis,
  insertCompanyDetails,
  insertDividends,
  insertFinancials
} = require('../database/queries');

/**
 * Updates company details (full or incremental)
 * Called at 2:00 AM daily (incremental) or on-demand (full)
 */
async function updateCompanyDetails(scheduler, scraper, fetchAll = false) {
  const jobKey = 'company_details_update';

  // Prevent overlapping runs
  if (scheduler.isJobRunning.get(jobKey)) {
    logger.warn(`${jobKey} is already running, skipping...`);
    return;
  }

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', `Starting company details update (fetchAll: ${fetchAll})...`);

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
      scheduler.updateStatus(jobKey, 'SUCCESS', msg);
      return;
    }

    const details = await scraper.scrapeAllCompanyDetails(
      companiesToScrape,
      insertCompanyDetails,
      insertDividends,
      insertFinancials
    );

    const msg = `Scraped and saved details for ${details.length} companies`;
    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
  } catch (error) {
    logger.error('Company details update failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  updateCompanyDetails
};
