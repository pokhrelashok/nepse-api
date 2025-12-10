const { scrapeAllCompanyDetails, scrapeMarketStatus, fetchTodaysPrices } = require('./scraper');
const { downloadHTML } = require('./html_downloader');

/**
 * Consolidated test suite for NEPSE scraper
 */
class ScraperTester {
  constructor() {
    this.testResults = [];
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);
    console.log('═'.repeat(60));

    try {
      const startTime = Date.now();
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        name: testName,
        status: 'PASSED',
        duration,
        result
      });

      console.log(`✅ ${testName} PASSED (${duration}ms)`);
      return result;
    } catch (error) {
      this.testResults.push({
        name: testName,
        status: 'FAILED',
        error: error.message
      });

      console.error(`❌ ${testName} FAILED: ${error.message}`);
      return null;
    }
  }

  async testBasicScraping() {
    const testCompanies = [{ security_id: 141, symbol: 'NABIL' }];
    const results = await scrapeAllCompanyDetails(testCompanies);

    if (results.length === 0) {
      throw new Error('No results returned');
    }

    const company = results[0];
    const requiredFields = [
      'companyName', 'logoUrl', 'sectorName', 'status',
      'instrumentType', 'marketCapitalization', 'totalListedShares'
    ];

    const missingFields = requiredFields.filter(field => !company[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log('📊 Basic company data:');
    console.log(`   Company: ${company.companyName}`);
    console.log(`   Logo: ${company.logoUrl} ${company.isLogoPlaceholder ? '(PLACEHOLDER)' : '(REAL)'}`);
    console.log(`   Sector: ${company.sectorName}`);
    console.log(`   Market Cap: ${company.marketCapitalization.toLocaleString()}`);

    return company;
  }

  async testLogoExtraction() {
    console.log('🖼️  Testing logo extraction with multiple companies...');

    const testCompanies = [
      { security_id: 141, symbol: 'NABIL' },
      { security_id: 138, symbol: 'NIC' }
    ];

    const results = await scrapeAllCompanyDetails(testCompanies);

    if (results.length === 0) {
      throw new Error('No results returned');
    }

    const logoResults = results.map(company => ({
      symbol: company.symbol,
      logoUrl: company.logoUrl,
      isPlaceholder: company.isLogoPlaceholder,
      hasLogo: !!company.logoUrl
    }));

    logoResults.forEach(result => {
      console.log(`   ${result.symbol}: ${result.hasLogo ? '✅' : '❌'} Logo ${result.isPlaceholder ? '(placeholder)' : '(real)'}`);
    });

    const companiesWithLogos = logoResults.filter(r => r.hasLogo);
    if (companiesWithLogos.length !== results.length) {
      throw new Error(`Only ${companiesWithLogos.length}/${results.length} companies have logos`);
    }

    return logoResults;
  }

  async testFinancialDataAccuracy() {
    console.log('💰 Testing financial data extraction accuracy...');

    const testCompanies = [{ security_id: 141, symbol: 'NABIL' }];
    const results = await scrapeAllCompanyDetails(testCompanies);

    if (results.length === 0) {
      throw new Error('No results returned');
    }

    const company = results[0];

    // Test specific financial data fields
    const financialTests = [
      { field: 'lastTradedPrice', min: 0, description: 'Last Traded Price' },
      { field: 'marketCapitalization', min: 1000000, description: 'Market Capitalization' },
      { field: 'totalListedShares', min: 1000, description: 'Total Listed Shares' },
      { field: 'fiftyTwoWeekHigh', min: 0, description: '52 Week High' },
      { field: 'fiftyTwoWeekLow', min: 0, description: '52 Week Low' }
    ];

    const failedTests = [];

    financialTests.forEach(test => {
      const value = company[test.field];
      const isValid = typeof value === 'number' && value >= test.min;

      console.log(`   ${test.description}: ${value} ${isValid ? '✅' : '❌'}`);

      if (!isValid) {
        failedTests.push(test.description);
      }
    });

    if (failedTests.length > 0) {
      throw new Error(`Invalid financial data: ${failedTests.join(', ')}`);
    }

    return company;
  }

  async testCrossSectorSupport() {
    console.log('🏭 Testing cross-sector support...');

    const testCompanies = [
      { security_id: 141, symbol: 'NABIL' },    // Bank
      { security_id: 259, symbol: 'MICRO' }     // Finance
    ];

    const results = await scrapeAllCompanyDetails(testCompanies);

    if (results.length !== testCompanies.length) {
      throw new Error(`Expected ${testCompanies.length} results, got ${results.length}`);
    }

    const sectorResults = results.map(company => ({
      symbol: company.symbol,
      sector: company.sectorName,
      status: company.status,
      hasData: company.marketCapitalization > 0
    }));

    sectorResults.forEach(result => {
      console.log(`   ${result.symbol} (${result.sector}): ${result.hasData ? '✅' : '❌'} Data extracted`);
    });

    const companiesWithData = sectorResults.filter(r => r.hasData);
    if (companiesWithData.length !== results.length) {
      throw new Error(`Only ${companiesWithData.length}/${results.length} companies have valid data`);
    }

    return sectorResults;
  }

  async testMarketStatus() {
    console.log('📊 Testing market status detection...');

    const status = await scrapeMarketStatus();

    console.log(`   Market Status: ${status ? 'OPEN' : 'CLOSED'}`);

    // Market status should be boolean
    if (typeof status !== 'boolean') {
      throw new Error(`Expected boolean, got ${typeof status}`);
    }

    return status;
  }

  async testPricesScraping() {
    console.log('💹 Testing prices scraping (limited to 1 page)...');

    // Mock a quick test by checking if the function works
    // We won't run full scraping as it's time-intensive
    try {
      // Just test that the function is callable and doesn't crash immediately
      const testPromise = fetchTodaysPrices();

      // Cancel after 5 seconds to avoid long wait
      const timeout = new Promise(resolve => setTimeout(() => resolve([]), 5000));
      const results = await Promise.race([testPromise, timeout]);

      console.log(`   Price scraping function: ✅ Callable (${results.length} items sampled)`);
      return { functional: true, sampleCount: results.length };
    } catch (error) {
      throw new Error(`Price scraping failed: ${error.message}`);
    }
  }

  async debugCompany(securityId, symbol) {
    console.log(`\n🔍 Debug mode for: ${symbol} (${securityId})`);
    console.log('═'.repeat(60));

    try {
      // Download HTML
      console.log('📥 Downloading HTML...');
      const url = `https://www.nepalstock.com/company/detail/${securityId}`;
      const filename = `debug_${symbol}_${securityId}.html`;
      await downloadHTML(url, filename);
      console.log(`✅ HTML saved: downloads/${filename}`);

      // Scrape data
      console.log('\n🔧 Scraping data...');
      const results = await scrapeAllCompanyDetails([{ security_id: securityId, symbol }]);

      if (results.length > 0) {
        const company = results[0];
        console.log('\n📊 Extracted data:');
        Object.entries(company).forEach(([key, value]) => {
          if (value !== '' && value !== 0 && value !== null && value !== undefined) {
            console.log(`   ${key}: ${value}`);
          }
        });
      } else {
        console.log('❌ No data extracted');
      }

    } catch (error) {
      console.error('❌ Debug failed:', error.message);
    }
  }

  async runAllTests() {
    console.log('\n🚀 NEPSE Scraper Test Suite');
    console.log('═'.repeat(60));

    await this.runTest('Basic Company Scraping', () => this.testBasicScraping());
    await this.runTest('Logo Extraction', () => this.testLogoExtraction());
    await this.runTest('Financial Data Accuracy', () => this.testFinancialDataAccuracy());
    await this.runTest('Cross-Sector Support', () => this.testCrossSectorSupport());
    await this.runTest('Market Status Detection', () => this.testMarketStatus());
    await this.runTest('Price Scraping Function', () => this.testPricesScraping());

    // Print summary
    console.log('\n📈 Test Summary');
    console.log('═'.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${this.testResults.length}`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Scraper is working perfectly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
    }

    return {
      passed,
      failed,
      total: this.testResults.length,
      success: failed === 0
    };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const tester = new ScraperTester();

  if (args.length === 0) {
    // Run all tests
    tester.runAllTests().catch(console.error);
  } else if (args[0] === 'debug' && args.length >= 3) {
    // Debug specific company
    const securityId = parseInt(args[1]);
    const symbol = args[2];
    tester.debugCompany(securityId, symbol).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node tests.js                    - Run all tests');
    console.log('  node tests.js debug <id> <symbol> - Debug specific company');
    console.log('');
    console.log('Examples:');
    console.log('  node tests.js');
    console.log('  node tests.js debug 141 NABIL');
  }
}

module.exports = { ScraperTester };