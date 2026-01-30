const { syncIpoResults } = require('../src/scheduler/ipo-result-sync-scheduler');
const logger = require('../src/utils/logger');

async function runSync() {
  try {
    // Basic argument parsing for --no-notifications or --silent
    const args = process.argv.slice(2);
    const sendNotifications = !args.includes('--no-notifications') && !args.includes('--silent');

    console.log('🚀 Starting manual IPO result sync...');
    console.log(`Notifications: ${sendNotifications ? 'Enabled' : 'Disabled'}`);
    console.log('Fetching scripts from all providers and matching with local database...\n');

    const result = await syncIpoResults({ sendNotifications });

    console.log('\n✅ Sync Complete!');
    console.log('-------------------');
    console.log(`Total Scripts Found: ${result.totalScriptsFound}`);
    console.log(`Total Saved:         ${result.totalSaved}`);

    // Log details per provider
    Object.entries(result.providers).forEach(([id, stats]) => {
      console.log(`\nprovder: ${stats.name} (${id})`);
      console.log(`  Scripts Found: ${stats.scriptsFound}`);
      console.log(`  Saved:         ${stats.saved}`);

      if (stats.errors.length > 0) {
        console.log(`  Errors:        ${stats.errors.length}`);
        stats.errors.forEach(err => console.log(`    - ${JSON.stringify(err)}`));
      }
    });

    // Matches details are not currently returned by syncIpoResults
    // if (result.matches && result.matches.length > 0) {
    //   console.log('\n📋 Matches Details:');
    //   result.matches.forEach(m => {
    //     console.log(`  - [${m.provider}] ${m.scriptName} -> IPO #${m.ipoId} (${m.companyName})`);
    //   });
    // }

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync Failed:', error);
    process.exit(1);
  }
}

runSync();
