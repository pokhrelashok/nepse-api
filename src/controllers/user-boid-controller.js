const { validateBoid } = require('../utils/boid-validator');
const { formatResponse, formatError } = require('../utils/formatter');
const {
  getUserBoids,
  addUserBoid,
  updateUserBoid,
  deleteUserBoid,
  getPrimaryBoid
} = require('../database/queries/user-boid-queries');
const logger = require('../utils/logger');

/**
 * Get all BOIDs for authenticated user
 * GET /api/user/boids
 */
exports.getBoids = async (req, res) => {
  try {
    const userId = req.currentUser?.id;

    if (!userId) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    const boids = await getUserBoids(userId);

    res.json(formatResponse({
      boids: boids,
      count: boids.length
    }, 'BOIDs retrieved successfully'));

  } catch (error) {
    logger.error('Error getting user BOIDs:', error);
    res.status(500).json(formatError('Failed to get BOIDs', 500));
  }
};

/**
 * Add a new BOID for authenticated user
 * POST /api/user/boids
 * Body: { name, boid, isPrimary? }
 */
exports.addBoid = async (req, res) => {
  try {
    const userId = req.currentUser?.id;
    const { name, boid, isPrimary } = req.body;

    if (!userId) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json(formatError('Name is required', 400));
    }

    if (!boid) {
      return res.status(400).json(formatError('BOID is required', 400));
    }

    // Validate BOID format
    const boidValidation = validateBoid(boid);
    if (!boidValidation.valid) {
      return res.status(400).json(formatError(boidValidation.error, 400));
    }

    // Add BOID
    const newBoid = await addUserBoid(userId, name, boid, isPrimary || false);

    logger.info(`BOID added for user ${userId}: ${name} (${boid})`);

    res.status(201).json(formatResponse({
      boid: newBoid
    }, 'BOID added successfully'));

  } catch (error) {
    logger.error('Error adding BOID:', error);

    // Handle duplicate BOID error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json(formatError('This BOID is already added to your account', 409));
    }

    res.status(500).json(formatError('Failed to add BOID', 500));
  }
};

/**
 * Update a BOID
 * PUT /api/user/boids/:boidId
 * Body: { name?, boid?, isPrimary? }
 */
exports.updateBoid = async (req, res) => {
  try {
    const userId = req.currentUser?.id;
    const { boidId } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    if (!boidId) {
      return res.status(400).json(formatError('BOID ID is required', 400));
    }

    // Validate BOID format if being updated
    if (updates.boid) {
      const boidValidation = validateBoid(updates.boid);
      if (!boidValidation.valid) {
        return res.status(400).json(formatError(boidValidation.error, 400));
      }
    }

    // Update BOID
    const result = await updateUserBoid(boidId, userId, updates);

    if (result.affectedRows === 0) {
      return res.status(404).json(formatError('BOID not found', 404));
    }

    logger.info(`BOID ${boidId} updated for user ${userId}`);

    res.json(formatResponse({
      updated: true
    }, 'BOID updated successfully'));

  } catch (error) {
    logger.error('Error updating BOID:', error);

    // Handle duplicate BOID error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json(formatError('This BOID is already added to your account', 409));
    }

    res.status(500).json(formatError('Failed to update BOID', 500));
  }
};

/**
 * Delete a BOID
 * DELETE /api/user/boids/:boidId
 */
exports.deleteBoid = async (req, res) => {
  try {
    const userId = req.currentUser?.id;
    const { boidId } = req.params;

    if (!userId) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    if (!boidId) {
      return res.status(400).json(formatError('BOID ID is required', 400));
    }

    // Delete BOID
    const result = await deleteUserBoid(boidId, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json(formatError('BOID not found', 404));
    }

    logger.info(`BOID ${boidId} deleted for user ${userId}`);

    res.json(formatResponse({
      deleted: true
    }, 'BOID deleted successfully'));

  } catch (error) {
    logger.error('Error deleting BOID:', error);
    res.status(500).json(formatError('Failed to delete BOID', 500));
  }
};

/**
 * Get primary BOID for authenticated user
 * GET /api/user/boids/primary
 */
exports.getPrimaryBoid = async (req, res) => {
  try {
    const userId = req.currentUser?.id;

    if (!userId) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    const primaryBoid = await getPrimaryBoid(userId);

    if (!primaryBoid) {
      return res.status(404).json(formatError('No primary BOID found', 404));
    }

    res.json(formatResponse({
      boid: primaryBoid
    }, 'Primary BOID retrieved successfully'));

  } catch (error) {
    logger.error('Error getting primary BOID:', error);
    res.status(500).json(formatError('Failed to get primary BOID', 500));
  }
};
