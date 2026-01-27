const BrowserManager = require('./nepse/browser-manager');
const logger = require('../utils/logger');

class SipScraper {
  constructor() {
    // NepseAlpha has Cloudflare, but we will try headless as requested for final test
    this.browserManager = new BrowserManager({ headless: true });
  }

  async scrapeSips() {
    logger.info('🚀 Starting SIP Scraper...');
    await this.browserManager.init();
    const browser = this.browserManager.getBrowser();
    const page = await browser.newPage();

    const url = 'https://nepsealpha.com/sip-in-nepal';

    try {
      logger.info(`🌐 Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

      // Wait for table to load
      await page.waitForSelector('.v-data-table', { timeout: 60000 });
      // Small wait for Vue to render rows
      await new Promise(r => setTimeout(r, 2000));

      logger.info('📄 Extracting data from table...');
      const sips = await page.evaluate(() => {
        const rows = document.querySelectorAll('.v-data-table tbody tr');
        // console.log(`Found ${rows.length} rows in total.`); // Browser context log, kept for debugging if needed but won't show in node logger easily without bridge
        const data = [];

        rows.forEach((row, index) => {
          const cols = row.querySelectorAll('td');
          // SIP table strictly has 9 columns based on header count
          if (cols.length !== 9) {
            if (index < 3) console.log(`Row ${index} skipped: ${cols.length} columns`);
            return;
          }

          const getText = (el) => el ? el.innerText.trim() : '';
          const parseNum = (txt) => {
            if (!txt) return 0;
            return parseFloat(txt.replace(/,/g, '').replace(/%/g, '')) || 0;
          };

          // 0: Symbol (inside div)
          // Extract symbol from the title attribute or specific span
          const symbolAvatar = cols[0].querySelector('.symbol-avatar');
          let symbolText = '';
          if (symbolAvatar) {
            symbolText = symbolAvatar.getAttribute('title') || '';
            if (!symbolText) {
              // Fallback to text inside span
              const span = cols[0].querySelector('span.font-weight-bold');
              if (span) symbolText = span.innerText.trim();
            }
          }

          if (!symbolText) return; // Skip if no symbol found

          // Company Name
          // Try to get from small tag, or fallback to symbol if empty
          let companyName = '';
          const smallTag = cols[0].querySelector('small');
          if (smallTag) companyName = smallTag.innerText.trim();

          // If company name is empty (as seen in logs), use Symbol or try to find it elsewhere?
          // Since the HTML dump showed empty small tag, but user screenshot has name.
          // It's possible the name is loaded dynamically or we just use symbol map later.
          // For now, if empty, use Symbol as placeholder or look for other text nodes.
          if (!companyName) {
            // Try to get all text from the second div
            const textDiv = cols[0].querySelector('.d-flex.flex-column');
            if (textDiv) {
              const fullText = textDiv.innerText.trim(); // "SSIS"
              if (fullText.length > symbolText.length) {
                companyName = fullText.replace(symbolText, '').trim();
              }
            }
          }
          if (!companyName) companyName = symbolText;

          // Validate Date (Column 3)
          const dateText = getText(cols[3]);
          // Simple date check YYYY-MM-DD
          if (!dateText.match(/^\d{4}-\d{2}-\d{2}$/)) return;

          data.push({
            symbol: symbolText,
            company_name: companyName,
            category: getText(cols[1]),
            nav: parseNum(getText(cols[2])),
            nav_date: dateText,
            authorized_fund_size: getText(cols[4]),
            net_asset_value: getText(cols[5]),
            return_since_inception: getText(cols[6]),
            inception_date: getText(cols[7]),
            expense_ratio: parseNum(getText(cols[8]))
          });
        });

        return data;
      });

      logger.info(`✅ Extracted ${sips.length} SIPs.`);
      return sips;

    } catch (error) {
      logger.error('❌ Error scraping SIPs:', error);
      throw error;
    } finally {
      await this.browserManager.close();
    }
  }
}

module.exports = SipScraper;
