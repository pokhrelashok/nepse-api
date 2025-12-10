const cron = require('node-cron');
const { fetchTodaysPrices, scrapeMarketStatus, scrapeAllCompanyDetails } = require('./scraper');
const { savePrices, db, getAllSecurityIds, saveCompanyDetails } = require('./db');
const { DateTime } = require('luxon');

const FORCE_RUN = process.argv.includes('--force');
const SCRAPE_DETAILS = process.argv.includes('--scrape-details');

async function runScraper() {
  console.log(`[${new Date().toISOString()}] Starting scheduled scrape...`);

  // 1. Check market status from HTML (Strict check)
  const isOpen = await scrapeMarketStatus();
  console.log(`[Scheduler] Market Open Status: ${isOpen}`);

  if (!isOpen && !FORCE_RUN) {
    console.log('[Scheduler] Market is CLOSED. Skipping scrape.');
    // return; // Uncomment to strictly skip
    // Proceeding anyway because "Today's Price" might be available
  }

  if (!isOpen && FORCE_RUN) {
    console.log('[Scheduler] Market is CLOSED but Force Run is active. Attempting scrape anyway...');
  }

  // 2. Fetch prices
  try {
    const prices = await fetchTodaysPrices();
    if (prices.length > 0) {
      console.log(`[Scheduler] Fetched ${prices.length} prices.`);
      await savePrices(prices);

      // If FORCE_RUN, maybe we check if we should scrape details? 
      // Only if explicitly asked.
    } else {
      console.log('[Scheduler] No prices scraped (Table might be empty).');
    }
  } catch (err) {
    console.error('[Scheduler] Failed to scrape:', err);
  }
}

async function runDetailScraper() {
  console.log(`[${new Date().toISOString()}] Starting Company Details Scrape...`);
  try {
    const ids = await getAllSecurityIds();
    if (ids.length === 0) {
      console.log('[Scheduler] No securities found in DB to scrape details for.');
      return;
    }

    // Pass a callback to save in batches (incremental saving)
    await scrapeAllCompanyDetails(ids, async (batch) => {
      const today = new Date().toISOString().split('T')[0];
      batch.forEach(item => {
        if (!item.businessDate) item.businessDate = today;
      });

      // Save to BOTH tables
      // 1. Profile Data (Sector, Shares, etc.)
      await saveCompanyDetails(batch);

      // 2. Price Data (Market Cap, Trades, Prices from Detail Page)
      await savePrices(batch);
    });
    console.log('[Scheduler] Detail Scrape Completed.');
  } catch (err) {
    console.error('[Scheduler] Detail Scrape Failed:', err);
  }
}

// Main CLI Handler
if (FORCE_RUN) {
  console.log('[Scheduler] Force run initiated...');
  runScraper();
}

if (SCRAPE_DETAILS) {
  console.log('[Scheduler] Detail Scraping initiated...');
  runDetailScraper();
}

// Schedule 1: Price Scrape (Sun-Thu 10-15)
cron.schedule('*/5 10-15 * * 0-4', () => {
  runScraper();
}, { timezone: "Asia/Kathmandu" });

// Schedule 2: Company Details Scrape (Daily at 10:00 AM)
cron.schedule('0 10 * * 0-4', () => {
  runDetailScraper();
}, { timezone: "Asia/Kathmandu" });

console.log('[Scheduler] Service started.');
console.log(' - Price Scrape: */5 10-15 * * 0-4');
console.log(' - Detail Scrape: 0 10 * * 0-4');
