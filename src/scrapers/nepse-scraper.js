const puppeteer = require('puppeteer');
const { processImageData } = require('../utils/image-handler');
const { DateTime } = require('luxon');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { translateToNepali } = require('../services/translation-service');

const NEPSE_URL = 'https://www.nepalstock.com';
const TODAY_PRICE_URL = 'https://www.nepalstock.com/today-price';

class NepseScraper {
  constructor(options = {}) {
    this.browser = null;
    this.initializingPromise = null;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.userDataDir = null;
    this.headless = options.headless !== undefined ? options.headless : true;
  }

  async init() {
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    if (this.browser && this.browser.isConnected()) {
      console.log('♻️ Reusing existing browser instance');
      return;
    }

    this.initializingPromise = (async () => {
      try {
        console.log('🚀 Initializing Puppeteer browser...');

        // Create a unique temp directory for this session
        const tmpDir = os.tmpdir();
        this.userDataDir = fs.mkdtempSync(path.join(tmpDir, 'nepse-scraper-'));
        console.log(`📂 Created temp user data dir: ${this.userDataDir}`);

        const launchOptions = {
          headless: this.headless,
          userDataDir: this.userDataDir,
          pipe: true, // Use pipe instead of websocket for better stability
          timeout: 60000,
          ignoreHTTPSErrors: true, // Ignore SSL certificate errors from nepalstock.com
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--disable-background-networking',
            '--disable-background-mode',
            '--disable-http2',
            // Storage and Cache optimizations
            '--aggressive-cache-discard',
            '--disable-cache',
            '--disable-application-cache',
            '--disable-gpu-shader-disk-cache',
            '--media-cache-size=0',
            '--disk-cache-size=0',
            // Speed and resource optimizations
            '--blink-settings=imagesEnabled=false',
            '--blink-settings=stylesheetEnabled=false',
            '--ignore-certificate-errors'
          ]
        };

        // Use system Chrome in production
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
          console.log(`🔧 Using Chrome executable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
          launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

          // Check if executable exists
          const fs = require('fs');
          try {
            if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
              console.log('✅ Chrome executable found');
            } else {
              console.error(`❌ Chrome executable not found at: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
            }
          } catch (e) {
            console.warn('⚠️ Could not verify Chrome executable existence:', e.message);
          }
        } else {
          console.log('📦 Using bundled Chromium');
        }

        console.log('🌐 Launching browser...');
        this.browser = await puppeteer.launch(launchOptions);
        console.log('✅ Browser launched successfully');

        // Configure download behavior to use temp directory
        const pages = await this.browser.pages();
        if (pages.length > 0) {
          const client = await pages[0].target().createCDPSession();
          await client.send('Browser.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.userDataDir
          });
          console.log(`📥 Download path set to: ${this.userDataDir}`);
        }

