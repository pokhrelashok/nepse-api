const BrowserManager = require('../../utils/browser-manager');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');

/**
 * NMB Capital IPO Result Checker
 * Website: https://nmbcl.com.np/ipo
 */
class NmbCapitalChecker extends IpoResultChecker {
  constructor() {
    super('nmb-capital', 'NMB Capital Limited');
    this.baseUrl = 'https://nmbcl.com.np/ipo';
  }

  /**
   * Normalize company name for matching
   * Removes Ltd/Limited, parentheses content, share type indicators, and normalizes case
   */
  _normalizeCompanyName(name) {
    return name
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses and content
      .replace(/\s*-\s*(Public|Foreign Employment|Locals|Foreign|Employees|General Public)\.?$/i, '') // Remove share type suffixes
      .replace(/\s+(for|-)?\s*(General Public|Public|Foreign Employment|Locals|Foreign|Employees)\.?$/i, '') // Remove trailing share type
      .replace(/\s+(Ltd\.?|Limited|Pvt\.?|Private|FPO|IPO)\.?$/i, '') // Remove company suffixes
      .replace(/Re-Insurance/gi, 'reinsurance') // Normalize Re-Insurance to reinsurance
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim()
      .toLowerCase();
  }

  /**
   * Extract share type from company name
   * Maps NMB-specific terms to our normalized types
   */
  _extractShareType(name) {
    const lowerName = name.toLowerCase();

    // Check for share type indicators in parentheses or text
    if (lowerName.includes('(public)') || lowerName.includes('- public')) {
      return 'local';
    }
    if (lowerName.includes('(foreign employment)') || lowerName.includes('foreign employment')) {
      return 'migrant_workers';
    }
    if (lowerName.includes('(foreign)') || lowerName.includes('- foreign')) {
      return 'foreign';
    }
    if (lowerName.includes('(mutual fund)') || lowerName.includes('fund')) {
      return 'mutual_fund';
    }
    if (lowerName.includes('(employees)')) {
      return 'employees';
    }
    if (lowerName.includes('fpo') || lowerName.includes('ipo')) {
      return 'ordinary';
    }

    // Default to ordinary if no specific type found
    return 'ordinary';
  }

  /**
   * Get list of available IPO scripts from NMB Capital
   * @returns {Promise<Array>} - Array of {rawName, companyName, shareType, value}
   */
  async getScripts() {
    const browserManager = new BrowserManager();
    let browser;
    try {
      await browserManager.init();
      browser = browserManager.getBrowser();

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      logger.info('Navigating to NMB Capital IPO page...');
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for company dropdown to be populated
      await page.waitForSelector('select#company', { timeout: 10000 });

      // Extract company options
      const scripts = await page.evaluate(() => {
        const select = document.querySelector('select#company');
        if (!select) return [];

        const options = Array.from(select.querySelectorAll('option'));
        return options
          .filter(opt => opt.value && opt.value !== '')
          .map(opt => ({
            rawName: opt.textContent.trim(),
            value: opt.value
          }));
      });

      // Parse and normalize each script
      const parsedScripts = scripts.map(script => {
        const companyName = this._normalizeCompanyName(script.rawName);
        const shareType = this._extractShareType(script.rawName);

        return {
          rawName: script.rawName,
          companyName: companyName,
          shareType: shareType,
          value: script.value
        };
      });

      logger.info(`Fetched ${parsedScripts.length} IPO scripts from NMB Capital`);

      return parsedScripts;

    } catch (error) {
      logger.error('Error fetching scripts from NMB Capital:', error);
      throw error;
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Check IPO result for given BOID and company
   * @param {string} boid - 16-digit BOID
   * @param {string} companyName - Company name
   * @param {string} shareType - Share type
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
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to IPO page
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for form elements
      await page.waitForSelector('select#company', { timeout: 10000 });
      await page.waitForSelector('input#boidNumber', { timeout: 10000 });

      // Get all available companies from the current page to find the right one (optimized to reuse browser)
      const scriptsData = await page.evaluate(() => {
        const select = document.querySelector('select#company');
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
      }));

      // Normalize input company name and share type for robust matching
      const normalizedInputName = this._normalizeCompanyName(companyName);
      const normalizedInputShareType = shareType.toLowerCase();

      // Find matching company
      const matchingScript = scripts.find(script =>
        script.companyName === normalizedInputName &&
        script.shareType === normalizedInputShareType
      );

      if (!matchingScript) {
        logger.warn(`No matching company found for: ${companyName} (${shareType})`);
        return {
          success: false,
          allotted: false,
          units: null,
          message: `Company not found in NMB Capital: ${companyName} (${shareType})`
        };
      }

      logger.info(`Found matching company: ${matchingScript.rawName} (value: ${matchingScript.value})`);

      // Select company
      await page.select('select#company', matchingScript.value);

      // Enter BOID
      await page.type('input#boidNumber', boid);

      // Click submit button
      await page.click('button.btn-warning');

      // Wait for result element to appear (h6 with text-success or text-danger class)
      try {
        await page.waitForSelector('h6.text-success, h6.text-danger', { timeout: 10000 });
      } catch (error) {
        logger.warn('Result element did not appear within timeout');
        return {
          success: false,
          allotted: false,
          units: null,
          message: 'Result did not load'
        };
      }

      // Extract result from the h6 element
      const result = await page.evaluate(() => {
        // Look for the result in h6 tags
        const successElement = document.querySelector('h6.text-success');
        const dangerElement = document.querySelector('h6.text-danger');

        if (successElement) {
          // Success case: "Congratulations! Share alloted. Alloted Quantity : 20"
          const text = successElement.innerText.trim();

          // Extract quantity
          const quantityMatch = text.match(/Alloted Quantity\s*:\s*(\d+)/i);
          const units = quantityMatch ? parseInt(quantityMatch[1]) : null;

          return {
            allotted: true,
            units: units,
            message: units ? `Allotted ${units} units` : 'Allotted'
          };
        }

        if (dangerElement) {
          // Failure case: "Sorry, Not Allotted for the entered BOID/Details"
          return {
            allotted: false,
            units: null,
            message: 'Not Allotted'
          };
        }

        // Shouldn't reach here since we waited for the element
        return {
          allotted: false,
          units: null,
          message: 'Unable to determine result'
        };
      });

      logger.info(`Result for BOID ${boid}: ${result.allotted ? 'Allotted' : 'Not Allotted'}`);

      return {
        success: true,
        boid: boid,
        ...result
      };

    } catch (error) {
      logger.error(`Error checking result for BOID ${boid}:`, error);
      return {
        success: false,
        allotted: false,
        units: null,
        message: `Error: ${error.message}`
      };
    } finally {
      await browserManager.close();
    }
  }
}

module.exports = NmbCapitalChecker;
