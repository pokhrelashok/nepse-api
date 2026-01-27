const BrowserManager = require('../src/scrapers/nepse/browser-manager');
const fs = require('fs');
const path = require('path');

async function debugSip() {
  console.log('Starting SIP debug scraper...');
  // Initialize browser in HEADFUL mode to see what happens
  const browserManager = new BrowserManager({ headless: false });

  try {
    await browserManager.init();
    const browser = browserManager.getBrowser();
    const page = await browser.newPage();

    // Set viewport to a reasonable size
    await page.setViewport({ width: 1366, height: 768 });

    // Log requests to find API
    const apiRequests = [];
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const rType = req.resourceType();
      if (['xhr', 'fetch'].includes(rType)) {
        // console.log(`REQ: ${req.url()}`);
        apiRequests.push({
          url: req.url(),
          method: req.method(),
          headers: req.headers()
        });
      }
      if (['image', 'media', 'font'].includes(rType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('nepsealpha') && res.request().resourceType() === 'xhr') {
        try {
          console.log(`Possible API Response: ${url}`);
        } catch (e) { }
      }
    });

    const url = 'https://nepsealpha.com/sip-in-nepal';
    console.log(`Navigating to ${url}...`);

    // Navigate
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Page loaded. Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Capture HTML
    const content = await page.content();
    const outputPath = path.resolve('tmp/sip-page.html');

    // Ensure tmp dir exists
    if (!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp');
    }

    fs.writeFileSync(outputPath, content);
    console.log(`Saved HTML to ${outputPath}`);

    // Dump API requests found
    const apiLogPath = path.resolve('tmp/sip-api-logs.json');
    fs.writeFileSync(apiLogPath, JSON.stringify(apiRequests, null, 2));
    console.log(`Saved API logs to ${apiLogPath}`);

  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    console.log('Closing browser...');
    await browserManager.close();
  }
}

debugSip();
