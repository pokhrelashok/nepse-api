const puppeteer = require('puppeteer');
const { processImageData } = require('../utils/image-handler');
const { DateTime } = require('luxon');

const NEPSE_URL = 'https://www.nepalstock.com';
const TODAY_PRICE_URL = 'https://www.nepalstock.com/today-price';

class NepseScraper {
  constructor() {
    this.browser = null;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async init() {
    if (!this.browser) {
      console.log('🚀 Initializing Puppeteer browser...');

      const launchOptions = {
        headless: true,
        timeout: 60000,
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
          '--remote-debugging-port=0'
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
      try {
        this.browser = await puppeteer.launch(launchOptions);
        console.log('✅ Browser launched successfully');

        // Test basic browser functionality
        const page = await this.browser.newPage();
        console.log('📄 Test page created');
        await page.close();
        console.log('✅ Browser test passed');

      } catch (error) {
        console.error('❌ Browser launch failed:', error.message);
        console.error('🔍 Launch options:', JSON.stringify(launchOptions, null, 2));
        throw error;
      }
    } else {
      console.log('♻️ Reusing existing browser instance');
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeMarketStatus() {
    console.log('🔍 Checking market status...');
    console.log('⚡ Initializing browser for market status check...');
    await this.init();

    try {
      console.log('📄 Creating new page for market status...');
      const page = await this.browser.newPage();
      console.log('🔧 Setting user agent...');
      await page.setUserAgent(this.userAgent);

      console.log('🌐 Navigating to NEPSE homepage...');
      await page.goto(NEPSE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log('✅ Page loaded successfully');

      try {
        console.log('⏳ Waiting for page body...');
        await page.waitForSelector('body', { timeout: 10000 });
        console.log('📖 Reading page content...');
        const bodyText = await page.evaluate(() => document.body.innerText);

        const isOpen = bodyText.includes('Market Open') || bodyText.match(/Market Status[:\s]*OPEN/i);
        const isClosed = bodyText.includes('Market Closed') || bodyText.match(/Market Status[:\s]*CLOSED/i);

        if (isOpen) return true;
        if (isClosed) return false;

        // Fallback: time-based check
        console.log('⏰ Using time-based market status fallback...');
        const now = DateTime.now().setZone('Asia/Kathmandu');
        const currentTime = now.hour * 100 + now.minute;
        return currentTime >= 1000 && currentTime <= 1500 && [1, 2, 3, 4, 5].includes(now.weekday);
      } catch (timeoutErr) {
        console.warn('⚠️ Failed to detect market status from page, using time-based fallback');
        const now = DateTime.now().setZone('Asia/Kathmandu');
        const currentTime = now.hour * 100 + now.minute;
        return currentTime >= 1000 && currentTime <= 1500 && [1, 2, 3, 4, 5].includes(now.weekday);
      }
    } catch (error) {
      console.error('❌ Market status check failed:', error.message);
      throw error;
    }
  }

  async scrapeTodayPrices(maxRetries = 3) {
    console.log('📊 Scraping today\'s prices...');
    console.log('⚡ Initializing browser for price scraping...');
    await this.init();

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page...`);
        const page = await this.browser.newPage();
        console.log('🔧 Setting user agent and timeouts...');
        await page.setUserAgent(this.userAgent);

        // Set longer timeouts for all page operations
        await page.setDefaultTimeout(60000);
        await page.setDefaultNavigationTimeout(60000);

        console.log('🎯 Trying CSV download method first...');
        try {
          return await this.scrapeTodayPricesCSVDownload(page);
        } catch (csvError) {
          console.log(`⚠️ CSV download method failed (attempt ${attempt}): ${csvError.message}`);
          console.log('🔄 Falling back to API capture...');

          try {
            return await this.scrapeTodayPricesAPI(page);
          } catch (apiError) {
            console.log(`⚠️ API capture failed (attempt ${attempt}): ${apiError.message}`);
            console.log('🔄 Falling back to HTML scraping...');
            return await this.scrapeTodayPricesHTML(page);
          }
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('❌ All scraping attempts failed');
    throw lastError;
  } async scrapeTodayPricesCSVDownload(page) {
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

  async scrapeAllCompanyDetails(securityIds, saveCallback = null) {
    if (!securityIds || securityIds.length === 0) return [];

    console.log(`🏢 Starting company details scrape for ${securityIds.length} companies...`);
    await this.init();
    const details = [];
    let currentBatch = [];

    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);

      let count = 0;
      for (const sec of securityIds) {
        count++;
        const { security_id, symbol } = sec;
        const url = `https://www.nepalstock.com/company/detail/${security_id}`;

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

          try {
            await page.waitForSelector('.company__title--details', { timeout: 5000 });
          } catch (e) { }

          try {
            const profileTab = await page.$('#profileTab');
            if (profileTab) {
              await profileTab.click();
              await page.waitForSelector('#profile_section', { timeout: 3000 }).catch(() => { });
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (e) { }

          let data;
          try {
            data = await page.evaluate(() => {
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

            // Process the logo image - save base64 images, ignore URLs
            const processedLogoUrl = await processImageData(data.rawLogoData, symbol);

            const item = {
              securityId: security_id,
              symbol: symbol,
              ...data,
              logoUrl: processedLogoUrl // Replace with processed URL or null
            };

            // Remove rawLogoData from the final item
            delete item.rawLogoData;

            details.push(item);
            if (saveCallback) {
              currentBatch.push(item);
            }

          } catch (evalError) {
            console.error(`❌ Failed to evaluate page for ${symbol}:`, evalError.message);
            // Continue with empty data if page evaluation fails
            data = {
              companyName: symbol,
              rawLogoData: '',
              isLogoPlaceholder: true
            };
          }
        } catch (err) {
          console.error(`❌ Failed to scrape details for ${symbol}:`, err.message);
        }

        // Save batch of 10 or when reaching end
        if (saveCallback && (currentBatch.length >= 10 || count === securityIds.length)) {
          if (currentBatch.length > 0) {
            try {
              await saveCallback(currentBatch);
              console.log(`💾 Saved batch of ${currentBatch.length} company details (${count}/${securityIds.length})`);
              currentBatch = [];
            } catch (saveErr) {
              console.error(`❌ Failed to save batch:`, saveErr.message);
              currentBatch = [];
            }
          }
        }

        if (count % 10 === 0) {
          console.log(`📊 Progress: ${count}/${securityIds.length}`);
        }
      }
    } catch (e) {
      console.error('❌ Error in company details scraping:', e);
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

  async scrapeMarketIndex() {
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

    try {
      const page = await this.browser.newPage();
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
          marketStatusTime: null
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

        // Find Total Turnover and Total Traded Shares from index__points--summary
        const summaryElement = document.querySelector('.index__points--summary');
        if (summaryElement) {
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

        return result;
      });

      await page.close();

      console.log('✅ Market index data scraped successfully');
      console.log(`📊 Index: ${indexData.nepseIndex}, Change: ${indexData.indexChange} (${indexData.indexPercentageChange}%)`);
      console.log(`💱 Turnover: ${indexData.totalTurnover}, Traded Shares: ${indexData.totalTradedShares}`);
      console.log(`📈 Advanced: ${indexData.advanced}, Declined: ${indexData.declined}, Unchanged: ${indexData.unchanged}`);

      return indexData;
    } catch (error) {
      console.error('❌ Market index scraping failed:', error.message);
      throw error;
    }
  }
}

// Export functions for backward compatibility
async function scrapeMarketStatus() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeMarketStatus();
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

// Legacy function names for compatibility
const fetchTodaysPrices = scrapeTodayPrices;

module.exports = {
  NepseScraper,
  scrapeMarketStatus,
  scrapeTodayPrices,
  scrapeAllCompanyDetails,
  fetchTodaysPrices
};