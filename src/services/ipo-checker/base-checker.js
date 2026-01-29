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
    this.isApiBased = options.isApiBased || false;
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

  /**
   * Check IPO results for multiple BOIDs
   * Default implementation for API-based checkers uses Promise.all
   * Puppeteer-based checkers should override this to reuse browser
   * @param {Array<string>} boids - Array of 16-digit BOIDs
   * @param {string} companyName - Company name
   * @param {string} shareType - Share type (normalized)
   * @returns {Promise<Array>} - Array of result objects
   */
  async checkResultBulk(boids, companyName, shareType) {
    if (this.isApiBased) {
      // For API-based, we can safely parallelize all requests
      return Promise.all(boids.map(boid => this.checkResult(boid, companyName, shareType)));
    } else {
      // For Puppeteer-based (default if not overridden), run sequentially
      const results = [];
      for (const boid of boids) {
        results.push(await this.checkResult(boid, companyName, shareType));
      }
      return results;
    }
  }
}

module.exports = IpoResultChecker;
