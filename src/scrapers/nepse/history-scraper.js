/**
 * History Scraper - Handles historical market data scraping
 */
class HistoryScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async scrapeMarketIndicesHistory(maxRetries = 3) {
    console.log('📊 Scraping market indices history...');
    await this.browserManager.init();

    const browser = this.browserManager.getBrowser();
    const userAgent = this.browserManager.getUserAgent();
    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        page = await browser.newPage();
        await page.setUserAgent(userAgent);

        let interceptedData = null;

        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('/api/nots/index/history/')) {
            try {
              const data = await response.json();
              if (data && data.content && Array.isArray(data.content)) {
                if (!interceptedData || data.content.length > interceptedData.length) {
                  interceptedData = data.content;
                  console.log(`✅ Intercepted history API: ${url} (${interceptedData.length} records)`);
                }
              }
            } catch (e) { }
          }
        });

        await page.goto('https://www.nepalstock.com/indices', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        await page.evaluate(() => {
          const selects = document.querySelectorAll('select');
          const select = selects.length > 1 ? selects[1] : selects[0];
          if (select) {
            select.value = '500';
            select.dispatchEvent(new Event('change', { bubbles: true }));

            const filterButton = document.querySelector('button.box__filter--search');
            if (filterButton) {
              filterButton.click();
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        if (!interceptedData) {
          throw new Error('No index history data intercepted');
        }

        await page.close();
        return interceptedData;

      } catch (error) {
        lastError = error;
        if (page) await page.close().catch(() => { });
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    throw lastError;
  }
}

module.exports = HistoryScraper;
