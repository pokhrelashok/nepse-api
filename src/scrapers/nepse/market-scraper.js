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

  async fetchMarketIndexFromAPI() {
    console.log('🔌 Attempting to fetch market index from NEPSE API...');

    const API_URL = 'https://nepalstock.com.np/api/nots/nepse-index';

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'User-Agent': this.browserManager.getUserAgent(),
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

    try {
      const apiData = await this.fetchMarketIndexFromAPI();
      if (apiData && apiData.nepseIndex > 0) {
        console.log('✅ Market index fetched from API successfully');
        return apiData;
      }
    } catch (apiError) {
      console.log('⚠️ API fetch failed, falling back to scraping:', apiError.message);
    }

    console.log('⚡ Initializing browser for market index scrape...');
    await this.browserManager.init();

    const browser = this.browserManager.getBrowser();
    const userAgent = this.browserManager.getUserAgent();
    let lastError;
    let page = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!browser || !browser.isConnected()) {
          console.log('♻️ Browser invalid or disconnected, re-initializing...');
          await this.browserManager.init();
        }

        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Creating new page for market index...`);
        page = await browser.newPage();

        await new Promise(resolve => setTimeout(resolve, 500));

        await page.setUserAgent(userAgent);
        await page.setCacheEnabled(false);

        const cacheBuster = `?_=${Date.now()}`;
        const url = `${NEPSE_URL}${cacheBuster}`;

        console.log('🌐 Navigating to NEPSE homepage (cache disabled)...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('✅ Page loaded successfully');

        await page.waitForSelector('[class*="market-index"], [class*="nepse-index"], .index-section, [class*="index"]', { timeout: 10000 }).catch(() => {
          console.log('⚠️ Could not find market index selector, continuing with page evaluation');
        });

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
            marketStatus: 'CLOSED'
          };

          const parseNumber = (text) => {
            if (!text) return 0;
            const num = parseFloat(text.replace(/,/g, '').replace(/[^\d.-]/g, ''));
            return isNaN(num) ? 0 : num;
          };

          const pageText = document.body.innerText;
          const dateTimeMatch = pageText.match(/([A-Za-z]+\s+\d{1,2})\s*\|\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
          if (dateTimeMatch) {
            result.marketStatusDate = dateTimeMatch[1].trim();
            result.marketStatusTime = dateTimeMatch[2].trim();
          }

          const indexPointElement = document.querySelector('.index__points--point, span.index__points--point');
          if (indexPointElement) {
            result.nepseIndex = parseNumber(indexPointElement.textContent || indexPointElement.innerText);
          }

          const indexChangeElement = document.querySelector('.index__points--change, span.index__points--change');
          if (indexChangeElement) {
            result.indexChange = parseNumber(indexChangeElement.textContent || indexChangeElement.innerText);
          }

          const indexPercentElement = document.querySelector('.index__points--changepercent, span.index__points--changepercent');
          if (indexPercentElement) {
            result.indexPercentageChange = parseNumber(indexPercentElement.textContent || indexPercentElement.innerText);
          }

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

          if (result.nepseIndex === 0) {
            const indexMatch = pageText.match(/NEPSE.*?Index[:\s]+([0-9,]+\.?[0-9]*)/i);
            if (indexMatch) {
              result.nepseIndex = parseNumber(indexMatch[1]);
            } else {
              const largeNumbers = pageText.match(/\b([2-9]\d{3,4}\.\d+)\b/g);
              if (largeNumbers && largeNumbers.length > 0) {
                result.nepseIndex = parseNumber(largeNumbers[0]);
              }
            }
          }

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

          if (result.indexPercentageChange === 0) {
            const percentMatch = document.body.innerText.match(/([-+]?\s*[0-9,]+\.?[0-9]*)%/);
            if (percentMatch) {
              result.indexPercentageChange = parseNumber(percentMatch[1]);
            }
          }

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

          const summaryElement = document.querySelector('.index__points--summary');
          if (summaryElement && result.totalTurnover === 0) {
            const summarySpans = summaryElement.querySelectorAll('span');
            summarySpans.forEach(span => {
              const text = span.textContent || span.innerText;
              if (text.includes('Total Turnover')) {
                const turnoverMatch = text.match(/Total Turnover\s*Rs[:\s]*\|?\s*([0-9,]+\.?[0-9]*)/i);
                if (turnoverMatch) {
                  result.totalTurnover = parseNumber(turnoverMatch[1]);
                }
              }
              if (text.includes('Total Traded Shares')) {
                const sharesMatch = text.match(/Total Traded Shares\s*\|?\s*([0-9,]+)/i);
                if (sharesMatch) {
                  result.totalTradedShares = parseNumber(sharesMatch[1]);
                }
              }
            });
          }

          if (result.totalTurnover === 0) {
            const turnoverMatch = document.body.innerText.match(/Total Turnover\s*Rs[:\s]*\|?\s*([0-9,]+\.?[0-9]*)/i);
            if (turnoverMatch) {
              result.totalTurnover = parseNumber(turnoverMatch[1]);
            }
          }

          if (result.totalTradedShares === 0) {
            const sharesMatch = document.body.innerText.match(/Total Traded Shares\s*\|?\s*([0-9,]+)/i);
            if (sharesMatch) {
              result.totalTradedShares = parseNumber(sharesMatch[1]);
            }
          }

          const statsMatch = document.body.innerText.match(/Advanced\s*(\d+)[\s\S]*?Declined\s*(\d+)[\s\S]*?Unchanged\s*(\d+)/i);
          if (statsMatch) {
            result.advanced = parseInt(statsMatch[1], 10);
            result.declined = parseInt(statsMatch[2], 10);
            result.unchanged = parseInt(statsMatch[3], 10);
          } else {
            const altMatch = document.body.innerText.match(/Advanced\s*(\d+)/i);
            const decMatch = document.body.innerText.match(/Declined\s*(\d+)/i);
            const uncMatch = document.body.innerText.match(/Unchanged\s*(\d+)/i);

            if (altMatch) result.advanced = parseInt(altMatch[1], 10);
            if (decMatch) result.declined = parseInt(decMatch[1], 10);
            if (uncMatch) result.unchanged = parseInt(uncMatch[1], 10);
          }

          const pageTextUpper = pageText.toUpperCase();

          const isPreOpen = pageTextUpper.includes('PRE OPEN') ||
            pageTextUpper.includes('PRE-OPEN') ||
            pageTextUpper.includes('PREOPEN') ||
            /PRE[- ]?OPEN/i.test(pageText);

          const isOpen = pageTextUpper.includes('MARKET OPEN') ||
            pageTextUpper.includes('LIVE MARKET') ||
            pageTextUpper.includes('MARKETOPEN') ||
            pageTextUpper.includes('LIVEMARKET');

          const isClosed = pageTextUpper.includes('MARKET CLOSED') ||
            pageTextUpper.includes('MARKET CLOSE') ||
            pageTextUpper.includes('MARKETCLOSED');

          if (isPreOpen && !isClosed) {
            result.marketStatus = 'PRE_OPEN';
          } else if (isOpen && !isClosed && !isPreOpen) {
            result.marketStatus = 'OPEN';
          } else if (isClosed) {
            result.marketStatus = 'CLOSED';
          } else {
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

        if (error.message.includes('createTarget') ||
          error.message.includes('Protocol error') ||
          error.message.includes('Browser disconnected') ||
          error.message.includes('Navigating frame was detached') ||
          error.message.includes('not an object')) {
          console.log('⚠️ Browser appears unstable, closing instance...');
          await this.browserManager.close();
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
}

module.exports = MarketScraper;
