#!/usr/bin/env node

/**
 * Historical Market Indices Scraper
 * Fetches historical market indices data by interacting with the NEPSE website
 * and intercepting the API response.
 * Uses the robust NepseScraper class for browser management.
 */

const { NepseScraper } = require('../src/scrapers/nepse-scraper');
const { saveMarketIndexHistory } = require('../src/database/database');
const logger = require('../src/utils/logger');
const { pool } = require('../src/database/database');

// Parse command line arguments
const args = process.argv.slice(2);
const isHeadless = !args.includes('--no-headless');

async function fetchIndexHistory() {
  logger.info(`🚀 Starting Market Indices History Scraper (Headless: ${isHeadless})...`);

  const scraper = new NepseScraper({ headless: isHeadless });

  try {
    const data = await scraper.scrapeMarketIndicesHistory();

    if (!data || data.length === 0) {
      throw new Error('No data received from scraper');
    }

    // Map of known index IDs to names
    const indexNames = {
      58: 'NEPSE Index',
      57: 'Sensitive Index',
      59: 'Float Index',
      60: 'Sensitive Float Index',
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

    logger.info(`💾 Saving ${formattedData.length} records to database...`);
    const count = await saveMarketIndexHistory(formattedData);
    logger.info(`✅ Successfully saved ${count} historical index records`);

  } catch (error) {
    logger.error(`❌ Scraper failed: ${error.message}`);
    process.exit(1);
  } finally {
    await scraper.close();
    await pool.end();
  }
}

if (require.main === module) {
  fetchIndexHistory();
}
