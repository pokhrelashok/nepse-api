const axios = require('axios');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');
const { extractShareType } = require('./share-type-utils');

class KumariCapitalChecker extends IpoResultChecker {
  constructor() {
    super('kumari-capital', 'Kumari Capital Limited', { isApiBased: true });
    this.name = 'Kumari Capital';
    this.baseUrl = 'https://api-web.kumaricapital.com';
  }

  /**
   * Normalize company name for matching
   * @param {string} name 
   * @returns {string}
   */
  _normalizeCompanyName(name) {
    if (!name) return '';
    return name
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses and content
      .replace(/[-–]/g, ' ') // Replace hyphens with spaces
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private)/gi, '') // Remove Ltd/Limited globally
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .toLowerCase();
  }

  /**
   * Get available IPO scripts from API
   * Kumari Capital requires a two-step process:
   * 1. Get List of Companies (filter by type=others)
   * 2. For each company, get share details search types (the actual IPOs)
   */
  async getScripts() {
    try {
      // Step 1: Get Companies
      const companiesResponse = await axios.get(`${this.baseUrl}/items/company`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
          'Origin': 'https://kumaricapital.com',
          'Referer': 'https://kumaricapital.com/'
        }
      });

      const companiesData = companiesResponse.data.data || [];

      // Filter companies as per requirements: type 'others' or 'scheme'
      // Prompt says: "only scrape the companies with type others and scheme" which implies including both types.
      const validCompanies = companiesData.filter(c => ['others', 'scheme'].includes(c.type));

      if (validCompanies.length === 0) {
        logger.info('No companies found with type=others and scheme in Kumari Capital');
        return [];
      }

      const allScripts = [];

      // Step 2: For each company, get the IPO options
      // We use Promise.all to fetch in parallel
      const scriptPromises = validCompanies.map(async (company) => {
        try {
          const searchTypeUrl = `${this.baseUrl}/items/share_details_search_type?filter=${encodeURIComponent(JSON.stringify({ company: { _eq: company.id } }))}`;

          const searchTypeResponse = await axios.get(searchTypeUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
              'Origin': 'https://kumaricapital.com',
              'Referer': 'https://kumaricapital.com/'
            }
          });

          const searchTypes = searchTypeResponse.data.data || [];

          return searchTypes.map(item => {
            const shareType = extractShareType(item.title);
            // Construct a meaningful raw name, e.g. "Company Name - IPO Title"
            // or just use Company Name if title is generic
            const rawName = company.company_name;

            return {
              id: item.id,
              rawName: rawName,
              companyName: this._normalizeCompanyName(company.company_name),
              shareType: shareType,
              value: item.id // Store the search type ID as the value needed for checking
            };
          });

        } catch (err) {
          logger.error(`Error fetching search types for company ${company.company_name} (${company.id}):`, err.message);
          return [];
        }
      });

      const results = await Promise.all(scriptPromises);

      // Flatten results
      results.forEach(group => allScripts.push(...group));

      return allScripts;

    } catch (error) {
      logger.error(`Error fetching scripts from Kumari Capital`, error.message);
      return [];
    }
  }

  /**
   * Internal method to check using ID
   */
  async _checkWithId(boid, searchTypeId) {
    try {
      const url = `${this.baseUrl}/sharedetails/search-details?holderId=${boid}&type=2&share_details_search_type=${searchTypeId}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
          'Origin': 'https://kumaricapital.com',
          'Referer': 'https://kumaricapital.com/'
        }
      });

      const data = response.data.data;

      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        const units = result.allotted_kitta ? parseFloat(result.allotted_kitta) : 0;

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
      logger.error(`Error checking result in Kumari Capital API: ${error.message}`);
      return {
        success: false,
        message: `Error connecting to Kumari Capital API: ${error.message}`
      };
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

      const scripts = await this.getScripts();
      const normalizedInputName = this._normalizeCompanyName(companyName);

      let matchedScript = scripts.find(s => s.companyName === normalizedInputName && s.shareType === shareType);

      if (!matchedScript) {
        matchedScript = scripts.find(s => s.companyName === normalizedInputName);
      }

      if (!matchedScript) {
        logger.warn(`Company not found in Kumari Capital list: ${companyName}`);
        return {
          success: true,
          allotted: false,
          units: null,
          message: `Company not found: ${companyName}`
        };
      }

      return await this._checkWithId(boid, matchedScript.value);

    } catch (error) {
      logger.error(`Error in checkResult: ${error.message}`);
      return {
        success: false,
        message: `Error connecting to Kumari Capital API: ${error.message}`
      };
    }
  }

  /**
   * Bulk check - optimized to fetch scripts only once
   */
  async checkResultBulk(boids, companyName, shareType) {
    try {
      if (!companyName) {
        return boids.map(b => ({ success: false, boid: b, message: 'Company name is required' }));
      }

      // Fetch scripts once
      const scripts = await this.getScripts();
      const normalizedInputName = this._normalizeCompanyName(companyName);

      let matchedScript = scripts.find(s => s.companyName === normalizedInputName && s.shareType === shareType);

      if (!matchedScript) {
        matchedScript = scripts.find(s => s.companyName === normalizedInputName);
      }

      if (!matchedScript) {
        logger.warn(`Company not found in Kumari Capital list (Bulk): ${companyName}`);
        return boids.map(b => ({
          success: true,
          boid: b,
          allotted: false,
          units: null,
          message: `Company not found: ${companyName}`
        }));
      }

      const searchTypeId = matchedScript.value;

      // Execute checks in parallel
      return await Promise.all(boids.map(boid => this._checkWithId(boid, searchTypeId)));

    } catch (error) {
      logger.error(`Error in checkResultBulk: ${error.message}`);
      return boids.map(b => ({
        success: false,
        boid: b,
        message: `Error processing bulk check: ${error.message}`
      }));
    }
  }
}

module.exports = KumariCapitalChecker;
