/**
 * Sync Redis Stock Prices to company_details Table
 * 
 * This script reads stock prices from Redis (live:stock_prices) and updates
 * the company_details table with the latest price information.
 * 
 * Usage:
 *   node scripts/sync-redis-to-company-details.js [--dry-run] [--symbol SYMBOL]
 * 
 * Options:
 *   --dry-run    Show what would be updated without making changes
 *   --symbol     Sync only a specific symbol (e.g., --symbol ADBL)
 */

const redis = require('../src/config/redis');
const pool = require('../src/config/database');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const symbolIndex = args.indexOf('--symbol');
const targetSymbol = symbolIndex !== -1 && args[symbolIndex + 1] ? args[symbolIndex + 1].toUpperCase() : null;

async function syncRedisToDB() {
  console.log('\n🔄 Syncing Redis prices to company_details table...\n');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  if (targetSymbol) {
    console.log(`🎯 Targeting specific symbol: ${targetSymbol}\n`);
  }

  try {
    // Get all stock prices from Redis
    const redisPrices = await redis.hgetall('live:stock_prices');

    if (!redisPrices || Object.keys(redisPrices).length === 0) {
      console.log('❌ No data found in Redis (live:stock_prices)');
      return;
    }

    console.log(`📊 Total entries in Redis: ${Object.keys(redisPrices).length}\n`);

    // Prepare update SQL
    const updateSql = `
      UPDATE company_details SET
        last_traded_price = ?,
        open_price = ?,
        high_price = ?,
        low_price = ?,
        close_price = ?,
        previous_close = ?,
        fifty_two_week_high = ?,
        fifty_two_week_low = ?,
        total_traded_quantity = ?,
        total_trades = ?,
        average_traded_price = ?,
        updated_at = NOW()
      WHERE symbol = ?
    `;

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    const errors = [];

    // Process each entry
    for (const [symbol, valueJson] of Object.entries(redisPrices)) {
      try {
        // Skip if targeting specific symbol and this isn't it
        if (targetSymbol && symbol !== targetSymbol) {
          skippedCount++;
          continue;
        }

        const data = JSON.parse(valueJson);

        // Validate security_id
        const securityId = data.security_id || data.securityId;
        if (!securityId || securityId <= 0) {
          console.log(`⚠️  Skipping ${symbol}: Invalid security_id (${securityId})`);
          skippedCount++;
          continue;
        }

        // Check if company exists in database
        const [existing] = await pool.execute(
          'SELECT symbol FROM company_details WHERE symbol = ?',
          [symbol]
        );

        if (existing.length === 0) {
          console.log(`⚠️  Symbol ${symbol} not found in company_details table`);
          notFoundCount++;
          continue;
        }

        // Prepare values
        const values = [
          data.last_traded_price ?? data.lastTradedPrice ?? 0,
          data.open_price ?? data.openPrice ?? 0,
          data.high_price ?? data.highPrice ?? 0,
          data.low_price ?? data.lowPrice ?? 0,
          data.close_price ?? data.closePrice ?? 0,
          data.previous_close ?? data.previousClose ?? 0,
          data.fifty_two_week_high ?? data.fiftyTwoWeekHigh ?? 0,
          data.fifty_two_week_low ?? data.fiftyTwoWeekLow ?? 0,
          data.total_traded_quantity ?? data.totalTradedQuantity ?? 0,
          data.total_trades ?? data.totalTrades ?? 0,
          data.average_traded_price ?? data.averageTradedPrice ?? 0,
          symbol
        ];

        if (isDryRun) {
          console.log(`✓ Would update ${symbol}: LTP=${values[0]}, Open=${values[1]}, High=${values[2]}, Low=${values[3]}`);
          successCount++;
        } else {
          // Execute update
          const [result] = await pool.execute(updateSql, values);
          
          if (result.affectedRows > 0) {
            successCount++;
            if (targetSymbol) {
              console.log(`✅ Updated ${symbol}:`);
              console.log(`   Last Traded Price: ${values[0]}`);
              console.log(`   Open: ${values[1]}, High: ${values[2]}, Low: ${values[3]}, Close: ${values[4]}`);
              console.log(`   Previous Close: ${values[5]}`);
              console.log(`   52W High: ${values[6]}, 52W Low: ${values[7]}`);
              console.log(`   Volume: ${values[8]}, Trades: ${values[9]}`);
            }
          } else {
            console.log(`⚠️  No rows affected for ${symbol}`);
          }
        }

      } catch (error) {
        errorCount++;
        const errorMsg = `${symbol}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ Error processing ${errorMsg}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Sync Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully ${isDryRun ? 'would update' : 'updated'}: ${successCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`🔍 Not found in DB: ${notFoundCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (errors.length > 0 && errors.length <= 10) {
      console.log('Error details:');
      errors.forEach(err => console.log(`  - ${err}`));
      console.log('');
    }

    if (isDryRun) {
      console.log('💡 Run without --dry-run flag to apply changes\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    logger.error('Sync Redis to DB failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await redis.quit();
    await pool.end();
  }
}

// Run the sync
syncRedisToDB()
  .then(() => {
    console.log('✨ Sync completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Sync failed:', error);
    process.exit(1);
  });
