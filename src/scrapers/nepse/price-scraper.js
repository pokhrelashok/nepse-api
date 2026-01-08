const { TODAY_PRICE_URL } = require('./utils/constants');
const { formatCSVDownloadData, formatAPIData, formatHTMLData } = require('./utils/parsers');

/**
 * Price Scraper - Handles today's price scraping with multiple fallback methods
 */
class PriceScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async scrapeTodayPrices(maxRetries = 3) {
    console.log('📊 Scraping today\'s prices...');
    console.log('⚡ Initializing browser for price scraping...');
    await this.browserManager.init();

    const browser = this.browserManager.getBrowser();
    const userAgent = this.browserManager.getUserAgent();
    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page...`);
        page = await browser.newPage();
        await page.setUserAgent(userAgent);
        await page.setDefaultTimeout(60000);
        await page.setDefaultNavigationTimeout(60000);

        console.log('📡 Trying API capture method first...');
        try {
          const result = await this.scrapeTodayPricesAPI(page);
          await page.close().catch(() => { });
          page = null;
          return result;
        } catch (apiError) {
          console.log(`⚠️ API capture method failed (attempt ${attempt}): ${apiError.message}`);

          await page.close().catch(() => { });
          page = await browser.newPage();
          await page.setUserAgent(userAgent);
          await page.setDefaultTimeout(60000);

          console.log('🔄 Falling back to CSV download...');
          try {
            const result = await this.scrapeTodayPricesCSVDownload(page);
            await page.close().catch(() => { });
            page = null;
            return result;
          } catch (csvError) {
            console.log(`⚠️ CSV download failed (attempt ${attempt}): ${csvError.message}`);

            await page.close().catch(() => { });
            page = await browser.newPage();
            await page.setUserAgent(userAgent);
            await page.setDefaultTimeout(60000);

            console.log('🔄 Falling back to HTML scraping...');
            const result = await this.scrapeTodayPricesHTML(page);
            await page.close().catch(() => { });
            page = null;
            return result;
          }
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed: ${error.message}`);

        if (page) {
          await page.close().catch(() => { });
          page = null;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('❌ All scraping attempts failed');
    throw lastError;
  }

  async scrapeTodayPricesCSVDownload(page) {
    console.log('📥 Using CSV download method...');

    let interceptedData = null;

    page.on('response', async response => {
      const url = response.url();

      if (url.includes('todays-price') && response.status() === 200) {
        try {
          const responseData = await response.text();
          const jsonData = JSON.parse(responseData);
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            interceptedData = jsonData;
            console.log(`📊 Intercepted ${jsonData.length} price records`);
          }
        } catch (error) {
          console.log(`Error parsing intercepted data: ${error.message}`);
        }
      }
    });

    console.log('🌐 Loading today-price page...');
    await page.goto(TODAY_PRICE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.waitForSelector('.download-csv', { timeout: 15000 });
    const downloadButton = await page.$('.download-csv');

    if (!downloadButton) {
      throw new Error('CSV download button not found');
    }

    console.log('🎯 Clicking CSV download button...');
    await downloadButton.click();

    await new Promise(resolve => setTimeout(resolve, 5000));

    if (!interceptedData) {
      throw new Error('No data intercepted from CSV download');
    }

    const formattedData = formatCSVDownloadData(interceptedData);
    console.log(`✅ Successfully processed ${formattedData.length} records via CSV download`);
    return formattedData;
  }

  async scrapeTodayPricesAPI(page) {
    console.log('📡 Using API capture method...');
    const apiResponses = [];

    page.on('response', async response => {
      const url = response.url();

      if (url.includes('today-price') && url.includes('/api/')) {
        console.log(`📡 Capturing API: ${response.status()} ${url}`);

        try {
          const data = await response.json();
          apiResponses.push({ url, status: response.status(), data });
          console.log(`✅ Captured API data`);
        } catch (e) {
          console.log(`⚠️ Failed to parse API response: ${e.message}`);
        }
      }
    });

    console.log('🌐 Loading today-price page...');
    await page.goto(TODAY_PRICE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForFunction(() => {
      return document.querySelector('table') ||
        document.querySelector('[class*="table"]') ||
        document.querySelector('[class*="grid"]');
    }, { timeout: 45000 });

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      console.log('📄 Attempting to set pagination to 500...');

      const selector = 'div.box__filter--field select';
      await page.waitForSelector(selector, { timeout: 10000 });

      await page.select(selector, '500');
      console.log('✅ Selected 500 from dropdown');

      const filterButtonSelector = 'button.box__filter--search';

      try {
        await page.waitForSelector(filterButtonSelector, { visible: true, timeout: 5000 });
        console.log('✅ Filter button found and visible');
      } catch (e) {
        console.log('⚠️ Filter button not found or not visible:', e.message);
        throw new Error('Filter button not accessible');
      }

      const [response] = await Promise.all([
        page.waitForResponse(response =>
          response.url().includes('today-price') &&
          response.url().includes('/api/') &&
          response.status() === 200,
          { timeout: 15000 }
        ).catch(e => {
          console.log('⚠️ Warning: API response wait timed out after clicking Filter, but proceeding if UI updated');
          return null;
        }),
        page.click(filterButtonSelector).then(() => console.log('✅ Clicked Filter button'))
      ]);

      if (response) {
        console.log('✅ Pagination API call captured successfully');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (err) {
      console.log(`⚠️ Pagination change failed: ${err.message}`);
    }

    const validResponses = apiResponses.filter(r =>
      r.url.includes('today-price') &&
      r.url.includes('/api/') &&
      r.status === 200 &&
      r.data?.content
    );

    validResponses.sort((a, b) => {
      const lenA = Array.isArray(a.data.content) ? a.data.content.length : Object.keys(a.data.content).length;
      const lenB = Array.isArray(b.data.content) ? b.data.content.length : Object.keys(b.data.content).length;
      return lenB - lenA;
    });

    const todayPriceResponse = validResponses[0];

    if (!todayPriceResponse) {
      throw new Error('No valid API response found');
    }

    const apiData = todayPriceResponse.data.content;
    let stockArray = [];

    if (Array.isArray(apiData)) {
      stockArray = apiData;
    } else if (typeof apiData === 'object') {
      stockArray = Object.values(apiData);
    }

    if (stockArray.length === 0) {
      throw new Error('No stock data found in API response');
    }

    console.log(`📈 Processing ${stockArray.length} stock records from API...`);
    return formatAPIData(stockArray);
  }

  async scrapeTodayPricesHTML(page) {
    console.log('📋 Using HTML scraping method...');

    if (!page.url().includes('today-price')) {
      await page.goto(TODAY_PRICE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    }

    await page.waitForSelector('table, .table-responsive', { timeout: 15000 });

    try {
      console.log('📄 Attempting to set pagination to 500 (HTML Method)...');

      const selector = 'div.box__filter--field select';
      await page.waitForSelector(selector, { timeout: 10000 });

      await page.select(selector, '500');

      const filterButtonSelector = 'button.box__filter--search';

      try {
        await page.waitForSelector(filterButtonSelector, { timeout: 5000 });
        await page.click(filterButtonSelector);
        console.log('✅ Set pagination to 500 and clicked Filter');
      } catch (e) {
        console.log('⚠️ Could not find or click filter button: ' + e.message);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (err) {
      console.log(`⚠️ Pagination change failed: ${err.message}`);
    }

    const data = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      if (!tables || tables.length === 0) return null;

      const mainTable = Array.from(tables).find(table => {
        const headers = table.querySelectorAll('th');
        return headers.length > 5;
      });

      if (!mainTable) return null;

      const headers = Array.from(mainTable.querySelectorAll('th')).map(th =>
        th.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      const rows = Array.from(mainTable.querySelectorAll('tbody tr, tr')).slice(1);

      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const rowData = {};

        cells.forEach((cell, index) => {
          if (headers[index]) {
            rowData[headers[index]] = cell.textContent.trim();
          }
        });

        return rowData;
      }).filter(row => row && Object.keys(row).length > 0);
    });

    if (!data || data.length === 0) {
      throw new Error('No data found in HTML table');
    }

    console.log(`📊 Extracted ${data.length} records from HTML table`);
    return formatHTMLData(data);
  }
}

module.exports = PriceScraper;
