const { getChecker } = require('../services/ipo-checker');
const { validateBoid } = require('../utils/boid-validator');
const { formatResponse, formatError } = require('../utils/formatter');
const { findIpoResult, getPublishedIpos } = require('../database/queries/ipo-queries');
const { pool } = require('../database/database');
const { formatShareType } = require('../utils/share-type-utils');
const logger = require('../utils/logger');

/**
 * Check IPO result for a given BOID, company name, and share type
 * POST /api/ipo/check-result
 * Body: { boid, companyName, shareType, provider? }
 */
exports.checkIpoResult = async (req, res) => {
  try {
    const { boid, companyName, shareType, provider } = req.body;

    // Validate required fields
    if (!boid) {
      return res.status(400).json(formatError('BOID is required', 400));
    }

    if (!companyName) {
      return res.status(400).json(formatError('Company name is required', 400));
    }

    if (!shareType) {
      return res.status(400).json(formatError('Share type is required', 400));
    }

    // Validate BOID format
    const boidValidation = validateBoid(boid);
    if (!boidValidation.valid) {
      return res.status(400).json(formatError(boidValidation.error, 400));
    }

    // Determine which provider to use
    let providerId = provider;

    // If no provider specified, check database for result entry in ipo_results
    if (!providerId) {
      // Note: companyName here should be the raw name from bank website if called from published list
      const resultEntry = await findIpoResult(companyName, shareType);

      if (!resultEntry) {
        return res.status(404).json(formatError(
          `Result not found for "${companyName}" with share type "${shareType}"`,
          404
        ));
      }

      providerId = resultEntry.provider_id;
      logger.info(`Using provider ${providerId} from ipo_results for ${companyName}`);
    }

    // Get appropriate checker for the provider
    let checker;
    try {
      checker = getChecker(providerId);
    } catch (error) {
      return res.status(400).json(formatError(error.message, 400));
    }

    // Check the result
    logger.info(`IPO result check request - Provider: ${providerId}, Company: ${companyName}, Share Type: ${shareType}, BOID: ${boid}`);
    const result = await checker.checkResult(boid, companyName, shareType);

    if (!result.success) {
      return res.status(500).json(formatError(result.message || 'Failed to check IPO result', 500, result));
    }

    res.json(formatResponse(result, 'IPO result checked successfully'));

  } catch (error) {
    logger.error('IPO result check error:', error);
    res.status(500).json(formatError('Failed to check IPO result', 500));
  }
};

/**
 * Check IPO results for authenticated user
 * POST /api/ipo/check-result
 * Body: { ipoId }
 * Requires authentication
 */
exports.checkIpoResultsBulk = async (req, res) => {
  try {
    const { ipoId } = req.body;
    const userId = req.currentUser?.id;

    if (!userId) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    if (!ipoId) {
      return res.status(400).json(formatError('IPO ID is required', 400));
    }

    // Get result details from ipo_results database
    const [resultsFromDb] = await pool.query(
      'SELECT provider_id, company_name, share_type, value FROM ipo_results WHERE id = ?',
      [ipoId]
    );

    if (!resultsFromDb || resultsFromDb.length === 0) {
      return res.status(404).json(formatError('IPO result entry not found', 404));
    }

    const ipoResult = resultsFromDb[0];

    // Get user's BOIDs
    const { getUserBoids } = require('../database/queries/user-boid-queries');
    const userBoids = await getUserBoids(userId);

    if (!userBoids || userBoids.length === 0) {
      return res.status(400).json(formatError('No BOIDs found for user. Please add your BOID first.', 400));
    }

    // Get appropriate checker for the provider
    const providerId = ipoResult.provider_id;
    let checker;
    try {
      checker = getChecker(providerId);
    } catch (error) {
      return res.status(500).json(formatError(`Provider ${providerId} not supported`, 500));
    }

    logger.info(`IPO result check - User: ${userId}, IPO: ${ipoResult.company_name} (ID: ${ipoId}, Value: ${ipoResult.value}), Provider: ${providerId}, BOIDs: ${userBoids.length}`);

    // Log parameters being passed to checker
    const shareTypePassed = formatShareType(ipoResult.share_type);
    logger.info(`Calling checker with: Company="${ipoResult.company_name}", ShareType="${shareTypePassed}" (Raw: "${ipoResult.share_type}")`);

    // Check results for all user BOIDs
    // This uses parallel calls for API-based checkers and browser-reuse for Puppeteer-based ones
    const boids = userBoids.map(b => b.boid);
    const bulkResults = await checker.checkResultBulk(boids, ipoResult.company_name, formatShareType(ipoResult.share_type));

    // Map bulk results back to include user-specific names and primary status
    const results = bulkResults.map((result, index) => {
      const boidEntry = userBoids.find(b => b.boid === result.boid) || userBoids[index];
      return {
        name: boidEntry.name,
        boid: boidEntry.boid,
        isPrimary: boidEntry.is_primary,
        ...result
      };
    });

    // Calculate summary
    const summary = {
      total: results.length,
      allotted: results.filter(r => r.allotted).length,
      notAllotted: results.filter(r => !r.allotted && r.success).length,
      errors: results.filter(r => !r.success).length
    };

    res.json(formatResponse({
      ipo: {
        id: ipoId,
        companyName: ipoResult.company_name,
        shareType: formatShareType(ipoResult.share_type)
      },
      provider: providerId,
      summary,
      results
    }, 'IPO results checked successfully'));

  } catch (error) {
    logger.error('Error checking IPO results:', error);
    res.status(500).json(formatError('Failed to check IPO results', 500));
  }
};

/**
 * Get published IPOs (IPOs with published results)
 * GET /api/ipo/published
 */
exports.getPublishedIpos = async (req, res) => {
  try {
    const search = req.query.search || null;

    const ipos = await getPublishedIpos(search);

    res.json(formatResponse(ipos, 'Published IPOs retrieved successfully'));

  } catch (error) {
    logger.error('Error getting published IPOs:', error);
    res.status(500).json(formatError('Failed to get published IPOs', 500));
  }
};
