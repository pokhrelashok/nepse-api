const { downloadHTML } = require('./html_downloader');
const { scrapeAllCompanyDetails } = require('./scraper');

async function debugCompany(securityId, symbol) {
  console.log(`🔍 Debugging company: ${symbol} (ID: ${securityId})`);
  console.log('='.repeat(60));

  try {
    // Step 1: Download the HTML for inspection
    console.log('📥 Step 1: Downloading HTML...');
    const url = `https://www.nepalstock.com/company/detail/${securityId}`;
    const filename = `debug_${symbol}_${securityId}.html`;

    await downloadHTML(url, filename);
    console.log(`✅ HTML downloaded to: downloads/${filename}`);

    // Step 2: Try to scrape the data
    console.log('\n🔧 Step 2: Attempting to scrape data...');
    const results = await scrapeAllCompanyDetails([{ security_id: securityId, symbol: symbol }]);

    if (results.length > 0) {
      const company = results[0];
      console.log('✅ Scraping successful!');
      console.log('\n📊 Extracted Data:');
      console.log('─'.repeat(40));

      // Show key fields
      Object.entries(company).forEach(([key, value]) => {
        if (value && value !== 0) {
          console.log(`${key}: ${value}`);
        } else if (value === 0 && ['totalTrades', 'totalTradedQuantity', 'marketCapitalization'].includes(key)) {
          console.log(`${key}: ${value}`);
        } else {
          console.log(`${key}: [EMPTY/NULL]`);
        }
      });

    } else {
      console.log('❌ No data extracted');
    }

    // Step 3: Provide debugging tips
    console.log('\n💡 Debugging Tips:');
    console.log('─'.repeat(40));
    console.log(`1. Open downloads/${filename} in a browser to inspect HTML structure`);
    console.log(`2. Look for table rows with <th> and <td> elements`);
    console.log(`3. Check if company has data populated in the UI`);
    console.log(`4. Verify the company is active and has recent trading data`);

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node debug_company.js <securityId> <symbol>');
    console.log('Example: node debug_company.js 141 NABIL');
    process.exit(1);
  }

  const securityId = parseInt(args[0]);
  const symbol = args[1];

  debugCompany(securityId, symbol);
}

module.exports = { debugCompany };