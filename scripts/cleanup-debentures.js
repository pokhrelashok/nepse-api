#!/usr/bin/env node

/**
 * Cleanup script to fix Debenture and Bond company names in production.
 * Identifies all debentures/bonds in the database and re-scrapes them to get the correct specific name.
 */

const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');
const { pool, saveCompanyDetails } = require('../src/database/database');
const { formatCompanyDetailsForDatabase } = require('../src/utils/formatter');

async function cleanupDebentures() {
  console.log('🧹 Starting cleanup for Debentures and Bonds...\n');

  const scraper = new NepseScraper();
  await scraper.init();

  try {
    // 1. Identify all debentures and bonds in the database
    console.log('🔍 Finding debentures/bonds in database...');
    const [securities] = await pool.execute(
      "SELECT security_id, symbol, company_name FROM company_details WHERE instrument_type LIKE '%Debenture%' OR instrument_type LIKE '%Bond%'"
    );

    console.log(`✅ Found ${securities.length} debentures/bonds to fix.\n`);

    if (securities.length === 0) {
      console.log('✨ No debentures/bonds found to clean up.');
      return;
    }

    // 2. Map DB keys to scraper expected keys
    const securityIds = securities.map(s => ({
      security_id: s.security_id,
      symbol: s.symbol
    }));

    // 3. Re-scrape all identified securities
    console.log('🚀 Starting re-scrape for debentures/bonds...');
    const results = await scraper.scrapeAllCompanyDetails(
      securityIds,
      async (dataArray) => {
        // The scraper calls this for each company it saves
        for (const item of dataArray) {
          const formatted = formatCompanyDetailsForDatabase([item]);
          await saveCompanyDetails(formatted);
          console.log(`✅ Fixed: ${item.symbol} -> ${item.company_name}`);
        }
      }
    );

    console.log(`\n🎉 Successfully cleaned up debenture/bond records.`);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await scraper.close();
    await pool.end();
  }
}

cleanupDebentures().catch(console.error);
