const { syncIpoResults } = require('../src/scheduler/ipo-result-sync-scheduler');
const logger = require('../src/utils/logger'); // Assuming logger is available

async function runSync() {
  try {
    console.log('🚀 Starting manual IPO result sync...');
    console.log('Fetching scripts from all providers and matching with local database...\n');

    const result = await syncIpoResults();

    console.log('\n✅ Sync Complete!');
    console.log('-------------------');
    console.log(`Total Scripts Found: ${result.totalScriptsFound}`);
    console.log(`Total Matched:       ${result.totalMatched}`);
    console.log(`Total Updated:       ${result.totalUpdated}`);

    // Log details per provider
    Object.entries(result.providers).forEach(([id, stats]) => {
      console.log(`\nprovder: ${stats.name} (${id})`);
      console.log(`  Scripts Found: ${stats.scriptsFound}`);
      console.log(`  Matched:       ${stats.matched}`);
      console.log(`  Updated:       ${stats.updated}`);

      if (stats.errors.length > 0) {
        console.log(`  Errors:        ${stats.errors.length}`);
        stats.errors.forEach(err => console.log(`    - ${JSON.stringify(err)}`));
      }
    });

    if (result.matches.length > 0) {
      console.log('\n📋 Matches Details:');
      result.matches.forEach(m => {
        console.log(`  - [${m.provider}] ${m.scriptName} -> IPO #${m.ipoId} (${m.companyName})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync Failed:', error);
    process.exit(1);
  }
}

runSync();
