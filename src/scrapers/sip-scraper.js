const BrowserManager = require('../utils/browser-manager');
const logger = require('../utils/logger');

class SipScraper {
  constructor() {
    this.browserManager = new BrowserManager();
  }

  async scrapeSips() {
    logger.info('🚀 Starting SIP Scraper...');
    await this.browserManager.init();
    const browser = this.browserManager.getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36');
    const url = 'https://nepsealpha.com/sip-in-nepal';

    try {
      logger.info(`🌐 Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

      // Wait for table to load
      logger.info('⏳ Waiting for table data... (If you see a Cloudflare CAPTCHA, please solve it manually!)');
      await page.waitForSelector('.v-data-table', { timeout: 300000 }); // 5 minutes timeout for manual solving
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

          // Company Name Extraction
          // 0. Static mapping for known SIPs where scraped name is missing or corrupted
          const sipNames = {
            'NIBLSF': 'NIBL Sahabhagita Fund',
            'SSIS': 'Siddhartha Systematic Investment Scheme',
            'NICSF': 'NIBL Samriddhi Fund 1',
            'NI31': 'NI 31',
            'KSLY': 'Kumari Sunaulo Lagani Yojana',
            'NFCF': 'Nabil Flexi Cap Fund',
            'NMBSBF': 'NMB Saral Bachat Fund - E',
            'SLK': 'Shubha Laxmi Kosh',
            'NADDF': 'NIC Asia Dynamic Debt Fund',
            'SFF': 'Sanima Flexi Fund',
            'NMB50': 'NMB 50',
            'NMBHF1': 'NMB Hybrid Fund L-1',
            'LEMF': 'Laxmi Equity Fund',
            'LUK': 'Laxmi Unnati Kosh',
            'LVF1': 'Laxmi Value Fund 1',
            'SFMF': 'Siddhartha Investment Growth Scheme 2',
            'SIGS2': 'Siddhartha Investment Growth Scheme 2',
            'SAEF': 'Sanima Equity Fund',
            'SEF': 'Sanima Equity Fund',
            'NICGF': 'NIC Asia Growth Fund',
            'NBF2': 'Nabil Balanced Fund 2'
          };

          let companyName = sipNames[symbolText] || '';

          // 1. Try specific selectors first - these are most reliable if the site works properly
          if (!companyName) {
            const specificNameEl = cols[0].querySelector('.text-caption, small, .text-muted, .v-list-item__subtitle');
            companyName = specificNameEl ? specificNameEl.innerText.trim() : '';
          }

          if (!companyName) {
            // 2. Fallback: Parse cell text and filter out artifacts like single-letter avatars
            const cellText = cols[0].innerText.trim();
            const parts = cellText.split('\n').map(p => p.trim()).filter(p => p.length > 1);

            // Remove the symbol if present in parts
            const cleanParts = parts.filter(p => !symbolText || p !== symbolText);

            if (cleanParts.length > 0) {
              cleanParts.sort((a, b) => b.length - a.length);
              companyName = cleanParts[0];
            } else {
              companyName = symbolText;
            }
          }

          if (!companyName) companyName = symbolText; // Final fallback

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
