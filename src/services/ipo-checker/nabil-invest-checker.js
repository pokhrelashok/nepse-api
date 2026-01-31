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
      page.setDefaultTimeout(this.timeout);

      await page.goto(this.url, { waitUntil: 'domcontentloaded' });

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
   * Check IPO results for multiple BOIDs using parallel pages
   * @param {Array<string>} boids - Array of 16-digit BOIDs
   * @param {string} companyName - Company name
   * @param {string} shareType - Normalized share type
   * @returns {Promise<Array>} - Array of result objects
   */
  async checkResultBulk(boids, companyName, shareType) {
    const browserManager = new BrowserManager();
    const CONCURRENCY = 3;
    let browser;
    let allResults = [];

    try {
      logger.info(`Bulk checking IPO results for ${boids.length} BOIDs from Nabil Invest with concurrency ${CONCURRENCY}`);
      await browserManager.init();
      browser = browserManager.getBrowser();

      const chunks = [];
      const chunkSize = Math.ceil(boids.length / CONCURRENCY);
      for (let i = 0; i < boids.length; i += chunkSize) {
        chunks.push(boids.slice(i, i + chunkSize));
      }

      const processChunk = async (chunkBoids) => {
        if (chunkBoids.length === 0) return [];

        const page = await browser.newPage();
        page.setDefaultTimeout(this.timeout);
        const chunkResults = [];

        try {
          await page.goto(this.url, { waitUntil: 'domcontentloaded' });

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
            return chunkBoids.map(boid => ({
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

          await page.select('select[aria-label="company"]', matchingScript.value);

          for (const boid of chunkBoids) {
            try {
              if (!page.url().includes(this.url)) {
                await page.goto(this.url, { waitUntil: 'domcontentloaded' });
                await page.select('select[aria-label="company"]', matchingScript.value);
              }

              await page.evaluate(() => {
                const input = document.querySelector('input[aria-label="boid"]');
                if (input) input.value = '';
              });

              await page.type('input[aria-label="boid"]', boid);

              const previousMessage = await page.evaluate(() => {
                const el = document.querySelector('.alert-success, .alert-danger');
                return el ? el.textContent.trim() : null;
              });

              await page.click('button.btn.bg-gradient-info');

              await page.waitForFunction((prevMsg) => {
                const el = document.querySelector('.alert-success, .alert-danger');
                if (!el) return false;
                if (!prevMsg) return true;
                return el.textContent.trim() !== prevMsg;
              }, { timeout: this.timeout }, previousMessage).catch(() => true);

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

              chunkResults.push({
                success: true,
                provider: this.providerId,
                providerName: this.providerName,
                company: matchingScript.rawName,
                boid: boid,
                ...result
              });

            } catch (err) {
              chunkResults.push({
                success: false,
                provider: this.providerId,
                providerName: this.providerName,
                boid: boid,
                error: err.message,
                allotted: false,
                units: null,
                message: `Failed: ${err.message}`
              });
            }
          }
        } catch (err) {
          logger.error(`Worker failed processing chunk: ${err.message}`);
          const processedBoids = chunkResults.map(r => r.boid);
          const remaining = chunkBoids.filter(b => !processedBoids.includes(b));
          remaining.forEach(b => {
            chunkResults.push({
              success: false,
              provider: this.providerId,
              providerName: this.providerName,
              boid: b,
              error: err.message,
              allotted: false,
              units: null,
              message: `Worker Failed: ${err.message}`
            });
          });
        } finally {
          await page.close().catch(() => { });
        }
        return chunkResults;
      };

      const chunksResults = await Promise.all(chunks.map(chunk => processChunk(chunk)));
      allResults = chunksResults.flat();
      return allResults;

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
      await browserManager.close();
    }
  }
}

module.exports = NabilInvestChecker;
