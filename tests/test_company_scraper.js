/**
 * Test Company Details Scraper
 * Tests the company scraper with a single symbol to verify fallback logic
 */

const { NepseScraper } = require('../src/scrapers/nepse/nepse-scraper');
const { saveCompanyDetails, saveDividends, saveFinancials } = require('../src/database/database');

async function testCompanyScraper() {
  console.log('🧪 Testing Company Details Scraper...\n');

  const scraper = new NepseScraper();

  try {
    // Test with a single company (NABIL - Nabil Bank Limited)
    const testSecurities = [
      { security_id: 131, symbol: 'NABIL' }
    ];

    console.log('📊 Scraping company details for:', testSecurities[0].symbol);
    console.log('─'.repeat(60));

    const results = await scraper.scrapeAllCompanyDetails(
      testSecurities,
      saveCompanyDetails,
      saveDividends,
      saveFinancials
    );

    if (results && results.length > 0) {
      const company = results[0];

      console.log('\n✅ Scraping completed successfully!\n');
      console.log('Company Details:');
      console.log('─'.repeat(60));
      console.log(`Symbol:              ${company.symbol}`);
      console.log(`Company Name:        ${company.companyName}`);
      console.log(`Sector:              ${company.sectorName}`);
      console.log(`Status:              ${company.status}`);
      console.log('\nPrice Information:');
      console.log('─'.repeat(60));
      console.log(`Last Traded Price:   ${company.lastTradedPrice}`);
      console.log(`Close Price:         ${company.closePrice} ${company.closePrice === 0 ? '⚠️ ZERO!' : '✓'}`);
      console.log(`Open Price:          ${company.openPrice}`);
      console.log(`High Price:          ${company.highPrice}`);
      console.log(`Low Price:           ${company.lowPrice}`);
      console.log(`Previous Close:      ${company.previousClose}`);
      console.log(`52 Week High:        ${company.fiftyTwoWeekHigh}`);
      console.log(`52 Week Low:         ${company.fiftyTwoWeekLow}`);
      console.log('\nFinancial Metrics:');
      console.log('─'.repeat(60));
      console.log(`Market Cap:          ${company.market_capitalization || 'N/A'}`);
      console.log(`P/E Ratio:           ${company.pe_ratio || 'N/A'}`);
      console.log(`P/B Ratio:           ${company.pb_ratio || 'N/A'}`);
      console.log(`EPS:                 ${company.eps || 'N/A'}`);
      console.log(`Dividend Yield:      ${company.dividend_yield || 'N/A'}%`);
      console.log('\nOther Details:');
      console.log('─'.repeat(60));
      console.log(`Total Listed Shares: ${company.totalListedShares}`);
      console.log(`Total Traded Qty:    ${company.totalTradedQuantity}`);
      console.log(`Logo URL:            ${company.logoUrl}`);
      console.log(`Is Placeholder:      ${company.isLogoPlaceholder}`);

      // Verify the fallback logic worked
      console.log('\n🔍 Fallback Logic Verification:');
      console.log('─'.repeat(60));
      if (company.closePrice === 0 && company.lastTradedPrice > 0) {
        console.log('❌ FAILED: closePrice is 0 but lastTradedPrice is', company.lastTradedPrice);
        console.log('   The fallback logic did NOT work correctly!');
        process.exit(1);
      } else if (company.closePrice > 0) {
        console.log('✅ PASSED: closePrice is populated:', company.closePrice);
        if (company.lastTradedPrice > 0 && company.closePrice === company.lastTradedPrice) {
          console.log('   (Fallback was used - closePrice matched lastTradedPrice)');
        }
      } else {
        console.log('⚠️  WARNING: Both closePrice and lastTradedPrice are 0');
        console.log('   This might be expected if the stock has not traded today');
      }

      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    } else {
      console.error('❌ No results returned from scraper');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

// Run the test
testCompanyScraper();
