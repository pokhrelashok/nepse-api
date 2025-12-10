const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function downloadHTML(url, filename = 'page.html') {
  console.log(`[HTML Downloader] Downloading: ${url}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  try {
    const page = await browser.newPage();

    // Don't block resources for inspection - we need all resources for JS to work properly
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('[HTML Downloader] Navigating to page...');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for the main content to load
    console.log('[HTML Downloader] Waiting for company details to load...');
    await page.waitForSelector('.company__title--details', { timeout: 10000 }).catch(() => { });

    // Click on Profile tab to load the actual logo
    console.log('[HTML Downloader] Activating Profile tab...');
    try {
      const profileTab = await page.$('#profileTab');
      if (profileTab) {
        await profileTab.click();
        // Wait for profile content to load
        await page.waitForSelector('#profile_section', { timeout: 5000 }).catch(() => { });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {
      console.log('[HTML Downloader] Could not click profile tab:', e.message);
    }

    // Wait additional time for any remaining dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the full HTML after all content has loaded
    const html = await page.content();    // Create downloads directory if it doesn't exist
    const downloadsDir = path.join(__dirname, 'downloads');
    try {
      await fs.mkdir(downloadsDir, { recursive: true });
    } catch (e) {
      // Directory exists
    }

    // Save HTML file
    const filePath = path.join(downloadsDir, filename);
    await fs.writeFile(filePath, html, 'utf8');

    console.log(`[HTML Downloader] HTML saved to: ${filePath}`);

    // Also take a screenshot for visual inspection
    const screenshotPath = path.join(downloadsDir, filename.replace('.html', '.png'));
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    console.log(`[HTML Downloader] Screenshot saved to: ${screenshotPath}`);

    return { html, filePath, screenshotPath };

  } catch (error) {
    console.error('[HTML Downloader] Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Function to download multiple sample company pages
async function downloadSamplePages() {
  // Sample company IDs - you can modify these
  const sampleCompanies = [
    { id: 141, name: 'nabil' },        // Commercial Bank
    { id: 138, name: 'nic' },          // Commercial Bank  
    { id: 259, name: 'microfinance' }, // Finance Company
    { id: 315, name: 'hydropower' },   // Hydropower (if exists)
    { id: 200, name: 'insurance' }     // Insurance (if exists)
  ];

  for (const company of sampleCompanies) {
    try {
      const url = `https://www.nepalstock.com/company/detail/${company.id}`;
      const filename = `company_${company.name}_${company.id}.html`;

      await downloadHTML(url, filename);

      // Wait between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`Failed to download ${company.name}:`, error.message);
    }
  }
}

module.exports = { downloadHTML, downloadSamplePages };

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node html_downloader.js <url> [filename]');
    console.log('Or: node html_downloader.js --samples (to download sample pages)');
    process.exit(1);
  }

  if (args[0] === '--samples') {
    downloadSamplePages().catch(console.error);
  } else {
    const url = args[0];
    const filename = args[1] || 'page.html';
    downloadHTML(url, filename).catch(console.error);
  }
}