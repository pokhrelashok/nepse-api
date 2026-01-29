/**
 * Base class for IPO result checkers
 * All providers must implement this interface
 */
const DEFAULT_TIMEOUT = 300000; // 5 minutes in milliseconds

class IpoResultChecker {
  constructor(providerId, providerName, options = {}) {
    this.providerId = providerId;
    this.providerName = providerName;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Get list of IPO scripts (companies with published results)
   * Each provider implements its own parsing and normalization logic
   * @returns {Promise<Array>} - Array of { rawName, companyName, shareType, value }
   */
  async getScripts() {
    throw new Error('getScripts() must be implemented by subclass');
  }

  /**
   * Check IPO result for a given BOID and company
   * @param {string} boid - Beneficiary Owner ID
   * @param {string} companyName - Company name
   * @param {string} shareType - Share type (normalized)
   * @returns {Promise<Object>} - Result object
   */
  async checkResult(boid, companyName, shareType) {
    throw new Error('checkResult() must be implemented by subclass');
  }
}

module.exports = IpoResultChecker;
