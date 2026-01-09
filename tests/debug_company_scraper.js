/**
 * Debug Company Scraper
 * Captures HTML and screenshots to diagnose scraping issues
 */

const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');
const fs = require('fs');
const path = require('path');

async function debugCompanyScraper() {
  console.log('🐛 Debugging Company Details Scraper...\n');

  const scraper = new NepseScraper();
  const debugDir = path.join(__dirname, '../debug_output');

  // Create debug directory
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  try {
    await scraper.init();
    const browser = scraper.getBrowser();
    const userAgent = scraper.getUserAgent();

    const securityId = 133; // Updated ID
    const symbol = 'ADHS'; // Let's see what 133 is, usually it's a specific company. I'll just label it TEST_133 for now or try to be accurate if I can.
    const url = `https://www.nepalstock.com/company/detail/${securityId}`;

    console.log(`📊 Testing scraper for: ${symbol} (ID: ${securityId})`);
    console.log(`🌐 URL: ${url}\n`);

    const page = await browser.newPage();
    await page.setUserAgent(userAgent);

    console.log('🔄 Navigating to company page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    const screenshotPath = path.join(debugDir, `${symbol}_page.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Save HTML
    const htmlPath = path.join(debugDir, `${symbol}_page.html`);
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);
    console.log(`💾 HTML saved: ${htmlPath}`);

    // Check for API responses
    console.log('\n🔍 Checking for API responses...');
    let apiProfileData = null;
    let apiSecurityData = null;

    const responseHandler = async (response) => {
      const responseUrl = response.url();

      if (responseUrl.includes('/api/nots/security/') && responseUrl.includes(`/${securityId}`)) {
        console.log(`📡 API Response: ${response.status()} ${responseUrl}`);

        try {
          const data = await response.json();
          if (responseUrl.includes('/profile/')) {
            apiProfileData = data;
            console.log('✅ Profile API data captured');
          } else {
            apiSecurityData = data;
            console.log('✅ Security API data captured');
          }
        } catch (e) {
          console.log(`⚠️ Failed to parse API response: ${e.message}`);
        }
      }
    };

    page.on('response', responseHandler);

    // Try clicking profile tab
    console.log('\n🖱️ Attempting to click profile tab...');
    try {
      const profileTab = await page.$('#profileTab');
      if (profileTab) {
        await page.evaluate(el => el.click(), profileTab);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Profile tab clicked');
      } else {
        console.log('⚠️ Profile tab not found');
      }
    } catch (err) {
      console.log(`⚠️ Error clicking profile tab: ${err.message}`);
    }

    // Try clicking dividend tab
    console.log('\n💰 Attempting to click dividend tab...');
    try {
      const dividendTab = await page.$('#dividendTab');
      if (dividendTab) {
        await page.evaluate(el => el.click(), dividendTab);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Dividend tab clicked');

        const hasRows = await page.evaluate(() => document.querySelectorAll('#dividend table tbody tr').length > 0);
        console.log(`📊 Dividend rows found: ${await page.evaluate(() => document.querySelectorAll('#dividend table tbody tr').length)}`);
      } else {
        console.log('⚠️ Dividend tab not found');
      }
    } catch (err) {
      console.log(`⚠️ Error clicking dividend tab: ${err.message}`);
    }

    // Try clicking financial tab
    console.log('\n📈 Attempting to click financial tab...');
    try {
      let financialTab = await page.$('#financialTab, #financialsTab');
      if (financialTab) {
        await page.evaluate(el => el.click(), financialTab);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Financial tab clicked');
        console.log(`📊 Financial rows found: ${await page.evaluate(() => document.querySelectorAll('div[id*="financial"] table tbody tr').length)}`);
      } else {
        console.log('⚠️ Financial tab not found');
      }
    } catch (err) {
      console.log(`⚠️ Error clicking financial tab: ${err.message}`);
    }

    // Extract data using page.evaluate again after clicking all tabs
    console.log('\n📊 Final data extraction...');
    const tablesInfo = await page.evaluate(() => {
      const results = {};

      const dividendTable = document.querySelector('#dividend table');
      if (dividendTable) {
        results.dividend = {
          headers: Array.from(dividendTable.querySelectorAll('thead th')).map(th => th.innerText.trim()),
          rows: Array.from(dividendTable.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
          )
        };
      }

      const financialTable = document.querySelector('div[id*="financial"] table');
      if (financialTable) {
        results.financial = {
          headers: Array.from(financialTable.querySelectorAll('thead th')).map(th => th.innerText.trim()),
          rows: Array.from(financialTable.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
          )
        };
      }

      return results;
    });

    if (tablesInfo.dividend) {
      console.log(`\n💰 Dividend Table (${tablesInfo.dividend.rows.length} rows):`);
      console.log('Headers:', tablesInfo.dividend.headers.join(' | '));
      tablesInfo.dividend.rows.slice(0, 3).forEach(row => console.log('Row:', row.join(' | ')));
    }

    if (tablesInfo.financial) {
      console.log(`\n📈 Financial Table (${tablesInfo.financial.rows.length} rows):`);
      console.log('Headers:', tablesInfo.financial.headers.join(' | '));
      tablesInfo.financial.rows.slice(0, 3).forEach(row => console.log('Row:', row.join(' | ')));
    }

    await page.close();

    console.log('\n✅ Debug session completed!');
    console.log(`📁 Debug files saved to: ${debugDir}`);

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

// Run the debug
debugCompanyScraper();
