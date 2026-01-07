// Debug script to test intraday data retrieval
const redis = require('./src/config/redis');

async function test() {
  try {
    const targetDate = '2026-01-07';
    const intradayKey = `intraday:market_index:${targetDate}`;

    console.log(`Fetching from key: ${intradayKey}`);
    console.log(`(Redis will prefix with: nepse:)`);

    const snapshots = await redis.zrange(intradayKey, 0, -1, 'WITHSCORES');
    console.log(`\nTotal items returned: ${snapshots.length}`);
    console.log(`First few items:`);

    for (let i = 0; i < Math.min(6, snapshots.length); i += 2) {
      const data = JSON.parse(snapshots[i]);
      const timestamp = parseInt(snapshots[i + 1]);
      console.log(`\nEntry ${i / 2 + 1}:`);
      console.log(`  nepseIndex: ${data.nepseIndex}`);
      console.log(`  marketStatusTime: ${data.marketStatusTime}`);
      console.log(`  timestamp: ${new Date(timestamp).toISOString()}`);
      console.log(`  Has nepseIndex? ${!!data.nepseIndex}`);
      console.log(`  nepseIndex === 0? ${data.nepseIndex === 0}`);
    }

    await redis.quit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
