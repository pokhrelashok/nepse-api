const { pool } = require('../src/database/database');
const redis = require('../src/config/redis');

(async () => {
  try {
    console.log('🔍 Checking for scraped SIPs in DB...');
    const [rows] = await pool.execute("SELECT * FROM sips");
    console.log(`Found ${rows.length} SIPs in 'sips' table.`);
    if (rows.length > 0) {
      console.log('Sample SIP:', rows[0].symbol);
    }

    const [details] = await pool.execute("SELECT * FROM company_details WHERE sector_name = 'SIP'");
    console.log(`Found ${details.length} SIPs in 'company_details' table.`);

    if (details.length > 0) {
      const firstSip = details[0];
      console.log(`Checking Redis for ${firstSip.symbol}...`);
      const redisData = await redis.hget('live:stock_prices', firstSip.symbol);
      if (redisData) {
        console.log('✅ Found in Redis:', JSON.parse(redisData));
      } else {
        console.log('❌ Not found in Redis');
      }
    }

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
})();
