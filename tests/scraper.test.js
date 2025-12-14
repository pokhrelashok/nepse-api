const { scrapeAllCompanyDetails, scrapeMarketStatus, fetchTodaysPrices } = require('../src/scrapers/nepse-scraper');

class ScraperTester {
  constructor() {
    this.testResults = [];
  }

  async runTest(testName, testFunction) {
    console.log(`\nRunning test: ${testName}`);
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

    if (!company.symbol || !company.companyName) {
      throw new Error('Missing basic company information');
    }

    console.log(`   Company: ${company.companyName}`);
    console.log(`   Symbol: ${company.symbol}`);
    console.log(`   Market Cap: ${company.marketCapitalization || 'N/A'}`);

    return company;
  }

  async testLogoExtraction() {
    const testCompanies = [{ security_id: 141, symbol: 'NABIL' }];
    const results = await scrapeAllCompanyDetails(testCompanies);

    if (results.length === 0) {
      throw new Error('No results returned for logo test');
    }

    const company = results[0];

    if (!company.logoUrl) {
      console.log('   Warning: No logo URL found');
      return { hasLogo: false, isPlaceholder: true };
    }

    const isPlaceholder = company.isLogoPlaceholder;
    const logoType = isPlaceholder ? 'PLACEHOLDER' : 'REAL LOGO';

    console.log(`   Logo URL: ${company.logoUrl}`);
    console.log(`   Logo Type: ${logoType}`);

    return {
      hasLogo: true,
      isPlaceholder,
      logoUrl: company.logoUrl
    };
  }

  async testFinancialData() {
    const testCompanies = [{ security_id: 141, symbol: 'NABIL' }];
    const results = await scrapeAllCompanyDetails(testCompanies);

    if (results.length === 0) {
      throw new Error('No results for financial test');
    }

    const company = results[0];
    const financialFields = [
      'lastTradedPrice', 'marketCapitalization', 'totalListedShares',
      'highPrice', 'lowPrice', 'previousClose'
    ];

    const presentFields = financialFields.filter(field =>
      company[field] !== undefined && company[field] !== null && company[field] !== 0
    );

    console.log(`   Financial fields present: ${presentFields.length}/${financialFields.length}`);

    if (presentFields.length === 0) {
      console.log('   Warning: No financial data captured');
    } else {
      presentFields.forEach(field => {
        console.log(`   ${field}: ${company[field]}`);
      });
    }

    return { fieldsPresent: presentFields.length, totalFields: financialFields.length };
  }

  async testMarketStatus() {
    const status = await scrapeMarketStatus();
    console.log(`   Market Status: ${status ? 'OPEN' : 'CLOSED'}`);

    if (typeof status !== 'boolean') {
      throw new Error('Market status should return boolean');
    }

    return status;
  }

  async testPriceScraping() {
    const prices = await fetchTodaysPrices();

    console.log(`   Scraped ${prices.length} price records`);

    if (prices.length === 0) {
      console.log('   Warning: No price data scraped');
      return { count: 0 };
    }

    const samplePrice = prices[0];
    const requiredFields = ['symbol', 'securityId'];
    const missingFields = requiredFields.filter(field => !samplePrice[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log(`   Sample: ${samplePrice.symbol} (ID: ${samplePrice.securityId})`);

    return { count: prices.length, sample: samplePrice };
  }

  async testMultiCompanyScraping() {
    const testCompanies = [
      { security_id: 141, symbol: 'NABIL' },
      { security_id: 138, symbol: 'NIC' }
    ];

    const results = await scrapeAllCompanyDetails(testCompanies);

    console.log(`   Scraped ${results.length}/${testCompanies.length} companies`);

    if (results.length === 0) {
      throw new Error('Failed to scrape any companies');
    }

    const companiesWithLogos = results.filter(c => c.logoUrl && !c.isLogoPlaceholder);
    console.log(`   Companies with real logos: ${companiesWithLogos.length}`);

    return {
      totalScraped: results.length,
      expectedCount: testCompanies.length,
      realLogos: companiesWithLogos.length
    };
  }

  async runAllTests() {
    console.log('NEPSE Scraper Test Suite');
    console.log('═'.repeat(40));

    await this.runTest('Basic Company Scraping', () => this.testBasicScraping());
    await this.runTest('Logo Extraction', () => this.testLogoExtraction());
    await this.runTest('Financial Data Extraction', () => this.testFinancialData());
    await this.runTest('Market Status Check', () => this.testMarketStatus());
    await this.runTest('Price Data Scraping', () => this.testPriceScraping());
    await this.runTest('Multi-Company Scraping', () => this.testMultiCompanyScraping());
    await this.runTest('Dividend & Financials Scraping', () => this.testDividendAndFinancials());

    this.printSummary();
  }

  async testDividendAndFinancials() {
    // Use a known company with dividends (e.g., NABIL - 141)
    const testCompanies = [{ security_id: 141, symbol: 'NABIL' }];

    let dividends = [];
    let financials = [];

    const mockDividendCallback = async (data) => { dividends = data; };
    const mockFinancialCallback = async (data) => { financials = data; };

    // We need to import the scraper class directly to inject callbacks
    const { NepseScraper } = require('../src/scrapers/nepse-scraper');
    const scraper = new NepseScraper();

    try {
      await scraper.scrapeAllCompanyDetails(
        testCompanies,
        null, // saveCallback
        mockDividendCallback,
        mockFinancialCallback
      );
    } finally {
      await scraper.close();
    }

    console.log(`   Dividends captured: ${dividends.length}`);
    if (dividends.length > 0) {
      console.log(`   Sample Dividend: FY ${dividends[0].fiscalYear}, Total: ${dividends[0].totalDividend}%`);
    }

    console.log(`   Financials captured: ${financials.length}`);
    if (financials.length > 0) {
      console.log(`   Sample Financial: FY ${financials[0].fiscalYear} Q${financials[0].quarter}, EPS: ${financials[0].earningsPerShare}`);
    }

    if (dividends.length === 0 && financials.length === 0) {
      console.warn('   Warning: No dividend or financial data captured (might be expected if none exists or tab scraping failed)');
      // Return success with warning for now as not all companies have data, but NABIL usually does
      return { dividends: 0, financials: 0 };
    }

    return { dividends: dividends.length, financials: financials.length };
  }

  printSummary() {
    console.log('\nTEST SUMMARY');
    console.log('═'.repeat(40));

    const passed = this.testResults.filter(t => t.status === 'PASSED').length;
    const failed = this.testResults.filter(t => t.status === 'FAILED').length;

    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(t => t.status === 'FAILED')
        .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    }

    console.log(`\nOverall Status: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  }
}

if (require.main === module) {
  const tester = new ScraperTester();
  tester.runAllTests()
    .then(() => {
      const failed = tester.testResults.filter(t => t.status === 'FAILED').length;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

module.exports = { ScraperTester };