const BrowserManager = require('../../utils/browser-manager');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');
const { extractShareType } = require('./share-type-utils');

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
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses and content
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private)\s*$/i, '') // Remove Ltd/Limited
      .trim()
      .replace(/\s+/g, ' ') // Normalize spaces
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
    return extractShareType(name);
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
      await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: this.timeout });

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
      await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: this.timeout });

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

      // Normalize input company name and share type for matching
      const normalizedInputName = this._normalizeCompanyName(companyName);
      const normalizedInputShareType = shareType.toLowerCase();

      // Find matching script by company name and share type
      const matchingScript = scripts.find(script =>
        script.companyName === normalizedInputName && script.shareType === normalizedInputShareType
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
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.timeout }),
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

  /**
   * Check IPO results for multiple BOIDs using a single browser instance
   * @param {Array<string>} boids - Array of 16-digit BOIDs
   * @param {string} companyName - Company name
   * @param {string} shareType - Normalized share type
   * @returns {Promise<Array>} - Array of result objects
   */
  async checkResultBulk(boids, companyName, shareType) {
    const browserManager = new BrowserManager();
    let browser;
    const results = [];

    try {
      logger.info(`Bulk checking IPO results for ${boids.length} BOIDs from Nabil Invest`);
      await browserManager.init();
      browser = browserManager.getBrowser();
      const page = await browser.newPage();

      // Set timeout for all page operations
      page.setDefaultTimeout(this.timeout);

      // Helper to match script (only need to do this once)
      let matchingScript = null;
      const normalizedInputName = this._normalizeCompanyName(companyName);
      const normalizedInputShareType = shareType.toLowerCase();

      // Load the page once initially
      await page.goto(this.url, { waitUntil: 'domcontentloaded' });

      for (const boid of boids) {
        try {
          // If the page is not on the search URL (e.g. after a result check), 
          // we stay there because Nabil Invest result page also contains the search form.
          // However, if we're not at the search page for some reason, we go there.
          const currentUrl = page.url();
          if (!currentUrl.includes(this.url)) {
            await page.goto(this.url, { waitUntil: 'domcontentloaded' });
          }

          // Find matching script if not already found or if dropdown needs refreshing
          if (!matchingScript) {
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

            matchingScript = scripts.find(script =>
              script.companyName === normalizedInputName && script.shareType === normalizedInputShareType
            );

            if (!matchingScript) {
              const available = scripts.map(s => `${s.companyName} (${s.shareType})`).join(', ');
              throw new Error(`No matching IPO found for "${companyName}" (${shareType}). Available: ${available}`);
            }
            logger.info(`Found matching script for bulk check: ${matchingScript.rawName}`);
          }

          // Fill and submit (Clear BOID first)
          await page.evaluate(() => {
            const boidInput = document.querySelector('input[aria-label="boid"]');
            if (boidInput) boidInput.value = '';
          });

          await page.select('select[aria-label="company"]', matchingScript.value);
          await page.type('input[aria-label="boid"]', boid);

          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            page.click('button.btn.bg-gradient-info')
          ]);

          // Parse result
          const result = await page.evaluate(() => {
            const successDiv = document.querySelector('div.alert.alert-success');
            if (successDiv) {
              const text = successDiv.textContent.trim();
              const match = text.match(/allotted\s+(\d+)\s+units/i);
              return { allotted: true, units: match ? parseInt(match[1]) : null, message: text };
            }

            const errorDiv = document.querySelector('div.alert.alert-danger');
            if (errorDiv) {
              return { allotted: false, units: null, message: errorDiv.textContent.trim() };
            }

            return { allotted: false, units: null, message: 'No result message found' };
          });

          results.push({
            success: true,
            provider: this.providerId,
            providerName: this.providerName,
            company: matchingScript.rawName,
            boid: boid,
            ...result
          });

        } catch (error) {
          logger.error(`Error checking BOID ${boid} in bulk:`, error);
          results.push({
            success: false,
            provider: this.providerId,
            providerName: this.providerName,
            boid: boid,
            error: error.message,
            allotted: false,
            units: null,
            message: `Failed: ${error.message}`
          });

          // Break early if it's a "No matching IPO" error as it won't change for other BOIDs
          if (error.message.includes('No matching IPO found')) {
            // Fill remaining with same error
            const remainingBoids = boids.slice(results.length);
            for (const rb of remainingBoids) {
              results.push({
                success: false,
                provider: this.providerId,
                providerName: this.providerName,
                boid: rb,
                error: error.message,
                allotted: false,
                units: null,
                message: `Failed: ${error.message}`
              });
            }
            break;
          }
        }
      }

      return results;

    } catch (error) {
      logger.error('Fatal error in Nabil Invest bulk check:', error);
      // Return error for all if we couldn't even start properly
      if (results.length < boids.length) {
        const checkedBoids = results.map(r => r.boid);
        const remainingBoids = boids.filter(b => !checkedBoids.includes(b));
        for (const rboid of remainingBoids) {
          results.push({
            success: false,
            provider: this.providerId,
            providerName: this.providerName,
            boid: rboid,
            error: error.message,
            allotted: false,
            units: null,
            message: 'Bulk check process failed'
          });
        }
      }
      return results;
    } finally {
      await browserManager.close();
    }
  }
}

module.exports = NabilInvestChecker;
