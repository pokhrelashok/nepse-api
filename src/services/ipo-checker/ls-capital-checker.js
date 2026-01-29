const axios = require('axios');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');

/**
 * LS Capital IPO Result Checker
 * Website: https://lscapital.com.np/ipo
 */
class LsCapitalChecker extends IpoResultChecker {
  constructor() {
    super('ls-capital', 'LS Capital Limited', { isApiBased: true });
    this.baseUrl = 'https://lscapital.com.np/frontapi/en';
  }

  /**
   * Normalize company name for matching
   */
  _normalizeCompanyName(name) {
    if (!name) return '';
    return name
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses and content
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private)\s*$/i, '') // Remove Ltd/Limited
      .replace(/\s+(Public|General Public|Foreign Employment|Locals|Foreign|Employees)\.?$/i, '') // Remove trailing share type
      .trim()
      .toLowerCase();
  }

  /**
   * Extract share type from company name
   */
  _extractShareType(name) {
    if (!name) return 'ordinary';
    const lowerName = name.toLowerCase();

    if (lowerName.includes('(public)')) return 'local'; // Based on previous mapping, though typically public = ordinary. Keeping logic consistent with observations or standardizing.
    // The previous implementation mapped "Public" to "local" which seems odd, usually "Public" is "ordinary".
    // Looking at the company list: "Mabilung Energy Limited (Public)" vs "(local)".
    // Usually "Public" means General Public -> Ordinary.
    // Let's refine based on typical keywords.

    if (lowerName.includes('public') || lowerName.includes('general public')) return 'ordinary';
    if (lowerName.includes('local') || lowerName.includes('affected')) return 'local';
    if (lowerName.includes('foreign') || lowerName.includes('migrant')) return 'foreign_employment';
    if (lowerName.includes('staff') || lowerName.includes('employee')) return 'promoter';
    if (lowerName.includes('mutual fund')) return 'mutual_fund';

    return 'ordinary';
  }

  /**
   * Get list of available IPO scripts from LS Capital
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

      // The API returns an array directly
      if (!Array.isArray(response.data)) {
        logger.warn('LS Capital API returned unexpected format for companies');
        return [];
      }

      const scripts = response.data.map(item => ({
        rawName: item.name,
        companyName: this._normalizeCompanyName(item.name),
        shareType: this._extractShareType(item.name),
        value: item.id // Use ID as value
      }));

      // Adjusting share type logic if needed based on rawName
      // Note: The previous logic had specific mappings, ensuring we cover them.

      return scripts;
    } catch (error) {
      logger.error('Error fetching scripts from LS Capital API:', error.message);
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
        logger.warn(`Company not found in LS Capital list: ${companyName}`);
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
        // "No query results for model..."
        return {
          success: true,
          boid: boid,
          allotted: false,
          units: null,
          message: 'Sorry, not allotted'
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
          // Allocated 0?
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
      // Check for 500 error which indicates not allotted or invalid combination
      if (error.response && error.response.status === 500) {
        return {
          success: true,
          boid: boid,
          allotted: false,
          units: null,
          message: 'Sorry, not allotted (500)'
        };
      }

      logger.error(`Error checking result in LS Capital API: ${error.message}`);
      return {
        success: false,
        message: 'Error connecting to LS Capital API'
      };
    }
  }
}

module.exports = LsCapitalChecker;
