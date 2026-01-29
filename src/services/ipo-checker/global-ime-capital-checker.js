const axios = require('axios');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');

class GlobalImeCapitalChecker extends IpoResultChecker {
  constructor() {
    super('global-ime-capital', 'Global IME Capital Limited');
    this.name = 'Global IME Capital';
    this.baseUrl = 'https://globalimecapital.com/api/v1/public';
  }

  /**
   * Normalize company name for matching
   * @param {string} name 
   * @returns {string}
   */
  _normalizeCompanyName(name) {
    if (!name) return '';
    return name
      .replace(/\(.*?\)/g, '') // Remove parentheses and content
      .replace(/[-–]/g, ' ') // Replace hyphens with spaces
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private)/gi, '') // Remove Ltd/Limited globally
      .replace(/\s+(Public|General Public|Foreign Employment|Locals|Foreign|Employees)\.?$/i, '') // Remove trailing share type
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .toLowerCase();
  }

  /**
   * Extract share type from company name
   * @param {string} name 
   * @returns {string}
   */
  _extractShareType(name) {
    if (!name) return 'ordinary'; // Default
    const lowerName = name.toLowerCase();

    if (lowerName.includes('foreign') || lowerName.includes('remittance') || lowerName.includes('migrant')) { // Expanded keywords
      return 'foreign_employment'; // Standardize to match DB enum if possible
    }
    if (lowerName.includes('local') || lowerName.includes('affected')) {
      return 'local';
    }
    if (lowerName.includes('staff') || lowerName.includes('employee')) {
      return 'promoter'; // Or staff/employee if supported
    }
    if (lowerName.includes('mutual fund')) {
      return 'mutual_fund';
    }
    return 'ordinary';
  }

  /**
   * Get available IPO scripts from API
   */
  async getScripts() {
    try {
      const response = await axios.get(`${this.baseUrl}/companies?type=share-allotment-check`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (response.data.status !== 'success') {
        logger.warn('Global IME API returned non-success status for companies');
        return [];
      }

      const companies = response.data.data || [];

      return companies.map(company => ({
        id: company.id,
        rawName: company.name,
        companyName: this._normalizeCompanyName(company.name),
        shareType: this._extractShareType(company.name),
        value: company.id // Store ID as the value
      }));

    } catch (error) {
      logger.error(`Error fetching scripts from Global IME Capital`, error.message);
      return [];
    }
  }

  /**
   * Check IPO result for given BOID and company
   */
  async checkResult(boid, companyName, shareType) {
    try {
      // Fetch scripts to find the company ID
      if (!companyName) {
        return { success: false, message: 'Company name is required' };
      }

      // We need to resolve the company ID from the name. 
      // Since this method might be called with a name stored in our DB, we need to match it back to the API list.
      const scripts = await this.getScripts();

      const normalizedInputName = this._normalizeCompanyName(companyName);
      // Note: shareType matching is secondary, usually name match is sufficient if normalized correctly.

      const matchedScript = scripts.find(s => s.companyName === normalizedInputName);

      if (!matchedScript) {
        logger.warn(`Company not found in Global IME list: ${companyName} (Normalized: ${normalizedInputName})`);
        // Fallback: Try looser match if needed, or return error
        return {
          success: true, // Verification technically succeeded (we checked), but company wasn't found
          allotted: false,
          units: null,
          message: `Company not found: ${companyName}`
        };
      }

      logger.info(`Checking IPO result for BOID: ${boid}, Company: ${companyName} (ID: ${matchedScript.id})`);

      const payload = {
        company_id: matchedScript.id,
        boid: boid
      };

      const response = await axios.post(`${this.baseUrl}/share-allotment-check`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://globalimecapital.com',
          'Referer': 'https://globalimecapital.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const data = response.data;

      if (data.status === 'success' && data.data && data.data.length > 0) {
        // Find the record with allotted units
        // The API returns an array, possibly for multiple applications?
        // Usually index 0 is enough, but let's check allotted_kitta
        const allotment = data.data[0];
        const units = allotment.allotted_kitta ? parseFloat(allotment.allotted_kitta) : 0;

        if (units > 0) {
          return {
            success: true,
            boid: boid,
            allotted: true,
            units: units,
            message: `Allotted ${units} units`
          };
        }
      }

      return {
        success: true,
        boid: boid,
        allotted: false,
        units: null,
        message: 'Sorry, not allotted'
      };

    } catch (error) {
      if (error.response && error.response.status === 422) {
        // 422 usually means "Unprocessable Entity", often returned for invalid combinations or no result found
        return {
          success: true,
          boid: boid,
          allotted: false,
          units: null,
          message: 'Sorry, not allotted (422)'
        };
      }

      logger.error(`Error checking result in Global IME API: ${error.message}`);
      return {
        success: false,
        message: 'Error connecting to Global IME API'
      };
    }
  }
}

module.exports = GlobalImeCapitalChecker;
