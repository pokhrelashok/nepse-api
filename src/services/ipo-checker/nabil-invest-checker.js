const axios = require('axios');
const BrowserManager = require('../../utils/browser-manager');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');
const { extractShareType } = require('./share-type-utils');

/**
 * Nabil Invest IPO Result Checker
 * Uses Puppeteer to scrape results from result.nabilinvest.com.np
 * OPTIMIZED: Uses Puppeteer for session init, then direct API calls for bulk checking
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
      try {
        await page.waitForSelector('input[name="_token"]', { timeout: 10000 });
      } catch (e) {
        logger.warn('Token input not found in getScripts, continuing...');
      }

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
      page.setDefaultTimeout(this.timeout);

      await page.goto(this.url, { waitUntil: 'domcontentloaded' });

      // Wait for captcha/redirect
      try {
        await page.waitForSelector('input[name="_token"]', { timeout: 10000 });
      } catch (e) {
        logger.warn('Token input not found in checkResult, continuing...');
      }

      // Extract company options from dropdown (Reuse logic)
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

      const normalizedInputName = this._normalizeCompanyName(companyName);
      const normalizedInputShareType = shareType.toLowerCase();

      const matchingScript = scripts.find(script =>
        script.companyName === normalizedInputName && script.shareType === normalizedInputShareType
      );

      if (!matchingScript) {
        const availableScripts = scripts.map(s => `${s.companyName} (${s.shareType})`).join(', ');
        throw new Error(`No matching IPO found for "${companyName}" with share type "${shareType}". Available: ${availableScripts}`);
      }

      logger.info(`Found matching script: ${matchingScript.rawName}`);

      await page.select('select[aria-label="company"]', matchingScript.value);
      await page.type('input[aria-label="boid"]', boid);

      await page.click('button.btn.bg-gradient-info');

      // Wait for success or error alert
      await page.waitForSelector('.alert-success, .alert-danger', { visible: true, timeout: this.timeout });

      const result = await page.evaluate(() => {
        const successDiv = document.querySelector('div.alert.alert-success');
        if (successDiv && successDiv.offsetParent !== null) {
          const text = successDiv.textContent.trim();
          const match = text.match(/allotted\s+(\d+)\s+units/i);
          return { allotted: true, units: match ? parseInt(match[1]) : null, message: text };
        }

        const errorDiv = document.querySelector('div.alert.alert-danger');
        if (errorDiv && errorDiv.offsetParent !== null) {
          return { allotted: false, units: null, message: errorDiv.textContent.trim() };
        }

        return { allotted: false, units: null, message: 'No result message found' };
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
   * Check IPO results for multiple BOIDs using parallel API requests
   * Optimized: Uses Puppeteer to bypass bot check, then Axios for speed
   * @param {Array<string>} boids - Array of 16-digit BOIDs
   * @param {string} companyName - Company name
   * @param {string} shareType - Normalized share type
   * @returns {Promise<Array>} - Array of result objects
   */
  async checkResultBulk(boids, companyName, shareType) {
    const CONCURRENCY = 10;
    const browserManager = new BrowserManager();
    let browser;

    try {
      logger.info(`Bulk checking IPO results for ${boids.length} BOIDs from Nabil Invest (Hybrid)`);

      // 1. Get Session via Puppeteer to bypass protection
      logger.info('Initializing browser to bypass security check...');
      await browserManager.init();
      browser = browserManager.getBrowser();
      const page = await browser.newPage();

      await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: this.timeout });

      // Wait for the token input to verify page loaded/redirected
      try {
        await page.waitForSelector('input[name="_token"]', { timeout: 10000 });
      } catch (e) {
        logger.warn('Token input not found, maybe still on captcha page?');
      }

      // Extract Data from DOM
      const pageData = await page.evaluate(() => {
        const tokenInput = document.querySelector('input[name="_token"]');
        const token = tokenInput ? tokenInput.value : null;

        const select = document.querySelector('select[aria-label="company"]');
        const options = select ? Array.from(select.querySelectorAll('option'))
          .map(opt => ({
            rawName: opt.textContent.trim(),
            value: opt.value
          })) : [];

        return { token, options, userAgent: navigator.userAgent };
      });

      const cookies = await page.cookies();
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Close browser early - we don't need it for the requests
      await browserManager.close();
      browser = null; // Mark as closed

      if (!pageData.token) {
        throw new Error('Failed to extract CSRF token via Puppeteer');
      }

      // Parse Options
      const scripts = pageData.options
        .filter(opt => opt.value && opt.value !== '')
        .map(opt => ({
          ...opt,
          companyName: this._normalizeCompanyName(opt.rawName),
          shareType: this._extractShareType(opt.rawName)
        }));

      // Find Matching Company
      const normalizedInputName = this._normalizeCompanyName(companyName);
      const normalizedInputShareType = shareType.toLowerCase();

      const matchingScript = scripts.find(script =>
        script.companyName === normalizedInputName && script.shareType === normalizedInputShareType
      );

      if (!matchingScript) {
        logger.error(`Company not found: ${companyName} (${shareType})`);
        return boids.map(boid => ({
          success: false,
          provider: this.providerId,
          providerName: this.providerName,
          boid: boid,
          error: `No matching IPO found`,
          allotted: false,
          units: null,
          message: `No matching IPO found for "${companyName}"`
        }));
      }

      logger.info(`Found matching script: ${matchingScript.rawName}`);

      // Extract XSRF for header
      const xsrfCookie = cookies.find(c => c.name === 'XSRF-TOKEN');
      const xsrfToken = xsrfCookie ? decodeURIComponent(xsrfCookie.value) : null;

      // 2. Process BOIDs
      const results = [];
      for (let i = 0; i < boids.length; i += CONCURRENCY) {
        const chunk = boids.slice(i, i + CONCURRENCY);
        const chunkPromises = chunk.map(async (boid) => {
          try {
            const params = new URLSearchParams();
            params.append('_token', pageData.token);
            params.append('company', matchingScript.value);
            params.append('boid', boid);

            const headers = {
              'Cookie': cookieHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': pageData.userAgent, // Critical: Use exact UA from Puppeteer
              'Referer': this.url,
              'Origin': 'https://result.nabilinvest.com.np',
              'X-Requested-With': 'XMLHttpRequest'
            };

            if (xsrfToken) headers['X-XSRF-TOKEN'] = xsrfToken;

            const response = await axios.post(this.url, params, {
              headers,
              timeout: this.timeout
            });

            const html = response.data;
            let result = { allotted: false, units: null, message: 'Unknown result' };

            if (html.includes('alert-success')) {
              const unitsMatch = html.match(/allotted\s+(\d+)\s+units/i);
              const msgMatch = html.match(/<div[^>]*class="[^"]*alert-success[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                html.match(/class="alert alert-success"[^>]*>\s*([^<]+)\s*<\/div>/);

              const cleanMsg = msgMatch ? msgMatch[1].trim() : (unitsMatch ? `Allotted ${unitsMatch[1]} units` : "Allotted");

              result = {
                allotted: true,
                units: unitsMatch ? parseInt(unitsMatch[1]) : 10,
                message: cleanMsg
              };
            } else if (html.includes('alert-danger') || html.includes('not been allotted') || html.includes('Sorry')) {
              const msgMatch = html.match(/<div[^>]*class="[^"]*alert-danger[^"]*"[^>]*>([^<]+)<\/div>/i);
              result = {
                allotted: false,
                units: null,
                message: msgMatch ? msgMatch[1].trim() : "Sorry! You have not been allotted."
              };
            } else {
              // DEBUG: Log unknown HTML
              logger.warn(`Unknown HTML for BOID ${boid}: ${html.substring(0, 500)}...`);
            }

            return {
              success: true,
              provider: this.providerId,
              providerName: this.providerName,
              company: matchingScript.rawName,
              boid: boid,
              ...result
            };

          } catch (err) {
            logger.error(`Error checking BOID ${boid}: ${err.message}`);
            return {
              success: false,
              provider: this.providerId,
              providerName: this.providerName,
              boid: boid,
              error: err.message,
              allotted: false,
              units: null,
              message: `Failed: ${err.message}`
            };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        if (i + CONCURRENCY < boids.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return results;

    } catch (error) {
      logger.error('Fatal error in Nabil Invest bulk check:', error);
      return boids.map(b => ({
        success: false,
        provider: this.providerId,
        providerName: this.providerName,
        boid: b,
        error: error.message,
        allotted: false,
        units: null,
        message: 'Bulk check process failed'
      }));
    } finally {
      if (browser) await browserManager.close();
    }
  }
}

module.exports = NabilInvestChecker;
