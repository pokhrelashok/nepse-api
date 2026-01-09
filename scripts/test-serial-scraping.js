#!/usr/bin/env node

/**
 * Serial Scraping Script
 * Runs all major scraping jobs in sequence to emulate production flow
 * and identify data discrepancies.
 * 
 * Usage: node scripts/test-serial-scraping.js [--test] [--limit=N] [--force]
 */

const { DateTime } = require('luxon');
const logger = require('../src/utils/logger');
const { NepseScraper } = require('../src/scrapers/nepse-scraper');
const { pool } = require('../src/database/database');

// Import job functions
const { updateMarketIndex, updatePricesAndStatus } = require('../src/scheduler/market-jobs');
const { updateCompanyDetails } = require('../src/scheduler/company-jobs');
const { runMarketIndicesHistoryScrape } = require('../src/scheduler/data-jobs');

// Parse arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const isForce = args.includes('--force') || isTestMode; // Force by default in test mode
const limitArg = args.find(arg => arg.startsWith('--limit='));
const testLimit = limitArg ? parseInt(limitArg.split('=')[1]) : 2;
const symbolsArg = args.find(arg => arg.startsWith('--symbols='));
const targetSymbols = symbolsArg ? symbolsArg.split('=')[1] : null;

/**
 * Mock Scheduler to satisfy job function requirements
 */
class MockScheduler {
  constructor() {
    this.isJobRunning = new Map();
    this.status = new Map();
  }

  updateStatus(jobKey, type, message) {
    const timestamp = DateTime.now().setZone('Asia/Kathmandu').toFormat('HH:mm:ss');
    logger.info(`[${timestamp}] [${jobKey}] [${type}] ${message}`);
    this.status.set(jobKey, { type, message, timestamp });
  }

  // Necessary for jobs that check this
  async waitForJobsToFinish() {
    return true;
  }
}

async function runSerialScraping() {
  logger.info('🚀 Starting Serial Scraping Flow (Production Emulation)');
  logger.info('=====================================================');
  logger.info(`Mode: ${isTestMode ? 'TEST' : 'FULL'}`);
  if (isTestMode) logger.info(`Limit: ${testLimit} companies`);
  if (isForce) logger.info('Force Fetch: ENABLED');
  logger.info('');

  const scheduler = new MockScheduler();
  const scraper = new NepseScraper();

  // Market Open state for jobs that care
  const isMarketOpen = { value: true };

  let isCleaningUp = false;
  const cleanup = async (signal) => {
    if (isCleaningUp) return;
    isCleaningUp = true;

    if (signal) {
      logger.info(`\n\n[${signal}] Termination signal received. Cleaning up...`);
    } else {
      logger.info('Performing final cleanup...');
    }

    try {
      await scraper.close();
      logger.info('✅ Scraper closed');
      await pool.end();
      logger.info('✅ Database pool ended');
    } catch (err) {
      logger.error('Error during cleanup:', err);
    }

    if (signal) process.exit(0);
  };

  // Register signal handlers
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  try {
    // 1. Scrape Market Index
    logger.info('--- 1/5: Market Index Update ---');
    await updateMarketIndex(scheduler, scraper, isMarketOpen, isForce);
    logger.info('');

    // 2. Get Price Updates
    logger.info('--- 2/5: Price Update ---');
    // We emulate 'DURING_HOURS' to trigger actual price scraping
    await updatePricesAndStatus(scheduler, scraper, 'DURING_HOURS', isForce);
    logger.info('');

    // 3. Scrape Company Details
    logger.info('--- 3/5: Company Details Update ---');
    if (isTestMode) {
      logger.info(`(Test Mode) Scraping details for ${testLimit} companies...`);
      const { getAllSecurityIds } = require('../src/database/queries');
      const { insertCompanyDetails, insertDividends, insertFinancials } = require('../src/database/queries');
      const { formatCompanyDetailsForDatabase } = require('../src/utils/formatter');

      let companies = await getAllSecurityIds();

      // Filter by target symbols if provided
      if (targetSymbols) {
        const symbolsList = targetSymbols.split(',').map(s => s.trim().toUpperCase());
        companies = companies.filter(c => symbolsList.includes(c.symbol));
        logger.info(`   Scraping targeted symbols: ${targetSymbols}`);
      } else {
        // Filter out companies with invalid security_id
        companies = companies.filter(c => c.security_id && c.security_id > 0);
        logger.info(`   Valid companies after filtering: ${companies.length}`);
        companies = companies.slice(0, testLimit);
      }

      await scraper.scrapeAllCompanyDetails(
        companies,
        async (batch) => {
          const formatted = formatCompanyDetailsForDatabase(batch);
          await insertCompanyDetails(formatted);
        },
        insertDividends,
        insertFinancials
      );
    } else {
      await updateCompanyDetails(scheduler, scraper, false);
    }
    logger.info('');

    // 4. Stock History
    logger.info('--- 4/5: Stock History Scrape ---');
    try {
      const { execSync } = require('child_process');
      const scriptPath = require('path').join(__dirname, 'fetch-stock-history.js');
      let cmdArgs = isTestMode && !targetSymbols ? `--test --limit=${testLimit}` : '';
      if (targetSymbols) cmdArgs += ` --symbols=${targetSymbols}`;

      const cmd = `node ${scriptPath} ${cmdArgs}`;
      logger.info(`Running: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      logger.error('Stock history scrape failed:', error);
    }
    logger.info('');

    // 5. Market History
    logger.info('--- 5/5: Market History Scrape ---');
    await runMarketIndicesHistoryScrape(scheduler);
    logger.info('');

    logger.info('=====================================================');
    logger.info('✅ Serial Scraping Sequence Completed');

  } catch (error) {
    logger.error('❌ Serial scraping flow failed:', error);
  } finally {
    await cleanup();
    process.exit(0);
  }
}

runSerialScraping();
