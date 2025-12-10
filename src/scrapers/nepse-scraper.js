const puppeteer = require('puppeteer');
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
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
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
    await this.init();

    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);

      await page.goto(NEPSE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

      try {
        await page.waitForSelector('body', { timeout: 10000 });
        const bodyText = await page.evaluate(() => document.body.innerText);

        const isOpen = bodyText.includes('Market Open') || bodyText.match(/Market Status[:\s]*OPEN/i);
        const isClosed = bodyText.includes('Market Closed') || bodyText.match(/Market Status[:\s]*CLOSED/i);

        if (isOpen) return true;
        if (isClosed) return false;

        // Fallback: time-based check
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

  async scrapeTodayPrices() {
    console.log('📊 Scraping today\'s prices...');
    await this.init();

    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);

      // Try API capture first (fastest method)
      try {
        return await this.scrapeTodayPricesAPI(page);
      } catch (apiError) {
        console.log('⚠️ API capture failed, falling back to HTML scraping...');
        return await this.scrapeTodayPricesHTML(page);
      }
    } catch (error) {
      console.error('❌ All scraping methods failed:', error.message);
      throw error;
    }
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
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for page to load and API calls
    await page.waitForFunction(() => {
      return document.querySelector('table') ||
        document.querySelector('[class*=\"table\"]') ||
        document.querySelector('[class*=\"grid\"]');
    }, { timeout: 30000 });

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
        waitUntil: 'networkidle2',
        timeout: 30000
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

  async scrapeAllCompanyDetails(securityIds, batchCallback = null) {
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
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

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

          const data = await page.evaluate(() => {
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
            info.logoUrl = logoImg ? logoImg.getAttribute('src') : '';
            if (info.logoUrl && info.logoUrl.startsWith('assets/')) {
              info.logoUrl = `https://www.nepalstock.com/${info.logoUrl}`;
            }
            info.isLogoPlaceholder = info.logoUrl.includes('placeholder');

            const companyNameEl = document.querySelector('.company__title--details h1');
            info.companyName = companyNameEl ? clean(companyNameEl.innerText) : '';

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

          const item = { securityId: security_id, symbol: symbol, ...data };
          details.push(item);
          if (currentBatch) currentBatch.push(item);

        } catch (err) {
          console.error(`❌ Failed to scrape details for ${symbol}:`, err.message);
        }

        if (count % 10 === 0) {
          console.log(`📊 Progress: ${count}/${securityIds.length}`);
          if (batchCallback && currentBatch && currentBatch.length > 0) {
            await batchCallback(currentBatch);
            currentBatch = [];
          }
        }
      }

      if (batchCallback && currentBatch && currentBatch.length > 0) {
        await batchCallback(currentBatch);
      }

    } catch (e) {
      console.error('❌ Error in company details scraping:', e);
    }

    return details;
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

async function scrapeAllCompanyDetails(securityIds, batchCallback = null) {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeAllCompanyDetails(securityIds, batchCallback);
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