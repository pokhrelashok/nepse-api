const axios = require('axios');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');
const { extractShareType } = require('./share-type-utils');

/**
 * NMB Capital IPO Result Checker
 * Website: https://nmbcl.com.np/ipo
 */
class NmbCapitalChecker extends IpoResultChecker {
  constructor() {
    super('nmb-capital', 'NMB Capital Limited', { isApiBased: true });
    this.baseUrl = 'https://www.nmbcl.com.np/frontapi/en';
  }

  /**
   * Normalize company name for matching
   */
  _normalizeCompanyName(name) {
    if (!name) return '';
    return name
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses and content
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private|FPO|IPO)\.?$/i, '') // Remove company suffixes
      .replace(/Re-Insurance/gi, 'reinsurance') // Normalize Re-Insurance to reinsurance
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim()
      .toLowerCase();
  }

  /**
   * Extract share type from company name
   */
  _extractShareType(name) {
    return extractShareType(name);
  }

  /**
   * Get list of available IPO scripts from NMB Capital
   */
  async getScripts() {
    try {
      const response = await axios.get(`${this.baseUrl}/ipo`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!Array.isArray(response.data)) {
        logger.warn('NMB Capital API returned unexpected format for companies');
        return [];
      }

      const scripts = response.data.map(item => ({
        rawName: item.name,
        companyName: this._normalizeCompanyName(item.name),
        shareType: this._extractShareType(item.name),
        value: item.id // Use ID as value
      }));

      return scripts;
    } catch (error) {
      logger.error('Error fetching scripts from NMB Capital API:', error.message);
      return [];
    }
  }

  /**
   * Check IPO result for given BOID and company
   */
  async checkResult(boid, companyName, shareType) {
    try {
      if (!companyName) {
        return { success: false, message: 'Company name is required' };
      }

      // Resolve company ID
      const scripts = await this.getScripts();
      const normalizedInputName = this._normalizeCompanyName(companyName);

      const matchedScript = scripts.find(s => s.companyName === normalizedInputName);

      if (!matchedScript) {
        logger.warn(`Company not found in NMB Capital list: ${companyName}`);
        return {
          success: true,
          allotted: false,
          units: null,
          message: `Company not found: ${companyName}`
        };
      }

      logger.info(`Checking IPO result for BOID: ${boid}, Company: ${companyName} (ID: ${matchedScript.value})`);

      const url = `${this.baseUrl}/ipo/filter?companyId=${matchedScript.value}&boidNumber=${boid}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const result = response.data;

      // Handle Failure Case
      if (result.error === true) {
        return {
          success: true,
          boid: boid,
          allotted: false,
          units: null,
          message: 'Not Allotted'
        };
      }

      // Handle Success Case
      if (result.error === false && result.data && result.data.allotments) {
        const allotment = result.data.allotments;
        const units = allotment.alloted_kitta ? parseInt(allotment.alloted_kitta) : 0;

        if (units > 0) {
          return {
            success: true,
            boid: boid,
            allotted: true,
            units: units,
            message: `Allotted ${units} units`
          };
        } else {
          return {
            success: true,
            boid: boid,
            allotted: false,
            units: 0,
            message: 'Allotted 0 units'
          };
        }
      }

      // Unknown state
      return {
        success: false,
        allotted: false,
        units: null,
        message: 'Unknown result state from API'
      };

    } catch (error) {
      if (error.response && error.response.status === 500) {
        // Assuming consistent behavior with LS Capital (same platform)
        return {
          success: true,
          boid: boid,
          allotted: false,
          units: null,
          message: 'Sorry, not allotted (500)'
        };
      }
      logger.error(`Error checking result in NMB Capital API: ${error.message}`);
      return {
        success: false,
        message: 'Error connecting to NMB Capital API'
      };
    }
  }
}

module.exports = NmbCapitalChecker;
