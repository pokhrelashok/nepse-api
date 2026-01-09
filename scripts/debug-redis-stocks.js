/**
 * Debug Redis Stock Data
 * Check for companies with invalid security_id in Redis
 */

const redis = require('../src/config/redis');
const logger = require('../src/utils/logger');

async function checkRedisData() {
  console.log('\n🔍 Checking Redis stock prices data...\n');

  try {
    const redisPrices = await redis.hgetall('live:stock_prices');

    if (!redisPrices || Object.keys(redisPrices).length === 0) {
      console.log('❌ No data in Redis (live:stock_prices)');
      return;
    }

    console.log(`📊 Total entries in Redis: ${Object.keys(redisPrices).length}\n`);

    let validCount = 0;
    let invalidCount = 0;
    const invalidEntries = [];

    for (const [key, value] of Object.entries(redisPrices)) {
      try {
        const data = JSON.parse(value);
        const securityId = data.security_id || data.securityId;

        if (!securityId || securityId <= 0) {
          invalidCount++;
          invalidEntries.push({
            symbol: data.symbol,
            security_id: securityId,
            key: key
          });
        } else {
          validCount++;
        }
      } catch (e) {
        console.error(`❌ Failed to parse entry for key ${key}:`, e.message);
      }
    }

    console.log(`✅ Valid entries: ${validCount}`);
    console.log(`❌ Invalid entries (security_id null/0): ${invalidCount}\n`);

    if (invalidEntries.length > 0) {
      console.log('Invalid entries:');
      invalidEntries.forEach(entry => {
        console.log(`  - ${entry.symbol}: security_id = ${entry.security_id} (key: ${entry.key})`);
      });
      console.log('\n💡 These entries should be removed from Redis or fixed in the source data.');
    }

  } catch (error) {
    console.error('❌ Error checking Redis:', error);
  } finally {
    await redis.quit();
  }
}

checkRedisData();
