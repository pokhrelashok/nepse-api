#!/usr/bin/env node

const { pool, saveCompanyDetails } = require('../src/database/database');
const { formatCompanyDetailsForDatabase } = require('../src/utils/formatter');

async function testSave() {
  try {
    // Create a minimal test object
    const testData = {
      securityId: 2770,
      symbol: 'SEF',
      companyName: 'Test Fund',
      sectorName: 'Mutual Funds',
      instrumentType: 'Mutual Fund',
      status: 'A',
      permittedToTrade: 'Yes',
      listingDate: '2020-01-01',
      lastTradedPrice: 10.5,
      closePrice: 10.5,
      // All other required fields with defaults
      email: '',
      website: '',
      issueManager: '',
      shareRegistrar: '',
      totalListedShares: 0,
      paidUpCapital: 0,
      totalPaidUpValue: 0,
      promoterShares: 0,
      publicShares: 0,
      marketCapitalization: 0,
      openPrice: 0,
      highPrice: 0,
      lowPrice: 0,
      previousClose: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      totalTradedQuantity: 0,
      totalTrades: 0,
      averageTradedPrice: 0,
      logoUrl: null,
      isLogoPlaceholder: true,
      pe_ratio: null,
      pb_ratio: null,
      dividend_yield: null,
      eps: null,
      maturity_date: null,
      maturity_period: null
    };

    console.log('Test data:', JSON.stringify(testData, null, 2));

    const formatted = formatCompanyDetailsForDatabase([testData]);
    console.log('\nFormatted data:', JSON.stringify(formatted, null, 2));
    console.log('\nNumber of keys:', Object.keys(formatted[0]).length);
    console.log('Keys:', Object.keys(formatted[0]).join(', '));

    await saveCompanyDetails(formatted);
    console.log('\n✅ Save successful!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testSave();
