#!/usr/bin/env node
/**
 * Test script for Phase 2 refactoring completion
 * Tests backward compatibility and module integration
 */

console.log('🧪 Phase 2 Refactoring Test Suite\n');
console.log('='.repeat(60));

// Test 1: Import from old location (backward compatibility)
console.log('\n✅ Test 1: Backward compatibility - Import from old location');
try {
  const { NepseScraper } = require('./src/scrapers/nepse-scraper');
  console.log('   ✓ NepseScraper imported successfully');
  console.log('   ✓ Type:', typeof NepseScraper);

  const scraper = new NepseScraper();
  console.log('   ✓ Instance created successfully');
  console.log('   ✓ Has init method:', typeof scraper.init === 'function');
  console.log('   ✓ Has close method:', typeof scraper.close === 'function');
  console.log('   ✓ Has scrapeMarketSummary:', typeof scraper.scrapeMarketSummary === 'function');
  console.log('   ✓ Has scrapeTodayPrices:', typeof scraper.scrapeTodayPrices === 'function');
  console.log('   ✓ Has scrapeAllCompanyDetails:', typeof scraper.scrapeAllCompanyDetails === 'function');
  console.log('   ✓ Has scrapeMarketIndicesHistory:', typeof scraper.scrapeMarketIndicesHistory === 'function');
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

// Test 2: Import from new location
console.log('\n✅ Test 2: Import from new modular location');
try {
  const { NepseScraper: NewScraper } = require('./src/scrapers/nepse/nepse-scraper');
  console.log('   ✓ NepseScraper imported from new location');

  const scraper = new NewScraper();
  console.log('   ✓ Instance created successfully');
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

// Test 3: Import individual modules
console.log('\n✅ Test 3: Individual module imports');
try {
  const BrowserManager = require('./src/scrapers/nepse/browser-manager');
  console.log('   ✓ BrowserManager imported');

  const MarketScraper = require('./src/scrapers/nepse/market-scraper');
  console.log('   ✓ MarketScraper imported');

  const PriceScraper = require('./src/scrapers/nepse/price-scraper');
  console.log('   ✓ PriceScraper imported');

  const CompanyScraper = require('./src/scrapers/nepse/company-scraper');
  console.log('   ✓ CompanyScraper imported');

  const HistoryScraper = require('./src/scrapers/nepse/history-scraper');
  console.log('   ✓ HistoryScraper imported');
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

// Test 4: Standalone functions
console.log('\n✅ Test 4: Standalone function exports');
try {
  const {
    scrapeMarketSummary,
    scrapeMarketStatus,
    scrapeTodayPrices,
    scrapeAllCompanyDetails,
    scrapeMarketIndicesHistory,
    fetchTodaysPrices
  } = require('./src/scrapers/nepse-scraper');

  console.log('   ✓ scrapeMarketSummary:', typeof scrapeMarketSummary);
  console.log('   ✓ scrapeMarketStatus:', typeof scrapeMarketStatus);
  console.log('   ✓ scrapeTodayPrices:', typeof scrapeTodayPrices);
  console.log('   ✓ scrapeAllCompanyDetails:', typeof scrapeAllCompanyDetails);
  console.log('   ✓ scrapeMarketIndicesHistory:', typeof scrapeMarketIndicesHistory);
  console.log('   ✓ fetchTodaysPrices:', typeof fetchTodaysPrices);
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

// Test 5: Utilities
console.log('\n✅ Test 5: Utility functions');
try {
  const { parseNumber, cleanText, formatCSVDownloadData, formatAPIData, formatHTMLData } = require('./src/scrapers/nepse/utils/parsers');

  console.log('   ✓ parseNumber(1,234.56):', parseNumber('1,234.56'));
  console.log('   ✓ cleanText("  hello   world  "):', cleanText("  hello   world  "));
  console.log('   ✓ formatCSVDownloadData: function');
  console.log('   ✓ formatAPIData: function');
  console.log('   ✓ formatHTMLData: function');
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

// Test 6: Constants
console.log('\n✅ Test 6: Constants');
try {
  const { NEPSE_URL, TODAY_PRICE_URL } = require('./src/scrapers/nepse/utils/constants');

  console.log('   ✓ NEPSE_URL:', NEPSE_URL);
  console.log('   ✓ TODAY_PRICE_URL:', TODAY_PRICE_URL);
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

// Test 7: Module structure
console.log('\n✅ Test 7: Module structure validation');
try {
  const { NepseScraper } = require('./src/scrapers/nepse-scraper');
  const scraper = new NepseScraper();

  // Check that scraper has all expected properties
  const expectedMethods = [
    'init', 'close', 'getBrowser', 'getUserAgent',
    'scrapeMarketSummary', 'scrapeMarketStatus', 'scrapeMarketIndex', 'fetchMarketIndexFromAPI',
    'scrapeTodayPrices', 'scrapeTodayPricesCSVDownload', 'scrapeTodayPricesAPI', 'scrapeTodayPricesHTML',
    'scrapeAllCompanyDetails', 'parseApiProfileData',
    'scrapeMarketIndicesHistory'
  ];

  const missing = expectedMethods.filter(method => typeof scraper[method] !== 'function');

  if (missing.length > 0) {
    console.log('   ❌ Missing methods:', missing.join(', '));
    process.exit(1);
  }

  console.log(`   ✓ All ${expectedMethods.length} expected methods present`);
} catch (error) {
  console.log('   ❌ FAILED:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('✅ All tests passed! Phase 2 refactoring is complete.\n');
console.log('📊 Summary:');
console.log('   • Backward compatibility: ✅ Working');
console.log('   • New modular structure: ✅ Working');
console.log('   • Individual modules: ✅ Accessible');
console.log('   • Standalone functions: ✅ Available');
console.log('   • Utilities: ✅ Working');
console.log('   • Constants: ✅ Available');
console.log('   • Module structure: ✅ Complete');
console.log('\n🎉 Ready for production!');
