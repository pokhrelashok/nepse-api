const { getAllCheckers } = require('../services/ipo-checker');
const {
  insertIpoResult
} = require('../database/queries/ipo-queries');
const { processIpoResultNotifications } = require('../services/notifications/ipo-alerts');
const logger = require('../utils/logger');

/**
 * Sync IPO results from all providers
 * Fetches scripts from each provider and stores them in ipo_results table
 * @param {Object} options - Sync options
 * @param {boolean} options.sendNotifications - Whether to send notifications for new results
 * @returns {Promise<Object>} - Summary of sync operation
 */
async function syncIpoResults(options = {}) {
  const sendNotifications = options.sendNotifications !== false;
  logger.info(`Starting IPO result sync (Notifications: ${sendNotifications ? 'enabled' : 'disabled'})...`);

  const summary = {
    totalScriptsFound: 0,
    totalSaved: 0,
    providers: {},
    errors: []
  };

  try {
    // Get all provider checkers
    const checkers = getAllCheckers();

    for (const checker of checkers) {
      const providerId = checker.providerId;
      const providerName = checker.providerName;

      logger.info(`Fetching scripts from ${providerName}...`);

      summary.providers[providerId] = {
        name: providerName,
        scriptsFound: 0,
        saved: 0,
        errors: []
      };

      try {
        // Get scripts from provider
        const scripts = await checker.getScripts();
        summary.totalScriptsFound += scripts.length;
        summary.providers[providerId].scriptsFound = scripts.length;

        logger.info(`Found ${scripts.length} scripts from ${providerName}`);

        // Save each script to database
        for (const script of scripts) {
          try {
            // Skip if no share type could be extracted
            if (!script.shareType) {
              logger.warn(`Skipping script with no share type: ${script.rawName}`);
              continue;
            }

            // Save result to ipo_results table
            const result = await insertIpoResult({
              providerId: providerId,
              companyName: script.rawName, // Save the raw name as provided by the bank
              shareType: script.shareType,
              value: script.value === undefined ? null : script.value
            });

            if (result.isNew) {
              logger.info(`New IPO result detected: ${script.rawName} (${script.shareType}).`);

              if (sendNotifications) {
                logger.info('Sending notifications...');
                // Use non-blocking call for notifications to not delay the scraping loop
                processIpoResultNotifications({
                  providerId: providerId,
                  companyName: script.rawName,
                  shareType: script.shareType,
                  value: script.value
                }).catch(err => logger.error('Error in processIpoResultNotifications:', err));
              } else {
                logger.info('Notifications skipped due to flag.');
              }
            }

            summary.totalSaved++;
            summary.providers[providerId].saved++;

            logger.info(`Saved result: ${script.rawName} (${script.shareType}) from ${providerName}`);
          } catch (error) {
            logger.error(`Error processing script ${script.rawName}:`, error);
            summary.providers[providerId].errors.push({
              script: script.rawName,
              error: error.message
            });
            summary.errors.push({
              provider: providerId,
              script: script.rawName,
              error: error.message
            });
          }
        }
      } catch (error) {
        logger.error(`Error fetching scripts from ${providerName}:`, error);
        summary.providers[providerId].errors.push({
          error: error.message
        });
        summary.errors.push({
          provider: providerId,
          error: error.message
        });
      }
    }

    logger.info(`IPO result sync completed. Scripts found: ${summary.totalScriptsFound}, Saved: ${summary.totalSaved}`);
    return summary;

  } catch (error) {
    logger.error('IPO result sync failed:', error);
    throw error;
  }
}

/**
 * Get sync status - shows summary of results in ipo_results table
 * @returns {Promise<Object>} - Status object
 */
async function getSyncStatus() {
  try {
    const sql = `
      SELECT provider_id, COUNT(*) as result_count
      FROM ipo_results
      GROUP BY provider_id
    `;
    const [rows] = await pool.execute(sql);

    // Get latest results
    const [latestResults] = await pool.query(
      'SELECT provider_id, company_name, share_type, DATE_FORMAT(updated_at, "%Y-%m-%d %H:%i:%s") as updated_at FROM ipo_results ORDER BY updated_at DESC LIMIT 10'
    );

    return {
      providerStats: rows,
      latestResults: latestResults.map(r => ({
        providerId: r.provider_id,
        companyName: r.company_name,
        shareType: r.share_type,
        updatedAt: r.updated_at
      }))
    };
  } catch (error) {
    logger.error('Error getting sync status:', error);
    throw error;
  }
}

module.exports = {
  syncIpoResults,
  getSyncStatus
};
