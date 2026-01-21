const logger = require('../../utils/logger');
const { saveMutualFundNavs, pool } = require('../../database/database');
const { parseNumber } = require('./utils/parsers');

/**
 * Mutual Fund Scraper - Scrapes weekly/monthly NAVs from ShareSansar
 */
class MutualFundScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.url = 'https://www.sharesansar.com/mutual-fund-navs';
  }

  async scrape() {
    console.log('📈 Starting Mutual Fund NAV scrape from ShareSansar (via interception)...');
    await this.browserManager.init();
    const browser = this.browserManager.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent(this.browserManager.getUserAgent());

      const allFetchedData = [];

      // Intercept responses
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('mutual-fund-navs') && response.headers()['content-type']?.includes('application/json')) {
          try {
            const data = await response.json();
            if (data && data.data && Array.isArray(data.data)) {
              // Extract type from URL params (default to -1 if missing)
              const urlParams = new URL(url).searchParams;
              const type = parseInt(urlParams.get('type') || '-1', 10);

              console.log(`📡 Intercepted ${data.data.length} records from ${url} (Type: ${type})`);

              const typedData = data.data.map(item => ({
                ...item,
                fundType: type
              }));
              allFetchedData.push(...typedData);
            }
          } catch (e) {
            // Silently ignore non-JSON or other errors
          }
        }
      });

      const processTab = async (tabHash, tableId) => {
        console.log(`�️ Processing tab: ${tabHash}...`);
        const tab = await page.$(`a[href="${tabHash}"]`);
        if (tab) {
          await tab.click();
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Try to select "50" entries to get all records in one go if available
          try {
            const lengthSelector = `select[name="${tableId}_length"]`;
            const hasSelector = await page.$(lengthSelector);
            if (hasSelector) {
              await page.select(lengthSelector, '50');
              console.log(`📏 Set length to 50 entries for ${tableId}`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (e) {
            console.warn(`⚠️ Could not set length for ${tableId}: ${e.message}`);
          }
        }
      };

      // 1. Navigate to page
      console.log('🔗 Navigating to ShareSansar...');
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 2. Process each tab systematically
      await processTab('#closed', 'myTableC');
      await processTab('#matured', 'myTableM');
      await processTab('#opened', 'myTableO');

      if (allFetchedData.length === 0) {
        // Fallback: If interception failed, try manual fetch with correct params
        console.warn('⚠️ Interception yielded 0 records, trying manual fetch fallback...');
        const fundTypes = [-1, 1, 2]; // All 3 types: Close End, Matured, Open End
        for (const type of fundTypes) {
          const fetchUrl = `${this.url}?draw=10&start=0&length=500&type=${type}`;
          const data = await page.evaluate(async (url) => {
            try {
              const response = await fetch(url, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
              });
              return await response.json();
            } catch (err) { return { error: err.message }; }
          }, fetchUrl);
          if (data.data) allFetchedData.push(...data.data);
        }
      }

      console.log(`✅ Total fetched ${allFetchedData.length} records.`);

      if (allFetchedData.length === 0) {
        throw new Error('No mutual fund data captured.');
      }

      // Deduplicate by symbol but prefer Matured status if conflict (unlikely)
      const uniqueDataMap = new Map();
      allFetchedData.forEach(item => {
        if (!uniqueDataMap.has(item.symbol) || item.fundType === 1) {
          uniqueDataMap.set(item.symbol, item);
        }
      });
      const uniqueData = Array.from(uniqueDataMap.values());

      console.log(`✅ Unique records: ${uniqueData.length}`);
      console.log(`📋 Captured Symbols: ${uniqueData.map(d => d.symbol).join(', ')}`);

      const navData = [];
      const maturityUpdates = [];

      // Get all symbols from database
      const [companies] = await pool.execute('SELECT security_id, symbol FROM company_details');
      const symbolMap = new Map();
      companies.forEach(c => symbolMap.set(c.symbol.trim().toUpperCase(), c.security_id));

      let matchedCount = 0;
      let skippedCount = 0;
      const skippedSymbols = [];

      for (const item of uniqueData) {
        const symbol = item.symbol ? item.symbol.trim().toUpperCase() : null;
        if (!symbol) {
          skippedCount++;
          continue;
        }

        const securityId = symbolMap.get(symbol);
        if (!securityId) {
          skippedCount++;
          skippedSymbols.push(symbol);
          continue;
        }

        matchedCount++;
        navData.push({
          security_id: securityId,
          weekly_nav_price: parseNumber(item.weekly_nav_price),
          weekly_date: item.weekly_date,
          monthly_nav_price: parseNumber(item.monthly_nav_price),
          monthly_date: item.monthly_date
        });

        // Map type to status: 1 = Matured ('M'), Others = Active ('A')
        const status = item.fundType === 1 ? 'M' : 'A';

        maturityUpdates.push({
          security_id: securityId,
          maturity_date: item.maturity_date,
          maturity_period: item.maturity_period,
          status: status
        });
      }

      console.log(`📊 Scrape Stats: Matched: ${matchedCount}, Skipped: ${skippedCount}`);
      if (skippedSymbols.length > 0) {
        // console.log(`⚠️ Skipped Symbols: ${skippedSymbols.join(', ')}`);
      }

      // Save NAV data
      if (navData.length > 0) {
        await saveMutualFundNavs(navData);

        // Update maturity and status info
        for (const up of maturityUpdates) {
          await pool.execute(
            'UPDATE company_details SET maturity_date = ?, maturity_period = ?, status = ? WHERE security_id = ?',
            [up.maturity_date || null, up.maturity_period || null, up.status, up.security_id]
          );
        }

        console.log(`💾 Successfully updated ${navData.length} mutual funds.`);
      }

      return navData;

    } catch (error) {
      logger.error(`❌ Mutual Fund Scraper Error: ${error.message}`);
      throw error;
    } finally {
      await page.close();
    }
  }
}

module.exports = MutualFundScraper;
