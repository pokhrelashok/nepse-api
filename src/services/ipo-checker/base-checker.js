/**
 * Base class for IPO result checkers
 * All providers must implement this interface
 */
class IpoResultChecker {
  constructor(providerId, providerName) {
    this.providerId = providerId;
    this.providerName = providerName;
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
