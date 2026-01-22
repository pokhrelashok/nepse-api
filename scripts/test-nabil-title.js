const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');

async function testNabil() {
  const scraper = new NepseScraper();
  await scraper.init();

  try {
    // NABIL Bank ID = 131
    const securityId = 131;
    const symbol = 'NABIL';

    console.log(`Testing scrape for ${symbol} (ID: ${securityId})`);

    await scraper.scrapeAllCompanyDetails(
      [{ security_id: securityId, symbol: symbol }],
      async (dataArray) => {
        const item = dataArray[0];
        console.log('--- Scrape Result ---');
        console.log('Symbol:', item.symbol);
        console.log('Company Name (Final):', item.company_name);

        // We can't see the internal `titleFromDom` vs `profileData.companyName` directly here
        // without logging it inside the class.
        // However, if the Final name matches "Nabil Bank Limited", it means `titleFromDom` was likely correct 
        // OR the fallback worked. 
        // To be 100% sure, I will temporarily add a log in the scraper OR relying on the fact that 
        // the user wants to know if `titleFromDom` is GOOD.
        // If the result is "Nabil Bank Limited", then using `titleFromDom` is safe.
      }
    );

  } catch (err) {
    console.error(err);
  } finally {
    await scraper.close();
  }
}

testNabil();
