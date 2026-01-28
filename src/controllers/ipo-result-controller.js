const { getChecker } = require('../services/ipo-checker');
const { validateBoid } = require('../utils/boid-validator');
const { formatResponse, formatError } = require('../utils/formatter');
const { findIpoByCompanyAndShareType, getPublishedIpos } = require('../database/queries/ipo-queries');
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

    // If no provider specified, check database for published_in
    if (!providerId) {
      const ipo = await findIpoByCompanyAndShareType(companyName, shareType);

      if (!ipo) {
        return res.status(404).json(formatError(
          `IPO not found for company "${companyName}" with share type "${shareType}"`,
          404
        ));
      }

      if (!ipo.published_in) {
        return res.status(404).json(formatError(
          `Result not yet published for ${companyName} (${shareType})`,
          404,
          { ipo: { companyName: ipo.company_name, shareType: ipo.share_type, status: ipo.status } }
        ));
      }

      providerId = ipo.published_in;
      logger.info(`Using provider ${providerId} from database for ${companyName}`);
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

    // Get IPO details from database
    const { getIpos } = require('../database/queries/ipo-queries');
    const ipos = await getIpos({ id: ipoId });

    if (!ipos || ipos.length === 0) {
      return res.status(404).json(formatError('IPO not found', 404));
    }

    const ipo = ipos[0];

    // Check if result is published
    if (!ipo.published_in) {
      return res.status(404).json(formatError('IPO result not yet published', 404));
    }

    // Get user's BOIDs
    const { getUserBoids } = require('../database/queries/user-boid-queries');
    const userBoids = await getUserBoids(userId);

    if (!userBoids || userBoids.length === 0) {
      return res.status(400).json(formatError('No BOIDs found for user. Please add your BOID first.', 400));
    }

    // Get appropriate checker for the provider
    const providerId = ipo.published_in;
    let checker;
    try {
      checker = getChecker(providerId);
    } catch (error) {
      return res.status(500).json(formatError(`Provider ${providerId} not supported`, 500));
    }

    logger.info(`IPO result check - User: ${userId}, IPO: ${ipo.company_name}, Provider: ${providerId}, BOIDs: ${userBoids.length}`);

    // Check results for all user BOIDs in parallel
    const results = await Promise.all(
      userBoids.map(async (boidEntry) => {
        try {
          const result = await checker.checkResult(boidEntry.boid, ipo.company_name, ipo.share_type);
          return {
            name: boidEntry.name,
            boid: boidEntry.boid,
            isPrimary: boidEntry.is_primary,
            ...result
          };
        } catch (error) {
          logger.error(`Error checking BOID ${boidEntry.boid} for ${boidEntry.name}:`, error);
          return {
            name: boidEntry.name,
            boid: boidEntry.boid,
            isPrimary: boidEntry.is_primary,
            success: false,
            error: error.message,
            allotted: false,
            units: null,
            message: `Failed to check result: ${error.message}`
          };
        }
      })
    );

    // Calculate summary
    const summary = {
      total: results.length,
      allotted: results.filter(r => r.allotted).length,
      notAllotted: results.filter(r => !r.allotted && r.success).length,
      errors: results.filter(r => !r.success).length
    };

    res.json(formatResponse({
      ipo: {
        id: ipo.id,
        companyName: ipo.company_name,
        shareType: ipo.share_type,
        symbol: ipo.symbol
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
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const ipos = await getPublishedIpos(limit, offset);

    res.json(formatResponse(ipos, 'Published IPOs retrieved successfully'));

  } catch (error) {
    logger.error('Error getting published IPOs:', error);
    res.status(500).json(formatError('Failed to get published IPOs', 500));
  }
};
