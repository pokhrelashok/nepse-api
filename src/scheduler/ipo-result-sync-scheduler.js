const { getAllCheckers } = require('../services/ipo-checker');
const {
  findIpoByCompanyAndShareType,
  updateIpoPublishedStatus,
  getUnpublishedIpos
} = require('../database/queries/ipo-queries');
const logger = require('../utils/logger');

/**
 * Sync IPO results from all providers
 * Fetches scripts from each provider and updates database with published_in status
 * @returns {Promise<Object>} - Summary of sync operation
 */
async function syncIpoResults() {
  logger.info('Starting IPO result sync...');

  const summary = {
    totalScriptsFound: 0,
    totalMatched: 0,
    totalUpdated: 0,
    providers: {},
    matches: [],
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
        matched: 0,
        updated: 0,
        errors: []
      };

      try {
        // Get scripts from provider
        const scripts = await checker.getScripts();
        summary.totalScriptsFound += scripts.length;
        summary.providers[providerId].scriptsFound = scripts.length;

        logger.info(`Found ${scripts.length} scripts from ${providerName}`);

        // Try to match each script with IPOs in database
        for (const script of scripts) {
          try {
            // Skip if no share type could be extracted
            if (!script.shareType) {
              logger.warn(`Skipping script with no share type: ${script.rawName}`);
              continue;
            }

            // Find matching IPO in database
            const matchingIpo = await findIpoByCompanyAndShareType(
              script.companyName,
              script.shareType
            );

            if (matchingIpo) {
              summary.totalMatched++;
              summary.providers[providerId].matched++;

              logger.info(`Matched: ${script.rawName} -> ${matchingIpo.company_name} (${matchingIpo.share_type})`);

              // Update published_in status
              await updateIpoPublishedStatus(matchingIpo.ipo_id, providerId);

              summary.totalUpdated++;
              summary.providers[providerId].updated++;

              summary.matches.push({
                provider: providerId,
                scriptName: script.rawName,
                ipoId: matchingIpo.ipo_id,
                companyName: matchingIpo.company_name,
                shareType: matchingIpo.share_type
              });

              logger.info(`Updated IPO ${matchingIpo.ipo_id} with published_in: ${providerId}`);
            } else {
              logger.info(`No match found for: ${script.companyName} (${script.shareType})`);
            }
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

    logger.info(`IPO result sync completed. Matched: ${summary.totalMatched}, Updated: ${summary.totalUpdated}`);
    return summary;

  } catch (error) {
    logger.error('IPO result sync failed:', error);
    throw error;
  }
}

/**
 * Get sync status - shows unpublished IPOs
 * @returns {Promise<Object>} - Status object
 */
async function getSyncStatus() {
  try {
    const unpublishedIpos = await getUnpublishedIpos();

    return {
      unpublishedCount: unpublishedIpos.length,
      unpublishedIpos: unpublishedIpos.map(ipo => ({
        ipoId: ipo.ipo_id,
        companyName: ipo.company_name,
        shareType: ipo.share_type,
        symbol: ipo.symbol,
        closingDate: ipo.closing_date
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
