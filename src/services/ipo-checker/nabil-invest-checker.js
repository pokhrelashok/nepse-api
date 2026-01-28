const BrowserManager = require('../../utils/browser-manager');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');

/**
 * Nabil Invest IPO Result Checker
 * Uses Puppeteer to scrape results from result.nabilinvest.com.np
 */
class NabilInvestChecker extends IpoResultChecker {
  constructor() {
    super('nabil-invest', 'Nabil Investment Banking Limited');
    this.url = 'https://result.nabilinvest.com.np/search/ipo-share';
  }

  /**
   * Normalize company name - removes Ltd/Limited and extra whitespace
   * @param {string} name - Raw company name
   * @returns {string} - Normalized name
   */
  _normalizeCompanyName(name) {
    return name
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses and content
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private)\s*$/i, '') // Remove Ltd/Limited
      .trim()
      .toLowerCase();
  }

  /**
   * Extract and normalize share type from company name string
   * Examples:
   *   "Company Name (General Public)" -> "ordinary"
   *   "Company Name (Public)" -> "local"
   *   "Company Name (Foreign Employment)" -> "migrant_workers"
   *   "Company Name (Foreign)" -> "foreign"
   * @param {string} name - Full company name with share type in parentheses
   * @returns {string|null} - Normalized share type
   */
  _extractShareType(name) {
    const match = name.match(/\((.*?)\)/);
    if (!match) return null;

    const shareTypeText = match[1].trim().toLowerCase();

    // Map Nabil Invest share types to database format
    const shareTypeMap = {
      'general public': 'ordinary',
      'public': 'local',
      'foreign employment': 'migrant_workers',
      'foreign': 'foreign',
      'mutual fund': 'mutual_fund',
      'employees': 'employees',
      'project affected': 'local'
    };

    return shareTypeMap[shareTypeText] || null;
  }

  /**
   * Get list of IPO scripts from Nabil Invest
   * @returns {Promise<Array>} - Array of script objects
   */
  async getScripts() {
    const browserManager = new BrowserManager();
    let browser;
    try {
      await browserManager.init();
      browser = browserManager.getBrowser();

      const page = await browser.newPage();
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extract company options from dropdown
      const scripts = await page.evaluate(() => {
        const select = document.querySelector('select[aria-label="company"]');
        if (!select) return [];

        const options = Array.from(select.querySelectorAll('option'));
        return options
          .filter(opt => opt.value && opt.value !== '')
          .map(opt => ({
            rawName: opt.textContent.trim(),
            value: opt.value
          }));
      });

      // Parse each script to extract company name and share type
      const parsedScripts = scripts.map(script => {
        const companyName = this._normalizeCompanyName(script.rawName);
        const shareType = this._extractShareType(script.rawName);

        return {
          rawName: script.rawName,
          companyName: companyName,
          shareType: shareType,
          value: script.value
        };
      }).filter(script => script.shareType !== null); // Filter out unparseable entries

      logger.info(`Fetched ${parsedScripts.length} IPO scripts from Nabil Invest`);
      return parsedScripts;

    } catch (error) {
      logger.error('Error fetching scripts from Nabil Invest:', error);
      throw new Error(`Failed to fetch scripts: ${error.message}`);
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Check IPO result for given BOID and company
   * @param {string} boid - 16-digit BOID
   * @param {string} companyName - Company name (will be matched against scripts)
   * @param {string} shareType - Normalized share type
   * @returns {Promise<Object>} - Result object
   */
  async checkResult(boid, companyName, shareType) {
    const browserManager = new BrowserManager();
    let browser;
    try {
      logger.info(`Checking IPO result for BOID: ${boid}, Company: ${companyName}, Share Type: ${shareType}`);

      await browserManager.init();
      browser = browserManager.getBrowser();

      const page = await browser.newPage();
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Get all scripts and find matching one
      // Note: We're calling getScripts recursively which creates another browser interaction.
      // This is slightly inefficient but safer for isolation. 
      // Ideally we should cache scripts or reuse browser if possible but getScripts closes its browser.
      // Let's just call getScripts first before opening this browser to be safe or just call it here?
      // Actually calling this.getScripts() here will instantiate ANOTHER BrowserManager and browser.
      // That's fine, Puppeteer can handle multiple browsers, but sequential is better.
      // However, checkResult flow implies we are already inside a task.

      // OPTIMIZATION: Manually fetch scripts using the CURRENT browser page to avoid double launch
      // Extract company options from dropdown (Reusing logic from getScripts)
      const scriptsData = await page.evaluate(() => {
        const select = document.querySelector('select[aria-label="company"]');
        if (!select) return [];
        return Array.from(select.querySelectorAll('option'))
          .filter(opt => opt.value && opt.value !== '')
          .map(opt => ({ rawName: opt.textContent.trim(), value: opt.value }));
      });

      const scripts = scriptsData.map(script => ({
        rawName: script.rawName,
        companyName: this._normalizeCompanyName(script.rawName),
        shareType: this._extractShareType(script.rawName),
        value: script.value
      })).filter(s => s.shareType !== null);

      // Normalize input company name for matching
      const normalizedInputName = this._normalizeCompanyName(companyName);

      // Find matching script by company name and share type
      const matchingScript = scripts.find(script =>
        script.companyName === normalizedInputName && script.shareType === shareType
      );

      if (!matchingScript) {
        const availableScripts = scripts.map(s => `${s.companyName} (${s.shareType})`).join(', ');
        throw new Error(`No matching IPO found for "${companyName}" with share type "${shareType}". Available: ${availableScripts}`);
      }

      logger.info(`Found matching script: ${matchingScript.rawName}`);

      // Fill the form and submit
      await page.select('select[aria-label="company"]', matchingScript.value);
      await page.type('input[aria-label="boid"]', boid);

      // Click search button and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.click('button.btn.bg-gradient-info')
      ]);

      // Parse the result
      const result = await page.evaluate(() => {
        // Check for success message
        const successDiv = document.querySelector('div.alert.alert-success');
        if (successDiv) {
          const text = successDiv.textContent.trim();
          const match = text.match(/allotted\s+(\d+)\s+units/i);
          const units = match ? parseInt(match[1]) : null;

          return {
            allotted: true,
            units: units,
            message: text
          };
        }

        // Check for failure message
        const errorDiv = document.querySelector('div.alert.alert-danger');
        if (errorDiv) {
          return {
            allotted: false,
            units: null,
            message: errorDiv.textContent.trim()
          };
        }

        return {
          allotted: false,
          units: null,
          message: 'No result message found on page'
        };
      });

      logger.info(`IPO result check completed: ${JSON.stringify(result)}`);

      return {
        success: true,
        provider: this.providerId,
        providerName: this.providerName,
        company: matchingScript.rawName,
        boid: boid,
        ...result
      };

    } catch (error) {
      logger.error('Error checking IPO result from Nabil Invest:', error);
      return {
        success: false,
        provider: this.providerId,
        providerName: this.providerName,
        error: error.message,
        allotted: false,
        units: null,
        message: `Failed to check result: ${error.message}`
      };
    } finally {
      await browserManager.close();
    }
  }
}

module.exports = NabilInvestChecker;
