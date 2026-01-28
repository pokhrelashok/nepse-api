const BrowserManager = require('../../utils/browser-manager');
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');

/**
 * LS Capital IPO Result Checker
 * Website: https://lscapital.com.np/ipo
 */
class LsCapitalChecker extends IpoResultChecker {
  constructor() {
    super('ls-capital', 'LS Capital Limited');
    this.baseUrl = 'https://lscapital.com.np/ipo';
  }

  /**
   * Normalize company name for matching
   */
  _normalizeCompanyName(name) {
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
    const lowerName = name.toLowerCase();

    if (lowerName.includes('(public)')) return 'local';
    if (lowerName.includes('(local)')) return 'local';
    if (lowerName.includes('(general public)')) return 'ordinary';
    if (lowerName.includes('(foreign employment)')) return 'migrant_workers';
    if (lowerName.includes('(foreign)')) return 'foreign';
    if (lowerName.includes('(mutual fund)')) return 'mutual_fund';
    if (lowerName.includes('(employees)')) return 'employees';
    if (lowerName.includes('(fpo)')) return 'ordinary';

    // Default case if no specific type is found, or if it's just the company name
    // Many providers verify ordinary shares without suffix
    return 'ordinary';
  }

  /**
   * Get list of available IPO scripts from LS Capital
   */
  async getScripts() {
    const browserManager = new BrowserManager();
    let browser;
    try {
      await browserManager.init();
      browser = browserManager.getBrowser();

      const page = await browser.newPage();
      logger.info('Navigating to LS Capital IPO page...');
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for company dropdown
      const selectSelector = 'select.form-select';
      await page.waitForSelector(selectSelector, { timeout: 10000 });

      // Extract options
      const scripts = await page.evaluate((selector) => {
        const select = document.querySelector(selector);
        if (!select) return [];

        return Array.from(select.querySelectorAll('option'))
          .filter(opt => opt.value && opt.value !== '' && opt.value !== 'Select Company')
          .map(opt => ({
            rawName: opt.textContent.trim(),
            value: opt.value
          }));
      }, selectSelector);

      // Parse scripts
      const parsedScripts = scripts.map(script => {
        return {
          rawName: script.rawName,
          companyName: this._normalizeCompanyName(script.rawName),
          shareType: this._extractShareType(script.rawName),
          value: script.value
        };
      });

      logger.info(`Fetched ${parsedScripts.length} IPO scripts from LS Capital`);
      return parsedScripts;

    } catch (error) {
      logger.error('Error fetching scripts from LS Capital:', error);
      throw error;
    } finally {
      await browserManager.close();
    }
  }

  /**
   * Check IPO result for given BOID and company
   */
  async checkResult(boid, companyName, shareType) {
    const browserManager = new BrowserManager();
    let browser;
    try {
      logger.info(`Checking IPO result for BOID: ${boid}, Company: ${companyName}, Share Type: ${shareType}`);

      await browserManager.init();
      browser = browserManager.getBrowser();

      const page = await browser.newPage();
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const selectSelector = 'select.form-select';
      const boidInputSelector = 'input[name="boidNumber"]';

      // Wait for elements
      await page.waitForSelector(selectSelector, { timeout: 10000 });
      await page.waitForSelector(boidInputSelector, { timeout: 10000 });

      // Get scripts to find match (optimization: get from page)
      const scriptsData = await page.evaluate((selector) => {
        const select = document.querySelector(selector);
        if (!select) return [];
        return Array.from(select.querySelectorAll('option'))
          .filter(opt => opt.value && opt.value !== '')
          .map(opt => ({ rawName: opt.textContent.trim(), value: opt.value }));
      }, selectSelector);

      const scripts = scriptsData.map(script => ({
        rawName: script.rawName,
        companyName: this._normalizeCompanyName(script.rawName),
        shareType: this._extractShareType(script.rawName),
        value: script.value
      }));

      const normalizedInputName = this._normalizeCompanyName(companyName);
      const normalizedInputShareType = shareType.toLowerCase();

      const matchingScript = scripts.find(script =>
        normalizedInputName === script.companyName &&
        script.shareType === normalizedInputShareType
      );

      if (!matchingScript) {
        logger.warn(`No matching company found for: ${companyName} (${shareType})`);
        logger.warn(`Available scripts: ${JSON.stringify(scripts.map(s => s.companyName))}`);
        return {
          success: false,
          allotted: false,
          units: null,
          message: `Company not found in LS Capital: ${companyName} (${shareType})`
        };
      }

      // Fill form
      await page.select(selectSelector, matchingScript.value);
      await page.type(boidInputSelector, boid);

      // Find and click Check button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const checkBtn = buttons.find(b => b.textContent.includes('CHECK'));
        if (checkBtn) checkBtn.click();
      });

      // Wait for result
      // The result might be a table (success) or a failure message.
      try {
        await page.waitForFunction(
          () => {
            const bodyText = document.body.innerText;
            return bodyText.includes('Sorry, Not Allotted') ||
              document.querySelector('table') !== null;
          },
          { timeout: 10000 }
        );
      } catch (e) {
        logger.warn('Timed out waiting for result content');
      }

      // Extract result
      const result = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Check for failure message specifically
        // Screenshot shows: "Sorry, Not Allotted for the entered BOID/Details" in a red block
        if (bodyText.includes('Sorry, Not Allotted')) {
          return {
            allotted: false,
            units: null,
            message: 'Sorry, Not Allotted for the entered BOID/Details'
          };
        }

        // Check for success table
        // Screenshot shows columns: Full Name | Holder Identification | Applied Kitta | Alloted Kitta
        const table = document.querySelector('table');
        if (table) {
          const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
          const allottedIndex = headers.findIndex(h => h.includes('Alloted Kitta') || h.includes('Allotted Kitta'));

          if (allottedIndex !== -1) {
            const rows = table.querySelectorAll('tbody tr');
            if (rows.length > 0) {
              const cells = rows[0].querySelectorAll('td');
              if (cells.length > allottedIndex) {
                const unitsText = cells[allottedIndex].textContent.trim();
                const units = parseInt(unitsText);

                // If units > 0, it's allotted
                if (!isNaN(units) && units > 0) {
                  return {
                    allotted: true,
                    units: units,
                    message: `Allotted ${units} units`
                  };
                } else {
                  // Table exists but 0 units? Should consider not allotted or just 0 allotted.
                  return {
                    allotted: false,
                    units: 0,
                    message: 'Allotted 0 units'
                  };
                }
              }
            }
          }
        }

        // Fallback
        return { allotted: false, units: null, message: 'Result unknown' };
      });

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

module.exports = LsCapitalChecker;
