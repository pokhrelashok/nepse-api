
const { NepseScraper } = require('./src/scrapers/nepse-scraper');

async function main() {
  const scraper = new NepseScraper();
  try {
    console.log('Scraping Market Index...');
    const data = await scraper.scrapeMarketIndex();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

main();
