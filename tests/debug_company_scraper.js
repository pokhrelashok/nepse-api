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

    const securityId = 1; // NABIL
    const symbol = 'NABIL';
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

        // Take another screenshot
        const profileScreenshotPath = path.join(debugDir, `${symbol}_profile.png`);
        await page.screenshot({ path: profileScreenshotPath, fullPage: true });
        console.log(`📸 Profile screenshot saved: ${profileScreenshotPath}`);
      } else {
        console.log('⚠️ Profile tab not found');
      }
    } catch (err) {
      console.log(`⚠️ Error clicking profile tab: ${err.message}`);
    }

    // Extract data using page.evaluate
    console.log('\n📊 Extracting data from page...');
    const pageData = await page.evaluate(() => {
      const result = {
        title: document.title,
        companyName: '',
        sector: '',
        tables: [],
        hasIframe: false,
        selectors: {}
      };

      // Check for iframe
      const iframe = document.querySelector('#company_detail_iframe');
      result.hasIframe = !!iframe;

      // Check for company title
      const titleEl = document.querySelector('.company__title--details h1');
      if (titleEl) {
        result.companyName = titleEl.innerText.trim();
      }

      // Check for meta items
      const metaItems = document.querySelectorAll('.company__title--metas li');
      metaItems.forEach(li => {
        const text = li.innerText;
        if (text.includes('Sector:')) {
          result.sector = text.split('Sector:')[1].trim();
        }
      });

      // Find all tables
      const tables = document.querySelectorAll('table');
      result.tables = Array.from(tables).map((table, idx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
        const rowCount = table.querySelectorAll('tr').length;
        return { index: idx, headers, rowCount };
      });

      // Check for key selectors
      result.selectors = {
        companyTitle: !!document.querySelector('.company__title--details'),
        profileTab: !!document.querySelector('#profileTab'),
        profileSection: !!document.querySelector('#profile_section'),
        iframe: !!document.querySelector('#company_detail_iframe')
      };

      return result;
    });

    console.log('\n📋 Page Data:');
    console.log('─'.repeat(60));
    console.log(`Title: ${pageData.title}`);
    console.log(`Company Name: ${pageData.companyName || 'NOT FOUND'}`);
    console.log(`Sector: ${pageData.sector || 'NOT FOUND'}`);
    console.log(`Has Iframe: ${pageData.hasIframe}`);
    console.log(`\nSelectors Found:`);
    Object.entries(pageData.selectors).forEach(([key, found]) => {
      console.log(`  ${key}: ${found ? '✓' : '✗'}`);
    });
    console.log(`\nTables Found: ${pageData.tables.length}`);
    pageData.tables.forEach(table => {
      console.log(`  Table ${table.index}: ${table.rowCount} rows, Headers: ${table.headers.slice(0, 3).join(', ')}...`);
    });

    // Save API data if captured
    if (apiProfileData) {
      const apiProfilePath = path.join(debugDir, `${symbol}_api_profile.json`);
      fs.writeFileSync(apiProfilePath, JSON.stringify(apiProfileData, null, 2));
      console.log(`\n💾 API Profile data saved: ${apiProfilePath}`);
    }

    if (apiSecurityData) {
      const apiSecurityPath = path.join(debugDir, `${symbol}_api_security.json`);
      fs.writeFileSync(apiSecurityPath, JSON.stringify(apiSecurityData, null, 2));
      console.log(`💾 API Security data saved: ${apiSecurityPath}`);
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
