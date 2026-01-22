const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');

async function testScraper() {
  const scraper = new NepseScraper();
  await scraper.init();

  try {
    // GBILD84/85 - Global IME Bank Debenture
    // Using a known security ID for a debenture. 
    // From first screenshot: GIBL debenture. 
    // I need a security_id. I'll pick one from the output of check-debentures.js earlier if possible, 
    // or just search for one. 
    // Wait, check-debentures output had: [SAND2085] ...
    // I need the security_id for SAND2085 or similar.
    // I'll query it first.

    // Actually, I can just use scraping with the ID if I have it.
    // Let's query one ID first.

    const { pool } = require('../src/database/database');
    const [rows] = await pool.execute("SELECT security_id, symbol FROM company_details WHERE symbol='GBILD84/85' OR instrument_type LIKE '%Debenture%' LIMIT 1");

    if (rows.length === 0) {
      console.log("No debenture found to test.");
      return;
    }

    const target = rows[0];
    console.log(`Testing scrape for ${target.symbol} (ID: ${target.security_id})`);

    await scraper.scrapeAllCompanyDetails(
      [{ security_id: target.security_id, symbol: target.symbol }],
      async (dataArray) => {
        const item = dataArray[0];
        console.log('--- Scrape Result ---');
        console.log('Symbol:', item.symbol);
        console.log('Company Name (Result):', item.company_name);
        // We can't easily see internal variables here, but seeing the result is enough.
        // If it comes back as "Global IME Bank Limited" (parent), then bug confirmed.
        // If "Global IME Bank Debenture...", then ???
      }
    );

  } catch (err) {
    console.error(err);
  } finally {
    await scraper.close();
    // process.exit();
  }
}

testScraper();
