const { syncIpoResults } = require('./src/scheduler/ipo-result-sync-scheduler');
const logger = require('./src/utils/logger');

async function testSync() {
  try {
    console.log('=== Testing IPO Result Sync ===\n');
    console.log('This will sync results from both Nabil Invest and NMB Capital\n');

    const result = await syncIpoResults();

    console.log('\n=== Sync Summary ===');
    console.log(`Total Scripts Found: ${result.totalScriptsFound}`);
    console.log(`Total Matched: ${result.totalMatched}`);
    console.log(`Total Updated: ${result.totalUpdated}`);

    console.log('\n=== Provider Details ===');
    for (const [providerId, providerData] of Object.entries(result.providers)) {
      console.log(`\n${providerData.name}:`);
      console.log(`  Scripts Found: ${providerData.scriptsFound}`);
      console.log(`  Matched: ${providerData.matched}`);
      console.log(`  Updated: ${providerData.updated}`);
      if (providerData.errors.length > 0) {
        console.log(`  Errors: ${providerData.errors.length}`);
      }
    }

    if (result.matches.length > 0) {
      console.log('\n=== Matches ===');
      result.matches.forEach((match, index) => {
        console.log(`${index + 1}. [${match.provider}] ${match.scriptName}`);
        console.log(`   → IPO #${match.ipoId}: ${match.companyName} (${match.shareType})`);
      });
    }

    if (result.errors.length > 0) {
      console.log('\n=== Errors ===');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.provider}] ${error.script || 'General'}: ${error.error}`);
      });
    }

    console.log('\n=== Test Complete ===');
    process.exit(0);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testSync();
