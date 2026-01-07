#!/usr/bin/env bun
/**
 * Manual Market Indices History Backfill Script
 * 
 * This script scrapes historical market index data from NEPSE's API
 * and saves it to the market_indices_history table.
 * 
 * ⚠️ WARNING: This should ONLY be used for one-time historical backfills.
 * DO NOT run this daily as it will overwrite current day's data with stale API data.
 * 
 * For daily archiving, use the scheduled archiveMarketIndex job (runs at 3:06 PM).
 * 
 * Usage:
 *   bun run scripts/backfill-market-history.js
 */

const { scrapeMarketIndicesHistory } = require('../src/scrapers/nepse-scraper');
const { saveMarketIndexHistory } = require('../src/database/queries');
const logger = require('../src/utils/logger');

async function backfillMarketHistory() {
  try {
    logger.info('📊 Starting market indices history backfill...');

    const data = await scrapeMarketIndicesHistory();

    if (!data || data.length === 0) {
      logger.warn('⚠️ No historical data found');
      return;
    }

    logger.info(`📈 Scraped ${data.length} historical records`);

    const indexNames = {
      58: 'NEPSE Index',
      57: 'Sensitive Index',
      59: 'Float Index',
      60: 'Sensitive Float Index'
    };

    const formattedData = data.map(record => ({
      business_date: record.businessDate,
      exchange_index_id: record.exchangeIndexId,
      index_name: indexNames[record.exchangeIndexId] || `Index ${record.exchangeIndexId}`,
      closing_index: parseFloat(record.closingIndex) || 0,
      open_index: parseFloat(record.openIndex) || 0,
      high_index: parseFloat(record.highIndex) || 0,
      low_index: parseFloat(record.lowIndex) || 0,
      fifty_two_week_high: parseFloat(record.fiftyTwoWeekHigh) || 0,
      fifty_two_week_low: parseFloat(record.fiftyTwoWeekLow) || 0,
      turnover_value: parseFloat(record.turnoverValue) || 0,
      turnover_volume: parseFloat(record.turnoverVolume) || 0,
      total_transaction: parseInt(record.totalTransaction) || 0,
      abs_change: parseFloat(record.absChange) || 0,
      percentage_change: parseFloat(record.percentageChange) || 0
    }));

    // Filter out today's date to avoid overwriting current day's data
    const today = new Date();
    const nepaliDate = new Date(today.getTime() + (5.75 * 60 * 60 * 1000));
    const todayStr = nepaliDate.toISOString().split('T')[0];

    const filteredData = formattedData.filter(record => record.business_date !== todayStr);

    if (filteredData.length < formattedData.length) {
      logger.warn(`⚠️ Filtered out ${formattedData.length - filteredData.length} records for today (${todayStr}) to avoid overwriting current data`);
    }

    const count = await saveMarketIndexHistory(filteredData);
    logger.info(`✅ Successfully saved ${count} historical index records`);

    console.log('\n✅ Market history backfill completed successfully');
    console.log(`   Total records scraped: ${data.length}`);
    console.log(`   Records saved: ${count}`);
    console.log(`   Today's date filtered: ${todayStr}`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Market history backfill failed:', error);
    console.error('\n❌ Backfill failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  backfillMarketHistory();
}

module.exports = { backfillMarketHistory };
