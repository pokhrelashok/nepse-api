#!/usr/bin/env node

const { program } = require('commander');
const Scheduler = require('./scheduler');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const { scrapeIpos } = require('./scrapers/ipo-scraper');
const { scrapeFpos } = require('./scrapers/fpo-scraper');
const { scrapeDividends } = require('./scrapers/dividend-scraper');
const { getAllSecurityIds, getSecurityIdsWithoutDetails, getSecurityIdsBySymbols, insertTodayPrices, insertCompanyDetails, insertDividends, insertFinancials, updateMarketStatus, saveMarketSummary } = require('./database/queries');
const { formatPricesForDatabase, formatCompanyDetailsForDatabase } = require('./utils/formatter');
const NotificationService = require('./services/notification-service');
const { db } = require('./database/database');
const fs = require('fs');
const path = require('path');

// Global scheduler and scraper instances
let scheduler = null;
let scraper = null;

// Cleanup function
const cleanup = async () => {
  console.log('\n🧹 Cleaning up resources...');

  if (scheduler) {
    await scheduler.stopAllSchedules();
    scheduler = null;
  }

  if (scraper) {
    await scraper.close();
    scraper = null;
  }

  console.log('✅ Cleanup completed');
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

program
  .name('nepse-scraper')
  .description('Nepal Stock Exchange scraper and scheduler')
  .version('1.0.0');

program
  .command('market-status')
  .description('Check and optionally save current market status')
  .option('-s, --save', 'Save the status to the database')
  .action(async (options) => {
    try {
      console.log('🔍 Fetching market summary...');
      scraper = new NepseScraper();
      const summary = await scraper.scrapeMarketSummary();

      const { status, isOpen, indexData } = summary;
      const color = isOpen ? '\x1b[32m' : '\x1b[31m'; // Green for Open, Red for Closed

      console.log(`${color}Market Status: ${status} ${isOpen ? '(Open)' : '(Closed)'}\x1b[0m`);
      console.log(`📊 Index: ${indexData.nepseIndex} (${indexData.indexChange >= 0 ? '+' : ''}${indexData.indexChange})`);
      console.log(`💱 Turnover: Rs. ${indexData.totalTurnover.toLocaleString()}`);

      if (options.save) {
        await saveMarketSummary(summary);
        console.log('💾 Market summary saved to database');
      }
    } catch (error) {
      console.error('❌ Failed to check market status:', error.message);
      process.exit(1);
    } finally {
      if (scraper) {
        await scraper.close();
        scraper = null;
      }
    }
  });

program
  .command('prices')
  .description('Scrape today\'s stock prices')
  .option('--no-save', 'Skip saving to database')
  .option('-f, --file <filename>', 'Save to JSON file')
  .action(async (options) => {
    try {
      console.log('📊 Scraping today\'s prices...');
      scraper = new NepseScraper();
      const prices = await scraper.scrapeTodayPrices();

      console.log(`✅ Scraped ${prices.length} stock prices`);

      // Default to true unless --no-save is passed
      if (options.save !== false) {
        const formattedPrices = formatPricesForDatabase(prices);
        await insertTodayPrices(formattedPrices);
        console.log('💾 Prices saved to database');
      }

      if (options.file) {
        const timestamp = new Date().toISOString();
        const filename = options.file.includes('.json') ? options.file : `${options.file}.json`;
        const filepath = path.resolve(filename);
        fs.writeFileSync(filepath, JSON.stringify(prices, null, 2));
        console.log(`📄 Prices saved to ${filepath}`);
      }

      if (options.save === false && !options.file) {
        console.log('📋 Sample data:');
        console.log(JSON.stringify(prices.slice(0, 3), null, 2));
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      if (scraper) {
        await scraper.close();
        scraper = null;
      }
    }
  });

program
  .command('companies')
  .description('Scrape all company details')
  .option('--no-save', 'Skip saving to database')
  .option('-f, --file <filename>', 'Save to JSON file')
  .option('-l, --limit <number>', 'Limit number of companies to scrape', parseInt)
  .option('-m, --missing', 'Only scrape companies that don\'t have details in the database yet')
  .option('-s, --symbols <symbols>', 'Scrape specific companies by symbol (comma-separated, e.g., HDL,NABIL)')
  .action(async (options) => {
    try {
      console.log('📋 Getting security IDs...');

      let securityIds;

      if (options.symbols) {
        // Parse comma-separated symbols and trim whitespace
        const symbols = options.symbols.split(',').map(s => s.trim().toUpperCase());
        console.log(`🎯 Filtering for symbols: ${symbols.join(', ')}`);
        securityIds = await getSecurityIdsBySymbols(symbols);

        if (securityIds.length === 0) {
          console.log(`⚠️ No companies found for symbols: ${symbols.join(', ')}`);
          console.log('💡 Make sure these symbols exist in the database. Run "npm run scraper" first.');
          return;
        }

        console.log(`✅ Found ${securityIds.length} matching companies`);
      } else if (options.missing) {
        securityIds = await getSecurityIdsWithoutDetails();
        console.log(`🔍 Found ${securityIds.length} companies without details in database`);
      } else {
        securityIds = await getAllSecurityIds();
        console.log(`📊 Found ${securityIds.length} total companies`);
      }

      if (securityIds.length === 0) {
        if (options.missing) {
          console.log('✅ All companies already have details in the database!');
        } else {
          console.log('⚠️ No security IDs found. Please scrape prices first.');
        }
        return;
      }

      const targetIds = options.limit ? securityIds.slice(0, options.limit) : securityIds;
      console.log(`🏢 Scraping details for ${targetIds.length} companies...`);

      scraper = new NepseScraper();

      const shouldSave = options.save !== false;

      const saveCallback = shouldSave ? async (batch) => {
        const formattedDetails = formatCompanyDetailsForDatabase(batch);
        await insertCompanyDetails(formattedDetails);
      } : null;

      const dividendCallback = shouldSave ? insertDividends : null;
      const financialCallback = shouldSave ? insertFinancials : null;

      const details = await scraper.scrapeAllCompanyDetails(
        targetIds,
        saveCallback,
        dividendCallback,
        financialCallback
      );

      console.log(`✅ Scraped details for ${details.length} companies`);

      if (options.file) {
        const filename = options.file.includes('.json') ? options.file : `${options.file}.json`;
        const filepath = path.resolve(filename);
        fs.writeFileSync(filepath, JSON.stringify(details, null, 2));
        console.log(`📄 Company details saved to ${filepath}`);
      }

      if (options.save === false && !options.file) {
        console.log('📋 Sample data:');
        console.log(JSON.stringify(details.slice(0, 2), null, 2));
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      if (scraper) {
        await scraper.close();
        scraper = null;
      }
    }
  });

program
  .command('ipos')
  .description('Scrape IPO lists from Nepalipaisa')
  .option('-a, --all', 'Scrape all pages')
  .action(async (options) => {
    try {
      console.log('📊 Scraping IPOs...');
      await scrapeIpos(options.all);
      console.log('✅ IPO scraping completed');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('fpos')
  .description('Scrape FPO lists from Nepalipaisa')
  .option('-a, --all', 'Scrape all pages')
  .action(async (options) => {
    try {
      console.log('📊 Scraping FPOs...');
      await scrapeFpos(options.all);
      console.log('✅ FPO scraping completed');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('dividends')
  .description('Scrape announced dividends from Nepalipaisa')
  .option('-a, --all', 'Scrape all pages')
  .action(async (options) => {
    try {
      console.log('📊 Scraping Announced Dividends...');
      await scrapeDividends(options.all);
      console.log('✅ Dividend scraping completed');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('notifications')
  .description('Check and send daily notifications')
  .action(async () => {
    try {
      await NotificationService.checkAndSendNotifications();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('seed')
  .description('Populate initial data (status, prices, missing company details)')
  .option('-q, --quick', 'Only scrape details for a few companies')
  .action(async (options) => {
    try {
      console.log('🌱 Starting manual data seeding...');
      scraper = new NepseScraper();

      // 1. Market Status
      console.log('\n🔍 Phase 1: Fetching market summary...');
      const summary = await scraper.scrapeMarketSummary();
      await saveMarketSummary(summary);
      console.log('✅ Market summary saved');

      // 2. Prices
      console.log('\n📊 Phase 2: Scraping today\'s prices...');
      const prices = await scraper.scrapeTodayPrices();
      const formattedPrices = formatPricesForDatabase(prices);
      await insertTodayPrices(formattedPrices);
      console.log(`✅ ${prices.length} stock prices saved`);

      // 3. Company Details
      console.log('\n🏢 Phase 3: Scraping company details...');
      let securityIds;
      if (options.quick) {
        securityIds = (await getSecurityIdsWithoutDetails()).slice(0, 10);
        console.log(`🎯 Quick mode: Scraping details for ${securityIds.length} missing companies`);
      } else {
        securityIds = await getSecurityIdsWithoutDetails();
        console.log(`🔍 Scraping details for ${securityIds.length} missing companies`);
      }

      if (securityIds.length > 0) {
        await scraper.scrapeAllCompanyDetails(
          securityIds,
          async (batch) => await insertCompanyDetails(formatCompanyDetailsForDatabase(batch)),
          insertDividends,
          insertFinancials
        );
        console.log(`✅ Company details saved`);
      } else {
        console.log('✅ All companies already have details');
      }

      console.log('\n✨ Seeding completed successfully!');
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      process.exit(1);
    } finally {
      if (scraper) {
        await scraper.close();
        scraper = null;
      }
    }
  });

program.parse();

