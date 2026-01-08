const { NEPSE_URL } = require('./utils/constants');

/**
 * Market Scraper - Handles market status and index scraping
 */
class MarketScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async scrapeMarketSummary() {
    try {
      // Get index data which now includes market status from the same page load
      const indexData = await this.scrapeMarketIndex();
      const status = indexData.marketStatus || 'CLOSED';

      return {
        status,
        isOpen: status === 'OPEN' || status === 'PRE_OPEN',
        indexData
      };
    } catch (error) {
      console.error('❌ Failed to scrape market summary:', error.message);
      throw error;
    }
  }

  async scrapeMarketStatus(maxRetries = 3) {
    console.log('🔍 Checking market status...');
    console.log('⚡ Initializing browser for market status check...');
    await this.browserManager.init();

    const browser = this.browserManager.getBrowser();
    const userAgent = this.browserManager.getUserAgent();
    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page for market status...`);
        page = await browser.newPage();

        // Workaround for "Requesting main frame too early!"
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🔧 Setting user agent...');
        await page.setUserAgent(userAgent);

        console.log('🌐 Navigating to NEPSE homepage...');
        await page.goto(NEPSE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('✅ Page loaded successfully');

        try {
          console.log('📖 Reading page content...');
          const bodyText = await page.evaluate(() => document.body.innerText);
          const bodyTextLower = bodyText.toLowerCase();

          // Check for specific status strings
          const isPreOpen = bodyText.includes('Pre Open') ||
            bodyText.includes('Pre-Open') ||
            /Market Status[:\s]*PRE[- ]?OPEN/i.test(bodyText) ||
            /Status[:\s]*PRE[- ]?OPEN/i.test(bodyText) ||
            bodyTextLower.includes('pre open') ||
            bodyTextLower.includes('pre-open');

          const isOpen = (bodyText.includes('Market Open') && !bodyText.includes('Pre')) ||
            /Market Status[:\s]*OPEN(?!\s*-)/i.test(bodyText) ||
            /Status[:\s]*OPEN(?!\s*-)/i.test(bodyText) ||
            (bodyTextLower.includes('market open') && !bodyTextLower.includes('pre'));

          const isClosed = bodyText.includes('Market Closed') ||
            bodyText.includes('Market Close') ||
            /Market Status[:\s]*CLOSED?/i.test(bodyText) ||
            /Status[:\s]*CLOSED?/i.test(bodyText) ||
            bodyTextLower.includes('market closed') ||
            bodyTextLower.includes('market close');

          const closedIndicators = bodyText.includes('3:00:00 PM') ||
            bodyTextLower.includes('holiday') ||
            bodyTextLower.includes('trading halt');

          // Priority: Check explicit status first
          if (isPreOpen && !isClosed) {
            console.log('✅ Detected: PRE_OPEN from page content');
            return 'PRE_OPEN';
          }
          if (isOpen && !isClosed && !isPreOpen) {
            console.log('✅ Detected: OPEN from page content');
            return 'OPEN';
          }
          if (isClosed || closedIndicators) {
            console.log('✅ Detected: CLOSED from page content');
            return 'CLOSED';
          }

          console.log('⚠️ No explicit market status detected, defaulting to CLOSED (possible holiday)');
          return 'CLOSED';
        } catch (timeoutErr) {
          console.warn('⚠️ Failed to read page content, defaulting to CLOSED');
          return 'CLOSED';
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ Market status check attempt ${attempt} failed:`, error.message);

        if (page) {
          await page.close().catch(() => { });
          page = null;
        }

        if (error.message.includes('Requesting main frame too early') || attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      } finally {
        if (page) {
          await page.close().catch(() => { });
        }
      }
    }

    throw lastError;
  }

  async scrapeMarketIndex() {
    // Note: This method needs the full implementation from the original file
    // For now, returning a placeholder that maintains the interface
    throw new Error('scrapeMarketIndex not yet implemented - needs extraction from original file');
  }

  async fetchMarketIndexFromAPI() {
    // Note: This method needs the full implementation from the original file
    throw new Error('fetchMarketIndexFromAPI not yet implemented - needs extraction from original file');
  }
}

module.exports = MarketScraper;
