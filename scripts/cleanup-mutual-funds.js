#!/usr/bin/env node

/**
 * Cleanup script to fix mutual fund company names and sectors in production.
 * Identifies all mutual funds in the database and re-scrapes them using the fixed scraper.
 */

const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');
const { pool, saveCompanyDetails } = require('../src/database/database');
const { formatCompanyDetailsForDatabase } = require('../src/utils/formatter');

async function cleanupMutualFunds() {
  console.log('🧹 Starting cleanup for Mutual Funds...\n');

  const scraper = new NepseScraper();
  await scraper.init();

  try {
    // 1. Identify all mutual funds in the database
    console.log('🔍 Finding mutual funds in database...');
    const [mutualFunds] = await pool.execute(
      "SELECT security_id, symbol FROM company_details WHERE instrument_type LIKE '%Mutual%'"
    );

    console.log(`✅ Found ${mutualFunds.length} mutual funds to fix.\n`);

    if (mutualFunds.length === 0) {
      console.log('✨ No mutual funds found to clean up.');
      return;
    }

    // 2. Map DB keys to scraper expected keys
    const securityIds = mutualFunds.map(mf => ({
      security_id: mf.security_id,
      symbol: mf.symbol
    }));

    // 3. Re-scrape all identified mutual funds
    console.log('🚀 Starting re-scrape for mutual funds...');
    const results = await scraper.scrapeAllCompanyDetails(
      securityIds,
      async (dataArray) => {
        // The scraper calls this for each company it saves
        // We'll use our own update logic to be sure it's applied
        for (const item of dataArray) {
          const formatted = formatCompanyDetailsForDatabase([item]);
          await saveCompanyDetails(formatted);
          console.log(`✅ Fixed: ${item.symbol} -> ${item.company_name} [${item.sector_name}]`);
        }
      }
    );

    console.log(`\n🎉 Successfully cleaned up mutual fund records.`);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await scraper.close();
    await pool.end();
  }
}

cleanupMutualFunds().catch(console.error);
