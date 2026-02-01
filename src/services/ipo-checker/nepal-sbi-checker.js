const axios = require('axios');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');
const { extractShareType } = require('./share-type-utils');

/**
 * Nepal SBI Merchant Bank IPO Result Checker
 * Website: https://www.nsmbl.com.np/ipo
 */
class NepalSbiChecker extends IpoResultChecker {
  constructor() {
    super('nepal-sbi', 'Nepal SBI Merchant Banking Limited', { isApiBased: true });
    this.baseUrl = 'https://www.nsmbl.com.np/frontapi/en';
  }

  /**
   * Normalize company name for matching
   */
  _normalizeCompanyName(name) {
    if (!name) return '';
    return name
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses and content
      .replace(/\s+-\s+IPO\s+for\s+General\s+Public/i, '') // Remove "- IPO for General Public" suffix
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
   * Get list of available IPO scripts from Nepal SBI
   */
  async getScripts() {
    try {
      logger.info(`Nepal SBI: Fetching scripts from ${this.baseUrl}/ipo ...`);
      const response = await axios.get(`${this.baseUrl}/ipo`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nsmbl.com.np/ipo',
          'Origin': 'https://www.nsmbl.com.np',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 30000 // 30 seconds timeout
      });

      logger.info(`Nepal SBI: Received response (Status: ${response.status})`);

      if (!Array.isArray(response.data)) {
        logger.warn('Nepal SBI API returned unexpected format for companies');
        return [];
      }

      const scripts = response.data.map(item => ({
        rawName: item.name,
        companyName: this._normalizeCompanyName(item.name),
        shareType: this._extractShareType(item.name),
        value: item.id // Use ID as value
      }));

      logger.info(`Nepal SBI: Found ${scripts.length} scripts`);
      return scripts;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        logger.error(`Nepal SBI: Request timed out after 30s`);
      }
      logger.error('Error fetching scripts from Nepal SBI API:', error.message);
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
        logger.warn(`Company not found in Nepal SBI list: ${companyName}`);
        return {
          success: true,
          allotted: false,
          units: null,
          message: `Company not found: ${companyName}`
        };
      }

      logger.info(`Checking IPO result for BOID: ${boid}, Company: ${companyName} (ID: ${matchedScript.value})`);

      const url = `${this.baseUrl}/ipo/filter?companyId=${matchedScript.value}&boidNumber=${boid}`;

      logger.info(`Nepal SBI: Checking result via URL: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nsmbl.com.np/ipo',
          'Origin': 'https://www.nsmbl.com.np',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 30000 // 30s timeout
      });

      logger.info(`Nepal SBI: Check response status: ${response.status}`);

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
      if (error.code === 'ECONNABORTED') {
        logger.error(`Nepal SBI: Check result request timed out for BOID ${boid}`);
        return {
          success: false,
          message: 'Connection timed out'
        };
      }
      if (error.response && error.response.status === 500) {
        return {
          success: true,
          boid: boid,
          allotted: false,
          units: null,
          message: 'Sorry, not allotted (500)'
        };
      }
      logger.error(`Error checking result in Nepal SBI API: ${error.message}`);
      return {
        success: false,
        message: 'Error connecting to Nepal SBI API'
      };
    }
  }
}

module.exports = NepalSbiChecker;
