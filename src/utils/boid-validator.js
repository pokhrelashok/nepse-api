/**
 * BOID Validator Utility
 * Validates BOID (Beneficiary Owner Identification) format
 */

/**
 * Validates BOID format
 * @param {string} boid - BOID to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateBoid(boid) {
  if (!boid) {
    return {
      valid: false,
      error: 'BOID is required'
    };
  }

  // Convert to string if number
  const boidStr = String(boid);

  // Check if it's exactly 16 digits
  if (boidStr.length !== 16) {
    return {
      valid: false,
      error: 'BOID must be exactly 16 digits'
    };
  }

  // Check if it contains only numeric characters
  if (!/^\d+$/.test(boidStr)) {
    return {
      valid: false,
      error: 'BOID must contain only numeric characters'
    };
  }

  return {
    valid: true,
    error: null
  };
}

module.exports = {
  validateBoid
};