        // Reset if browser disconnects
        this.browser.on('disconnected', () => {
          console.warn('⚠️ Browser disconnected');
          this.browser = null;
          this.initializingPromise = null;
        });

      } catch (error) {
        console.error('❌ Browser launch failed:', error.message);
        this.browser = null;
        this.initializingPromise = null;
        throw error;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  async close() {
    if (this.browser) {
      console.log('🔒 Closing browser...');
      await this.browser.close();
      this.browser = null;
    }

    if (this.userDataDir) {
      try {
        console.log(`🧹 Cleaning up temp dir: ${this.userDataDir}`);
        // Use recursive force deletion to ensure it's gone
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
        console.log('✅ Temp dir cleaned up');
      } catch (err) {
        console.warn(`⚠️ Failed to clean up temp dir: ${err.message}`);
      }
      this.userDataDir = null;
    }
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
    await this.init();

    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page for market status...`);
        page = await this.browser.newPage();

        // Workaround for "Requesting main frame too early!"
        // Wait a tiny bit for the page's frame manager to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🔧 Setting user agent...');
        await page.setUserAgent(this.userAgent);

        console.log('🌐 Navigating to NEPSE homepage...');
        await page.goto(NEPSE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('✅ Page loaded successfully');

        try {
          console.log('📖 Reading page content...');
          const bodyText = await page.evaluate(() => document.body.innerText);
          const bodyTextLower = bodyText.toLowerCase();

          // Check for specific status strings - more lenient patterns
          // Pre-Open detection
          const isPreOpen = bodyText.includes('Pre Open') ||
            bodyText.includes('Pre-Open') ||
            /Market Status[:\s]*PRE[- ]?OPEN/i.test(bodyText) ||
            /Status[:\s]*PRE[- ]?OPEN/i.test(bodyText) ||
            bodyTextLower.includes('pre open') ||
            bodyTextLower.includes('pre-open');

          // Open detection - be specific to avoid false positives with "Pre Open"
          const isOpen = (bodyText.includes('Market Open') && !bodyText.includes('Pre')) ||
            /Market Status[:\s]*OPEN(?!\s*-)/i.test(bodyText) ||
            /Status[:\s]*OPEN(?!\s*-)/i.test(bodyText) ||
            (bodyTextLower.includes('market open') && !bodyTextLower.includes('pre'));

          // Closed detection - look for explicit "Market Closed" or "Market Status: Closed"
          const isClosed = bodyText.includes('Market Closed') ||
            bodyText.includes('Market Close') ||
            /Market Status[:\s]*CLOSED?/i.test(bodyText) ||
            /Status[:\s]*CLOSED?/i.test(bodyText) ||
            bodyTextLower.includes('market closed') ||
            bodyTextLower.includes('market close');

          // Additional indicators that market is closed
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

          // Fallback: No explicit status detected
          // This typically means it's a holiday or the website hasn't updated
          // During market hours, the website ALWAYS shows explicit status when open
          // So if we don't see it, assume CLOSED (likely holiday or market issue)
          console.log('⚠️ No explicit market status detected, defaulting to CLOSED (possible holiday)');
          return 'CLOSED';
        } catch (timeoutErr) {
          // If page parsing fails, default to CLOSED for safety
          // Better to show closed than incorrect open status
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

        // Handle specific Puppeteer error by retrying faster or ensuring fresh page
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

  async scrapeTodayPrices(maxRetries = 3) {
    console.log('📊 Scraping today\'s prices...');
    console.log('⚡ Initializing browser for price scraping...');
    await this.init();

    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page...`);
        page = await this.browser.newPage();
        await page.setUserAgent(this.userAgent);
        await page.setDefaultTimeout(60000);
        await page.setDefaultNavigationTimeout(60000);

        console.log('🎯 Trying CSV download method first...');
        try {
          const result = await this.scrapeTodayPricesCSVDownload(page);
          await page.close().catch(() => { });
          page = null;
          return result;
        } catch (csvError) {
          console.log(`⚠️ CSV download method failed (attempt ${attempt}): ${csvError.message}`);

          // Close old page and open a fresh one for the next method to avoid "main frame too early"
          await page.close().catch(() => { });
          page = await this.browser.newPage();
          await page.setUserAgent(this.userAgent);
          await page.setDefaultTimeout(60000);

          console.log('🔄 Falling back to API capture...');
          try {
            const result = await this.scrapeTodayPricesAPI(page);
            await page.close().catch(() => { });
            page = null;
            return result;
          } catch (apiError) {
            console.log(`⚠️ API capture failed (attempt ${attempt}): ${apiError.message}`);

            // Fresh page for HTML scraping
            await page.close().catch(() => { });
            page = await this.browser.newPage();
            await page.setUserAgent(this.userAgent);
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

    // Intercept the API response
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

    // Navigate to page
    console.log('🌐 Loading today-price page...');
    await page.goto(TODAY_PRICE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Look for and click the CSV download button
    await page.waitForSelector('.download-csv', { timeout: 15000 });
    const downloadButton = await page.$('.download-csv');

    if (!downloadButton) {
      throw new Error('CSV download button not found');
    }

    console.log('🎯 Clicking CSV download button...');
    await downloadButton.click();

    // Wait for the API call to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (!interceptedData) {
      throw new Error('No data intercepted from CSV download');
    }

    // Format the intercepted data
    const formattedData = this.formatCSVDownloadData(interceptedData);
    console.log(`✅ Successfully processed ${formattedData.length} records via CSV download`);
    return formattedData;
  }

  formatCSVDownloadData(data) {
    if (!Array.isArray(data)) return [];

    return data.map(record => {
      // Calculate changes
      const ltp = record.lastUpdatedPrice || record.lastTradedPrice || record.closePrice || 0;
      const prevClose = record.previousDayClosePrice || 0;
      const pointChange = ltp && prevClose ? (ltp - prevClose) : 0;
      const percentChange = prevClose && prevClose !== 0 ? ((pointChange / prevClose) * 100) : 0;

      return {
        symbol: record.symbol,
        securityName: record.securityName,
        securityId: record.securityId,
        businessDate: record.businessDate,
        openPrice: record.openPrice || 0,
        highPrice: record.highPrice || 0,
        lowPrice: record.lowPrice || 0,
        closePrice: ltp,
        previousClose: prevClose,
        change: pointChange,
        percentageChange: percentChange,
        totalTradedQuantity: record.totalTradedQuantity || 0,
        totalTradedValue: record.totalTradedValue || 0,
        totalTrades: record.totalTrades || 0,
        averageTradedPrice: record.averageTradedPrice || 0,
        marketCapitalization: record.marketCapitalization || 0,
        fiftyTwoWeekHigh: record.fiftyTwoWeekHigh || 0,
        fiftyTwoWeekLow: record.fiftyTwoWeekLow || 0,
        lastUpdatedTime: record.lastUpdatedTime,
        lastTradedPrice: ltp,
        volume: record.totalTradedQuantity || 0,
        turnover: record.totalTradedValue || 0,
        maxPrice: record.highPrice || 0,
        minPrice: record.lowPrice || 0
      };
    }).filter(stock => stock.symbol);
  }

  async scrapeTodayPricesAPI(page) {
    console.log('📡 Using API capture method...');
    const apiResponses = [];

    // Listen for API responses
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

    // Wait for page to load and API calls
    await page.waitForFunction(() => {
      return document.querySelector('table') ||
        document.querySelector('[class*="table"]') ||
        document.querySelector('[class*="grid"]');
    }, { timeout: 45000 });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Process API response
    const todayPriceResponse = apiResponses.find(r =>
      r.url.includes('today-price') &&
      r.url.includes('/api/') &&
      r.status === 200 &&
      r.data?.content
    );

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
    return this.formatAPIData(stockArray);
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
    return this.formatHTMLData(data);
  }

  formatAPIData(stockArray) {
    return stockArray.map(stock => ({
      symbol: stock.symbol,
      securityName: stock.securityName,
      securityId: stock.securityId,
      businessDate: stock.businessDate,
      openPrice: stock.openPrice,
      highPrice: stock.highPrice,
      lowPrice: stock.lowPrice,
      closePrice: stock.closePrice,
      previousClose: stock.previousDayClosePrice,
      change: stock.closePrice - stock.previousDayClosePrice,
      percentageChange: ((stock.closePrice - stock.previousDayClosePrice) / stock.previousDayClosePrice * 100),
      totalTradedQuantity: stock.totalTradedQuantity,
      totalTradedValue: stock.totalTradedValue,
      totalTrades: stock.totalTrades,
      averageTradedPrice: stock.averageTradedPrice,
      marketCapitalization: stock.marketCapitalization,
      fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stock.fiftyTwoWeekLow,
      lastUpdatedTime: stock.lastUpdatedTime,
      lastTradedPrice: stock.closePrice,
      volume: stock.totalTradedQuantity,
      turnover: stock.totalTradedValue,
      maxPrice: stock.highPrice,
      minPrice: stock.lowPrice
    }));
  }

  formatHTMLData(rawData) {
    return rawData.map(row => {
      const parseNumber = (val) => {
        if (!val || val === '' || val === '-' || val === 'N/A') return 0;
        return parseFloat(val.replace(/,/g, '')) || 0;
      };

      const symbol = row.symbol || row.scriptsymbol || row.script || '';
      const closePrice = parseNumber(row.ltp || row.closingprice || row.close);
      const previousClose = parseNumber(row.previousclose || row.prevclose);

      return {
        symbol: symbol.toUpperCase(),
        securityName: row.companyname || row.securityname || row.name || '',
        businessDate: DateTime.now().setZone('Asia/Kathmandu').toISODate(),
        openPrice: parseNumber(row.open || row.openprice),
        highPrice: parseNumber(row.high || row.highprice || row.max),
        lowPrice: parseNumber(row.low || row.lowprice || row.min),
        closePrice: closePrice,
        previousClose: previousClose,
        change: closePrice - previousClose,
        percentageChange: previousClose > 0 ? ((closePrice - previousClose) / previousClose * 100) : 0,
        totalTradedQuantity: parseNumber(row.qty || row.quantity || row.volume),
        totalTradedValue: parseNumber(row.turnover || row.amount || row.value),
        lastTradedPrice: closePrice,
        volume: parseNumber(row.qty || row.quantity || row.volume),
        turnover: parseNumber(row.turnover || row.amount || row.value),
        maxPrice: parseNumber(row.high || row.highprice || row.max),
        minPrice: parseNumber(row.low || row.lowprice || row.min)
      };
    }).filter(stock => stock.symbol && stock.symbol.length > 0);
  }

  parseApiProfileData(profileData, securityData, symbol) {
    // Helper to safely parse numbers
    const parseNumber = (val) => {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'number') return val;
      return parseFloat(String(val).replace(/,/g, '')) || 0;
    };

    const clean = (text) => text ? String(text).replace(/\s+/g, ' ').trim() : '';

    // Extract data from both API responses
    const info = {
      rawLogoData: '',
      isLogoPlaceholder: true,
      companyName: '',
      sectorName: '',
      email: '',
      permittedToTrade: 'No',
      status: '',
      instrumentType: '',
      listingDate: '',
      lastTradedPrice: 0,
      totalTradedQuantity: 0,
      totalTrades: 0,
      previousClose: 0,
      highPrice: 0,
      lowPrice: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      openPrice: 0,
      closePrice: 0,
      totalListedShares: 0,
      totalPaidUpValue: 0,
      marketCapitalization: 0,
      paidUpCapital: 0,
      issueManager: '',
      shareRegistrar: '',
      website: '',
      promoterShares: 0,
      publicShares: 0,
      averageTradedPrice: 0,

      // Additional fields detected
      isin: '',
      faceValue: 0,
      regulatoryBody: '',
      shareGroup: '',
      issuedCapital: 0,
      promoterPercentage: 0,
      publicPercentage: 0,
      updatedDate: '',
      businessDate: '',
      lastUpdatedDateTime: ''
    };

    // Extract fromprofile data - merge if already exists or override if better source
    if (profileData) {
      if (!info.companyName) info.companyName = clean(profileData.companyName || '');
      if (!info.email) info.email = clean(profileData.companyEmail || '');

      // Profile API sometimes has logo
      if (!info.rawLogoData && profileData.logoFilePath) {
        info.rawLogoData = profileData.logoFilePath;
        info.isLogoPlaceholder = false;
      }
      if (info.rawLogoData && info.rawLogoData.startsWith('assets/')) {
        info.rawLogoData = `https://www.nepalstock.com/${info.rawLogoData}`;
      }
    }

    // Extract from security data
    if (securityData) {
      // Handle nested security object
      const security = securityData.security || {};
      const dailyTrade = securityData.securityDailyTradeDto || {};
      const companyInfo = security.companyId || {};
      const sectorMaster = companyInfo.sectorMaster || {};

      // Instrument type is an object, extract the description
      if (security.instrumentType && typeof security.instrumentType === 'object') {
        info.instrumentType = clean(security.instrumentType.description || security.instrumentType.code || '');
      } else {
        info.instrumentType = clean(security.instrumentType || '');
      }

      info.status = clean(security.activeStatus || security.status || '');
      info.permittedToTrade = clean(security.permittedToTrade || 'No');
      info.listingDate = clean(security.listingDate || '');

      // Extract sector name from nested sectorMaster
      info.sectorName = clean(sectorMaster.sectorDescription || '');

      // Extract website from companyId
      info.website = clean(companyInfo.companyWebsite || '');

      // Share registrar might be in companyContactPerson or we can use company short name
      info.shareRegistrar = clean(companyInfo.companyContactPerson || '');

      // Trading data from dailyTrade object - note the correct field name
      info.lastTradedPrice = parseNumber(dailyTrade.lastTradedPrice);
      info.totalTradedQuantity = parseNumber(dailyTrade.totalTradeQuantity); // Correct field name!
      info.totalTrades = parseInt(parseNumber(dailyTrade.totalTrades), 10);
      info.previousClose = parseNumber(dailyTrade.previousClose);
      info.highPrice = parseNumber(dailyTrade.highPrice);
      info.lowPrice = parseNumber(dailyTrade.lowPrice);
      info.openPrice = parseNumber(dailyTrade.openPrice);
      info.closePrice = parseNumber(dailyTrade.closePrice);

      // Average traded price calculation if not provided
      if (dailyTrade.averageTradedPrice) {
        info.averageTradedPrice = parseNumber(dailyTrade.averageTradedPrice);
      } else if (dailyTrade.totalTradeQuantity && dailyTrade.totalTradeQuantity > 0) {
        // Calculate from total value / total quantity if available
        const totalValue = parseNumber(dailyTrade.totalTradeValue || 0);
        if (totalValue > 0) {
          info.averageTradedPrice = totalValue / dailyTrade.totalTradeQuantity;
        }
      }

      // Financial data from root level
      info.totalListedShares = parseNumber(securityData.stockListedShares);
      info.paidUpCapital = parseNumber(securityData.paidUpCapital);
      info.totalPaidUpValue = parseNumber(securityData.paidUpCapital);
      info.marketCapitalization = parseNumber(securityData.marketCapitalization);
      info.promoterShares = parseNumber(securityData.promoterShares);
      info.publicShares = parseNumber(securityData.publicShares);

      // 52-week high/low
      info.fiftyTwoWeekHigh = parseNumber(dailyTrade.fiftyTwoWeekHigh);
      info.fiftyTwoWeekLow = parseNumber(dailyTrade.fiftyTwoWeekLow);

      // New fields
      info.isin = clean(security.isin || '');
      info.faceValue = parseNumber(security.faceValue);
      info.regulatoryBody = clean(sectorMaster.regulatoryBody || '');
      info.shareGroup = clean(security.shareGroupId?.name || '');
      info.issuedCapital = parseNumber(securityData.issuedCapital);
      info.promoterPercentage = parseNumber(securityData.promoterPercentage);
      info.publicPercentage = parseNumber(securityData.publicPercentage);
      info.updatedDate = clean(securityData.updatedDate || '');
      info.businessDate = clean(dailyTrade.businessDate || '');
      info.lastUpdatedDateTime = clean(dailyTrade.lastUpdatedDateTime || '');
    }

    return info;
  }

  async scrapeAllCompanyDetails(securityIds, saveCallback = null, dividendCallback = null, financialCallback = null) {
    if (!securityIds || securityIds.length === 0) return [];

    console.log(`🏢 Starting company details scrape for ${securityIds.length} companies...`);
    await this.init();
    const details = [];
    let page = null;

    try {
      page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);

      // Block heavy resources to speed up scraping
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        // Block images, stylesheets, fonts, and media
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      let count = 0;
      for (const sec of securityIds) {
        count++;
        const { security_id, symbol } = sec;
        const url = `https://www.nepalstock.com/company/detail/${security_id}`;

        // Variables to store intercepted API data
        let apiSecurityData = null;
        let apiProfileData = null;

        // Set up response listener to intercept API calls
        const responseHandler = async (response) => {
          const responseUrl = response.url();

          // Intercept the security API calls
          if (responseUrl.includes('/api/nots/security/') && responseUrl.includes(`/${security_id}`)) {
            try {
              const status = response.status();

              // Try to get JSON data even if status is not 200
              if (status === 200 || status === 401) {
                const data = await response.json().catch(() => null);
                if (data) {
                  // Determine which endpoint this is from
                  if (responseUrl.includes('/profile/')) {
                    apiProfileData = data;
                  } else {
                    apiSecurityData = data;
                  }
                }
              }
            } catch (e) {
              // Silently handle API parsing errors
            }
          }
        };

        // Attach the response listener
        page.on('response', responseHandler);

        // Retry logic - try up to 2 times
        let retries = 2;
        let success = false;

        while (retries > 0 && !success) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait a bit for API calls to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Quick check for page load
            await page.waitForSelector('.company__title--details', { timeout: 3000 }).catch(() => { });

            // Click profile tab if exists - use evaluate for robust clicking
            const profileTab = await page.$('#profileTab');
            if (profileTab) {
              await page.evaluate(el => el.click(), profileTab); // Robust click
              // Wait for profile content or API call
              await new Promise(resolve => setTimeout(resolve, 1500));
              await page.waitForSelector('#profile_section', { timeout: 3000 }).catch(() => { });
            }

            success = true;
          } catch (err) {
            console.warn(`⚠️ Navigation failed for ${symbol} (retry ${3 - retries}): ${err.message}`);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay before retry
            }
          }
        }

        // Remove the response listener to avoid memory leaks
        page.off('response', responseHandler);

        if (!success) {
          console.error(`❌ Failed to navigate to ${symbol} after multiple retries.`);
          // Continue to the next company if navigation consistently fails
          continue;
        }

        let data;
        try {
          // Prefer API data if available
          if (apiProfileData || apiSecurityData) {
            data = this.parseApiProfileData(apiProfileData, apiSecurityData, symbol);
          } else {

            // Check if content is in an iframe
            const iframeHandle = await page.$('#company_detail_iframe');
            let targetFrame = page;

            if (iframeHandle) {
              const frame = await iframeHandle.contentFrame();
              if (frame) {
                targetFrame = frame;
                // Wait for content to load in iframe
                await frame.waitForSelector('table, .company__title--details', { timeout: 5000 }).catch(() => { });
              }
            }

            data = await targetFrame.evaluate(() => {
              const info = {};

              const clean = (text) => text ? text.replace(/\s+/g, ' ').trim() : '';
              const parseNumber = (text) => {
                if (!text) return 0;
                return parseFloat(text.replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
              };

              let logoImg = document.querySelector('#profile_section .team-member img');
              if (!logoImg || logoImg.getAttribute('src').includes('placeholder')) {
                logoImg = document.querySelector('.company__title--logo img');
              }
              info.rawLogoData = logoImg ? logoImg.getAttribute('src') : '';
              if (info.rawLogoData && info.rawLogoData.startsWith('assets/')) {
                info.rawLogoData = `https://www.nepalstock.com/${info.rawLogoData}`;
              }
              info.isLogoPlaceholder = info.rawLogoData.includes('placeholder');

              const companyNameEl = document.querySelector('.company__title--details h1');
              let companyName = companyNameEl ? clean(companyNameEl.innerText) : '';
              // Remove symbol in parentheses from company name (e.g., "Company Name (SYMBOL)" -> "Company Name")
              info.companyName = companyName.replace(/\s*\([A-Z]+\)\s*$/, '').trim();

              const metaItems = document.querySelectorAll('.company__title--metas li');
              metaItems.forEach(li => {
                const text = li.innerText;
                if (text.includes('Sector:')) {
                  info.sectorName = clean(text.split('Sector:')[1]);
                } else if (text.includes('Email Address:')) {
                  info.email = clean(text.split('Email Address:')[1]);
                } else if (text.includes('Status:')) {
                  info.status = clean(text.split('Status:')[1]);
                } else if (text.includes('Permitted to Trade:')) {
                  info.permittedToTrade = clean(text.split('Permitted to Trade:')[1]);
                }
              });

              const getTableValue = (label) => {
                const rows = Array.from(document.querySelectorAll('table tr'));
                for (const row of rows) {
                  const th = row.querySelector('th');
                  const td = row.querySelector('td');
                  if (th && td && th.innerText.trim().includes(label)) {
                    return clean(td.innerText);
                  }
                }
                return null;
              };

              info.instrumentType = getTableValue('Instrument Type') || '';
              info.listingDate = getTableValue('Listing Date') || '';

              const lastTradedPriceCell = getTableValue('Last Traded Price');
              if (lastTradedPriceCell) {
                const priceMatch = lastTradedPriceCell.match(/([0-9,]+\.?[0-9]*)/);
                info.lastTradedPrice = priceMatch ? parseNumber(priceMatch[1]) : 0;
              } else {
                info.lastTradedPrice = 0;
              }

              info.totalTradedQuantity = parseNumber(getTableValue('Total Traded Quantity'));
              info.totalTrades = parseInt(parseNumber(getTableValue('Total Trades')), 10);
              info.previousClose = parseNumber(getTableValue('Previous Day Close Price'));

              const highLowText = getTableValue('High Price / Low Price');
              if (highLowText) {
                const parts = highLowText.split('/');
                info.highPrice = parts[0] ? parseNumber(parts[0]) : 0;
                info.lowPrice = parts[1] ? parseNumber(parts[1]) : 0;
              } else {
                info.highPrice = 0;
                info.lowPrice = 0;
              }

              const fiftyTwoWeekText = getTableValue('52 Week High / 52 Week Low');
              if (fiftyTwoWeekText) {
                const parts = fiftyTwoWeekText.split('/');
                info.fiftyTwoWeekHigh = parts[0] ? parseNumber(parts[0]) : 0;
                info.fiftyTwoWeekLow = parts[1] ? parseNumber(parts[1]) : 0;
              } else {
                info.fiftyTwoWeekHigh = 0;
                info.fiftyTwoWeekLow = 0;
              }

              info.openPrice = parseNumber(getTableValue('Open Price'));

              const closePriceText = getTableValue('Close Price');
              info.closePrice = parseNumber(closePriceText ? closePriceText.replace('*', '') : '0');

              info.totalListedShares = parseNumber(getTableValue('Total Listed Shares'));
              info.totalPaidUpValue = parseNumber(getTableValue('Total Paid up Value'));
              info.marketCapitalization = parseNumber(getTableValue('Market Capitalization'));
              info.paidUpCapital = info.totalPaidUpValue || parseNumber(getTableValue('Paid Up Capital'));
              info.issueManager = getTableValue('Issue Manager') || '';
              info.shareRegistrar = getTableValue('Share Registrar') || '';
              info.website = getTableValue('Website') || '';
              info.promoterShares = parseNumber(getTableValue('Promoter Shares'));
              info.publicShares = parseNumber(getTableValue('Public Shares'));
              info.averageTradedPrice = parseNumber(getTableValue('Average Traded Price'));

              return info;
            });
          }

          // Process the logo image - save base64 images, ignore URLs
          const processedLogoUrl = await processImageData(data.rawLogoData, symbol);

          // Translate company name and sector name to Nepali
          const nepaliCompanyName = await translateToNepali(data.companyName);
          const nepaliSectorName = await translateToNepali(data.sectorName);

          const item = {
            securityId: security_id,
            symbol: symbol,
            ...data,
            nepali_company_name: nepaliCompanyName,
            nepali_sector_name: nepaliSectorName,
            logoUrl: processedLogoUrl // Replace with processed URL or null
          };

          // Remove rawLogoData from the final item
          delete item.rawLogoData;

          details.push(item);

          // Save immediately after scraping each company
          if (saveCallback) {
            try {
              await saveCallback([item]);
              console.log(`💾 Saved ${symbol} (${count}/${securityIds.length})`);
            } catch (saveErr) {
              console.error(`❌ Failed to save ${symbol}:`, saveErr.message);
            }
          }

          // --- Scrape Dividends ---
          if (dividendCallback) {
            try {
              const dividendTab = await page.$('#dividendTab');
              if (dividendTab) {
                await page.evaluate(el => el.click(), dividendTab); // Robust click
                await new Promise(r => setTimeout(r, 1000)); // Wait for tab switch

                // Wait specifically for table rows or empty message
                try {
                  await page.waitForFunction(
                    () => document.querySelector('#dividend table tbody tr') !== null,
                    { timeout: 3000 }
                  );
                } catch (e) { /* ignore timeout, maybe empty */ }

                await page.waitForSelector('#dividend table', { timeout: 2000 }).catch(() => { });

                const dividends = await page.evaluate((secId) => {
                  const table = document.querySelector('#dividend table');
                  if (!table) return [];

                  const rows = Array.from(table.querySelectorAll('tbody tr'));

                  // Dynamic Header Mapping
                  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase().replace(/\s+/g, ' ').trim());

                  const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                  const idxFY = getIdx(['fiscal', 'year']);
                  const idxBonus = getIdx(['bonus']);
                  const idxCash = getIdx(['cash']);
                  // Some tables might have Total, most don't
                  const idxTotal = getIdx(['total']);
                  const idxBookClose = getIdx(['book', 'closure', 'date']);

                  return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    // Need at least FY and some data
                    if (cells.length < 3) return null;

                    const cleanVal = (idx) => idx !== -1 && cells[idx] ? cells[idx].innerText.trim() : null;

                    const parseNum = (txt) => {
                      if (!txt) return 0;
                      return parseFloat(txt.replace(/%|Rs\.?|,/g, '').trim()) || 0;
                    };

                    // Fallback to index 1 for FY if SN is at 0 and mapping failed, but mapping should work
                    const fy = cleanVal(idxFY) || (cells[1] ? cells[1].innerText.trim() : null);
                    if (!fy) return null;

                    const bonus = parseNum(cleanVal(idxBonus));
                    const cash = parseNum(cleanVal(idxCash));
                    const total = idxTotal !== -1 ? parseNum(cleanVal(idxTotal)) : (bonus + cash);

                    return {
                      securityId: secId,
                      fiscalYear: fy,
                      bonusShare: bonus,
                      cashDividend: cash,
                      totalDividend: total,
                      publishedDate: cleanVal(idxBookClose) || ''
                    };
                  }).filter(d => d && d.fiscalYear);
                }, security_id);

                if (dividends.length > 0) {
                  await dividendCallback(dividends);
                  console.log(`   💰 Saved ${dividends.length} dividend records`);
                }
              }
            } catch (divErr) {
              console.warn(`   ⚠️ Dividend scrape failed for ${symbol}: ${divErr.message}`);
            }
          }

          // --- Scrape Financials ---
          if (financialCallback) {
            try {
              // Try to find financials tab by ID or text
              let financialTab = await page.$('#financialTab, #financialsTab');
              if (!financialTab) {
                const tabs = await page.$$('.nav-link');
                for (const tab of tabs) {
                  const text = await page.evaluate(el => el.innerText, tab);
                  if (text && text.trim().includes('Financial')) {
                    financialTab = tab;
                    break;
                  }
                }
              }

              if (financialTab) {
                await page.evaluate(el => el.click(), financialTab); // Robust click
                await new Promise(r => setTimeout(r, 1000));

                try {
                  // Wait for financial table rows
                  await page.waitForFunction(
                    () => document.querySelector('div[id*="financial"] table tbody tr') !== null,
                    { timeout: 3000 }
                  );
                } catch (e) { /* ignore */ }
                // Target pane often matches ID in href (e.g., #financial)
                await page.waitForSelector('div[id*="financial"] table', { timeout: 5000 }).catch(() => { });

                const financials = await page.evaluate((secId) => {
                  // Find visible table in the active tab (or just the one in the financial section)
                  const table = document.querySelector('div[id*="financial"] table');
                  if (!table) return [];

                  const rows = Array.from(table.querySelectorAll('tbody tr'));

                  // Map headers
                  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase().replace(/\s+/g, ' ').trim());
                  const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                  const idxFY = getIdx(['fiscal', 'year']);
                  const idxQ = getIdx(['quart']);
                  const idxPaidUp = getIdx(['paid', 'capital']);
                  const idxProfit = getIdx(['net profit', 'profit', 'amount']);
                  const idxEPS = getIdx(['eps', 'earnings']);
                  const idxNetWorth = getIdx(['net worth', 'book value']);
                  // 'p.e' needs to match 'P.E' in header
                  const idxPE = getIdx(['p/e', 'price earning', 'p.e', 'ratio']);

                  return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return null;

                    const parseNum = (txt) => {
                      if (!txt) return 0;
                      return parseFloat(txt.replace(/,/g, '').trim()) || 0;
                    };

                    const getVal = (idx) => idx !== -1 && cells[idx] ? cells[idx].innerText.trim() : null;
                    const getNum = (idx) => idx !== -1 && cells[idx] ? parseNum(cells[idx].innerText) : 0;

                    const fy = getVal(idxFY) || (cells[1] ? cells[1].innerText.trim() : null);
                    if (!fy) return null;

                    // Fallbacks based on observed structure: 
                    // 0:SN, 1:FY, 2:Report, 3:Q, 4:NetWorth, 5:Profit, 6:PaidUp, 7:PE, 8:EPS
                    return {
                      securityId: secId,
                      fiscalYear: fy,
                      quarter: getVal(idxQ) || (cells[3] ? cells[3].innerText.trim() : ''),
                      paidUpCapital: getNum(idxPaidUp) || getNum(6),
                      netProfit: getNum(idxProfit) || getNum(5),
                      earningsPerShare: getNum(idxEPS) || getNum(8),
                      netWorthPerShare: getNum(idxNetWorth) || getNum(4),
                      priceEarningsRatio: getNum(idxPE) || getNum(7)
                    };
                  }).filter(f => f && f.fiscalYear);
                }, security_id);

                if (financials.length > 0) {
                  await financialCallback(financials);
                  console.log(`   📈 Saved ${financials.length} financial records`);
                }
              }
            } catch (finErr) {
              console.warn(`   ⚠️ Financials scrape failed for ${symbol}: ${finErr.message}`);
            }
          }

        } catch (evalError) {
          console.error(`❌ Failed to evaluate page for ${symbol}:`, evalError.message);
          // Continue with empty data if page evaluation fails
        }

        if (count % 10 === 0) {
          console.log(`📊 Progress: ${count}/${securityIds.length}`);
        }
      }

      // Close page after scraping all companies
      if (page) {
        await page.close().catch(() => { });
      }
    } catch (e) {
      console.error('❌ Error in company details scraping:', e);
      // Close page on error
      if (page) {
        await page.close().catch(() => { });
      }
    }

    return details;
  }

  async fetchMarketIndexFromAPI() {
    console.log('🔌 Attempting to fetch market index from NEPSE API...');

    const API_URL = 'https://nepalstock.com.np/api/nots/nepse-index';

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Referer': 'https://nepalstock.com.np/',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 API Response received');

      // Parse the API response - structure may vary
      // Common structure: { currentValue, change, percentageChange, ... }
      const result = {
        nepseIndex: 0,
        indexChange: 0,
        indexPercentageChange: 0,
        totalTurnover: 0,
        totalTradedShares: 0,
        advanced: 0,
        declined: 0,
        unchanged: 0,
        marketStatusDate: null,
        marketStatusTime: null
      };

      // Handle array response (common NEPSE API format)
      const indexData = Array.isArray(data) ? data[0] : data;

      if (indexData) {
        result.nepseIndex = parseFloat(indexData.currentValue || indexData.index || indexData.nepseIndex || 0);
        result.indexChange = parseFloat(indexData.change || indexData.indexChange || 0);
        result.indexPercentageChange = parseFloat(indexData.percentageChange || indexData.perChange || indexData.indexPercentageChange || 0);
        result.totalTurnover = parseFloat(indexData.turnover || indexData.totalTurnover || 0);
        result.totalTradedShares = parseFloat(indexData.tradedShares || indexData.totalTradedShares || 0);
        result.advanced = parseInt(indexData.advanced || indexData.positive || 0, 10);
        result.declined = parseInt(indexData.declined || indexData.negative || 0, 10);
        result.unchanged = parseInt(indexData.unchanged || indexData.neutral || 0, 10);

        // Extract date/time if available
        if (indexData.asOf || indexData.date) {
          const dateStr = indexData.asOf || indexData.date;
          result.marketStatusDate = dateStr;
        }
      }

      console.log(`📊 API Index: ${result.nepseIndex}, Change: ${result.indexChange} (${result.indexPercentageChange}%)`);

      return result;
    } catch (error) {
      console.error('❌ API fetch failed:', error.message);
      throw error;
    }
  }

  async scrapeMarketIndex(maxRetries = 3) {
    console.log('📈 Scraping market index data...');

    // Try API first (more reliable and faster)
    try {
      const apiData = await this.fetchMarketIndexFromAPI();
      if (apiData && apiData.nepseIndex > 0) {
        console.log('✅ Market index fetched from API successfully');
        return apiData;
      }
    } catch (apiError) {
      console.log('⚠️ API fetch failed, falling back to scraping:', apiError.message);
    }

    // Fallback to scraping
    console.log('⚡ Initializing browser for market index scrape...');
    await this.init();

    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ensure browser is valid before each attempt
        if (!this.browser || !this.browser.isConnected()) {
          console.log('♻️ Browser invalid or disconnected, re-initializing...');
          await this.init();
        }

        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page for market index...`);
        page = await this.browser.newPage();

        // Workaround for "Requesting main frame too early!"
        await new Promise(resolve => setTimeout(resolve, 500));

        await page.setUserAgent(this.userAgent);

        // Disable cache to ensure fresh data
        await page.setCacheEnabled(false);

        // Add cache-busting query parameter
        const cacheBuster = `?_=${Date.now()}`;
        const url = `${NEPSE_URL}${cacheBuster}`;

        console.log('🌐 Navigating to NEPSE homepage (cache disabled)...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('✅ Page loaded successfully');

        // Wait for market index section to be visible
        await page.waitForSelector('[class*="market-index"], [class*="nepse-index"], .index-section, [class*="index"]', { timeout: 10000 }).catch(() => {
          console.log('⚠️ Could not find market index selector, continuing with page evaluation');
        });

        // Wait longer for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        const indexData = await page.evaluate(() => {
          const result = {
            nepseIndex: 0,
            indexChange: 0,
            indexPercentageChange: 0,
            totalTurnover: 0,
            totalTradedShares: 0,
            advanced: 0,
            declined: 0,
            unchanged: 0,
            marketStatusDate: null,
            marketStatusTime: null,
            marketStatus: 'CLOSED' // Will be updated based on page content
          };

          const parseNumber = (text) => {
            if (!text) return 0;
            const num = parseFloat(text.replace(/,/g, '').replace(/[^\d.-]/g, ''));
            return isNaN(num) ? 0 : num;
          };

          // Extract date and time (e.g., "Dec 10 | 3:00 PM")
          const pageText = document.body.innerText;
          const dateTimeMatch = pageText.match(/([A-Za-z]+\s+\d{1,2})\s*\|\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
          if (dateTimeMatch) {
            result.marketStatusDate = dateTimeMatch[1].trim();
            result.marketStatusTime = dateTimeMatch[2].trim();
          }

          // Primary selectors based on actual NEPSE website structure
          // <span class="index__points--point">2,604.05</span>
          // <span class="index__points--change">-4.98</span>
          // <span class="index__points--changepercent">-0.19%</span>

          // Get NEPSE Index value
          const indexPointElement = document.querySelector('.index__points--point, span.index__points--point');
          if (indexPointElement) {
            result.nepseIndex = parseNumber(indexPointElement.textContent || indexPointElement.innerText);
          }

          // Get index change value
          const indexChangeElement = document.querySelector('.index__points--change, span.index__points--change');
          if (indexChangeElement) {
            result.indexChange = parseNumber(indexChangeElement.textContent || indexChangeElement.innerText);
          }

          // Get percentage change
          const indexPercentElement = document.querySelector('.index__points--changepercent, span.index__points--changepercent');
          if (indexPercentElement) {
            result.indexPercentageChange = parseNumber(indexPercentElement.textContent || indexPercentElement.innerText);
          }

          // Fallback: Try alternative selectors if primary ones didn't work
          if (result.nepseIndex === 0) {
            const indexSelectors = [
              'span[class*="index-value"]',
              'span[class*="nepse-index"]',
              'h1[class*="index"]',
              '[class*="index-section"] h1',
              '[class*="market-index"] h1',
              'div[class*="index-main"]',
              '[data-index-value]'
            ];

            for (const selector of indexSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                const text = element.textContent || element.innerText;
                if (text && /\d{2,5}\.?\d*/.test(text)) {
                  result.nepseIndex = parseNumber(text);
                  break;
                }
              }
            }
          }

          // Fallback: If still not found, search through all text content
          if (result.nepseIndex === 0) {
            const pageText = document.body.innerText;
            const indexMatch = pageText.match(/NEPSE.*?Index[:\s]+([0-9,]+\.?[0-9]*)/i);
            if (indexMatch) {
              result.nepseIndex = parseNumber(indexMatch[1]);
            } else {
              // Alternative: look for large 4-5 digit numbers
              const largeNumbers = pageText.match(/\b([2-9]\d{3,4}\.\d+)\b/g);
              if (largeNumbers && largeNumbers.length > 0) {
                result.nepseIndex = parseNumber(largeNumbers[0]);
              }
            }
          }

          // Fallback for index change if not found via primary selector
          if (result.indexChange === 0) {
            const changeSelectors = [
              'span[class*="change"]:not([class*="changepercent"])',
              'span[class*="index-change"]',
              '[class*="index-section"] span:nth-child(2)',
              '[data-index-change]'
            ];

            for (const selector of changeSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                const text = element.textContent || element.innerText;
                const changeMatch = text.match(/^[-+]?\s*[0-9,]+\.?[0-9]*$/);
                if (changeMatch) {
                  result.indexChange = parseNumber(changeMatch[0]);
                  break;
                }
              }
            }
          }

          // Fallback for percentage change if not found via primary selector
          if (result.indexPercentageChange === 0) {
            const percentMatch = document.body.innerText.match(/([-+]?\s*[0-9,]+\.?[0-9]*)%/);
            if (percentMatch) {
              result.indexPercentageChange = parseNumber(percentMatch[1]);
            }
          }

          // Check for new market summary structure (Primary)
          const summaryItems = document.querySelectorAll('.nepsemarket__summary .nepsemarket__summary--item');
          if (summaryItems && summaryItems.length > 0) {
            summaryItems.forEach(item => {
              const span = item.querySelector('span');
              const p = item.querySelector('p');
              if (span && p) {
                const label = span.textContent || span.innerText;
                const valueText = p.textContent || p.innerText;
                const value = parseNumber(valueText);

                if (label.includes('Total Turnover')) {
                  result.totalTurnover = value;
                } else if (label.includes('Total Traded Shares')) {
                  result.totalTradedShares = value;
                }
              }
            });
          }

          // Find Total Turnover and Total Traded Shares from index__points--summary (Legacy)
          const summaryElement = document.querySelector('.index__points--summary');
          if (summaryElement && result.totalTurnover === 0) {
            const summarySpans = summaryElement.querySelectorAll('span');
            summarySpans.forEach(span => {
              const text = span.textContent || span.innerText;
              // Match "Total Turnover Rs: | 212,871,839.6"
              if (text.includes('Total Turnover')) {
                const turnoverMatch = text.match(/Total Turnover\s*Rs[:\s]*\|?\s*([0-9,]+\.?[0-9]*)/i);
                if (turnoverMatch) {
                  result.totalTurnover = parseNumber(turnoverMatch[1]);
                }
              }
              // Match "Total Traded Shares | 407,771"
              if (text.includes('Total Traded Shares')) {
                const sharesMatch = text.match(/Total Traded Shares\s*\|?\s*([0-9,]+)/i);
                if (sharesMatch) {
                  result.totalTradedShares = parseNumber(sharesMatch[1]);
                }
              }
            });
          }

          // Fallback: Find Total Turnover from page text if not found
          if (result.totalTurnover === 0) {
            const turnoverMatch = document.body.innerText.match(/Total Turnover\s*Rs[:\s]*\|?\s*([0-9,]+\.?[0-9]*)/i);
            if (turnoverMatch) {
              result.totalTurnover = parseNumber(turnoverMatch[1]);
            }
          }

          // Fallback: Find Total Traded Shares from page text if not found
          if (result.totalTradedShares === 0) {
            const sharesMatch = document.body.innerText.match(/Total Traded Shares\s*\|?\s*([0-9,]+)/i);
            if (sharesMatch) {
              result.totalTradedShares = parseNumber(sharesMatch[1]);
            }
          }

          // Find Advanced, Declined, Unchanged counts
          const statsMatch = document.body.innerText.match(/Advanced\s*(\d+)[\s\S]*?Declined\s*(\d+)[\s\S]*?Unchanged\s*(\d+)/i);
          if (statsMatch) {
            result.advanced = parseInt(statsMatch[1], 10);
            result.declined = parseInt(statsMatch[2], 10);
            result.unchanged = parseInt(statsMatch[3], 10);
          } else {
            // Try alternative pattern
            const altMatch = document.body.innerText.match(/Advanced\s*(\d+)/i);
            const decMatch = document.body.innerText.match(/Declined\s*(\d+)/i);
            const uncMatch = document.body.innerText.match(/Unchanged\s*(\d+)/i);

            if (altMatch) result.advanced = parseInt(altMatch[1], 10);
            if (decMatch) result.declined = parseInt(decMatch[1], 10);
            if (uncMatch) result.unchanged = parseInt(uncMatch[1], 10);
          }

          // ============ MARKET STATUS DETECTION ============
          // Detect market status from page content (badges, buttons, text)
          // pageText already declared above, so use it directly
          const pageTextUpper = pageText.toUpperCase();

          // Check for status badges/buttons - NEPSE shows these as green badges
          // Priority order: PRE_OPEN > OPEN > CLOSED

          // 1. Check for PRE-OPEN status (highest priority during pre-market)
          const isPreOpen = pageTextUpper.includes('PRE OPEN') ||
            pageTextUpper.includes('PRE-OPEN') ||
            pageTextUpper.includes('PREOPEN') ||
            /PRE[- ]?OPEN/i.test(pageText);

          // 2. Check for OPEN/LIVE MARKET status
          // Look for "MARKET OPEN" or "LIVE MARKET" badges
          const isOpen = pageTextUpper.includes('MARKET OPEN') ||
            pageTextUpper.includes('LIVE MARKET') ||
            pageTextUpper.includes('MARKETOPEN') ||
            pageTextUpper.includes('LIVEMARKET');

          // 3. Check for CLOSED status indicators
          const isClosed = pageTextUpper.includes('MARKET CLOSED') ||
            pageTextUpper.includes('MARKET CLOSE') ||
            pageTextUpper.includes('MARKETCLOSED');

          // Determine final status with priority: PRE_OPEN > OPEN > CLOSED
          if (isPreOpen && !isClosed) {
            result.marketStatus = 'PRE_OPEN';
          } else if (isOpen && !isClosed && !isPreOpen) {
            result.marketStatus = 'OPEN';
          } else if (isClosed) {
            result.marketStatus = 'CLOSED';
          } else {
            // Default: if we have index data and no explicit closed indicator, assume open during data availability
            result.marketStatus = 'CLOSED';
          }

          return result;
        });

        await page.close();

        console.log('✅ Market index data scraped successfully');
        console.log(`📊 Index: ${indexData.nepseIndex}, Change: ${indexData.indexChange} (${indexData.indexPercentageChange}%)`);
        console.log(`💱 Turnover: ${indexData.totalTurnover}, Traded Shares: ${indexData.totalTradedShares}`);
        console.log(`📈 Advanced: ${indexData.advanced}, Declined: ${indexData.declined}, Unchanged: ${indexData.unchanged}`);

        return indexData;
      } catch (error) {
        lastError = error;
        console.error(`❌ Market index scraping attempt ${attempt} failed:`, error.message);

        // Force browser reset on critical errors
        if (error.message.includes('createTarget') ||
          error.message.includes('Protocol error') ||
          error.message.includes('Browser disconnected') ||
          error.message.includes('Navigating frame was detached') ||
          error.message.includes('not an object')) {
          console.log('⚠️ Browser appears unstable, closing instance...');
          await this.close();
        }

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

  async scrapeMarketIndicesHistory(maxRetries = 3) {
    console.log('📊 Scraping market indices history...');
    await this.init();

    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        page = await this.browser.newPage();
        await page.setUserAgent(this.userAgent);

        let interceptedData = null;

        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('/api/nots/index/history/')) {
            try {
              const data = await response.json();
              if (data && data.content && Array.isArray(data.content)) {
                // Prioritize larger datasets (one with size=500)
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
          // NEPSE often has multiple selects, the items per page is usually the second one
          const select = selects.length > 1 ? selects[1] : selects[0];
          if (select) {
            select.value = '500';
            select.dispatchEvent(new Event('change', { bubbles: true }));

            // Also try to find and click the Filter/Search button
            const filterButton = document.querySelector('button.box__filter--search');
            if (filterButton) {
              filterButton.click();
            }
          }
        });

        // Wait for the API response
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

// Export functions
async function scrapeMarketSummary() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeMarketSummary();
  } finally {
    await scraper.close();
  }
}

async function scrapeMarketStatus() {
  const scraper = new NepseScraper();
  try {
    const summary = await scraper.scrapeMarketSummary();
    return summary.status;
  } finally {
    await scraper.close();
  }
}

async function scrapeTodayPrices() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeTodayPrices();
  } finally {
    await scraper.close();
  }
}

async function scrapeAllCompanyDetails(securityIds, saveCallback = null) {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeAllCompanyDetails(securityIds, saveCallback);
  } finally {
    await scraper.close();
  }
}

async function scrapeMarketIndicesHistory() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeMarketIndicesHistory();
  } finally {
    await scraper.close();
  }
}

// Legacy function names for compatibility
const fetchTodaysPrices = scrapeTodayPrices;

module.exports = {
  NepseScraper,
  scrapeMarketSummary,
  scrapeMarketStatus,
  scrapeTodayPrices,
  scrapeAllCompanyDetails,
  scrapeMarketIndicesHistory,
  fetchTodaysPrices
};
