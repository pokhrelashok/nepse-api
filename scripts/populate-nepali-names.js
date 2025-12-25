#!/usr/bin/env node

/**
 * Backfill Script: Populate Nepali Company Names
 * 
 * This script translates existing company names and sector names to Nepali
 * using the DeepSeek API for records that don't have Nepali translations yet.
 * 
 * Usage:
 *   node scripts/populate-nepali-names.js [--all] [--table=TABLE_NAME]
 * 
 * Options:
 *   --all           Process all records (including those with existing translations)
 *   --table=NAME    Only process specific table (company_details, ipos, announced_dividends)
 */

require('dotenv').config();

const { pool } = require('../src/database/database');
const { translateToNepali, getCacheSize, clearCache } = require('../src/services/translation-service');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  success: (...args) => console.log('[SUCCESS]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args)
};

// Parse command line arguments
const args = process.argv.slice(2);
const processAll = args.includes('--all');
const tableArg = args.find(a => a.startsWith('--table='));
const specificTable = tableArg ? tableArg.split('=')[1] : null;

async function populateCompanyDetails(processExisting = false) {
  logger.info('Processing company_details table...');

  const whereClause = processExisting
    ? 'WHERE company_name IS NOT NULL'
    : 'WHERE company_name IS NOT NULL AND (nepali_company_name IS NULL OR nepali_sector_name IS NULL)';

  const [rows] = await pool.execute(`
    SELECT security_id, symbol, company_name, sector_name, nepali_company_name, nepali_sector_name 
    FROM company_details 
    ${whereClause}
  `);

  logger.info(`Found ${rows.length} records to process`);

  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const updates = {};

    // Translate company name if missing
    if (!row.nepali_company_name && row.company_name) {
      const translated = await translateToNepali(row.company_name);
      if (translated) updates.nepali_company_name = translated;
    }

    // Translate sector name if missing
    if (!row.nepali_sector_name && row.sector_name) {
      const translated = await translateToNepali(row.sector_name);
      if (translated) updates.nepali_sector_name = translated;
    }

    // Update if we have translations
    if (Object.keys(updates).length > 0) {
      const setClauses = [];
      const values = [];

      if (updates.nepali_company_name) {
        setClauses.push('nepali_company_name = ?');
        values.push(updates.nepali_company_name);
      }
      if (updates.nepali_sector_name) {
        setClauses.push('nepali_sector_name = ?');
        values.push(updates.nepali_sector_name);
      }

      if (setClauses.length > 0) {
        values.push(row.security_id);

        await pool.execute(
          `UPDATE company_details SET ${setClauses.join(', ')} WHERE security_id = ?`,
          values
        );

        updated++;
        logger.info(`[${i + 1}/${rows.length}] ${row.symbol}: ${updates.nepali_company_name || '(name skip)'} | ${updates.nepali_sector_name || '(sector skip)'}`);
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }

    // Rate limiting delay
    if (i % 10 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  logger.success(`company_details: Updated ${updated} records, skipped ${skipped}`);
  return updated;
}

async function populateIpos(processExisting = false) {
  logger.info('Processing ipos table...');

  const whereClause = processExisting
    ? 'WHERE company_name IS NOT NULL'
    : 'WHERE company_name IS NOT NULL AND (nepali_company_name IS NULL OR nepali_sector_name IS NULL)';

  const [rows] = await pool.execute(`
    SELECT ipo_id, company_name, sector_name, nepali_company_name, nepali_sector_name 
    FROM ipos 
    ${whereClause}
  `);

  logger.info(`Found ${rows.length} records to process`);

  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const updates = {};

    if (!row.nepali_company_name && row.company_name) {
      const translated = await translateToNepali(row.company_name);
      if (translated) updates.nepali_company_name = translated;
    }

    if (!row.nepali_sector_name && row.sector_name) {
      const translated = await translateToNepali(row.sector_name);
      if (translated) updates.nepali_sector_name = translated;
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = [];
      const values = [];

      if (updates.nepali_company_name) {
        setClauses.push('nepali_company_name = ?');
        values.push(updates.nepali_company_name);
      }
      if (updates.nepali_sector_name) {
        setClauses.push('nepali_sector_name = ?');
        values.push(updates.nepali_sector_name);
      }

      if (setClauses.length > 0) {
        values.push(row.ipo_id);

        await pool.execute(
          `UPDATE ipos SET ${setClauses.join(', ')} WHERE ipo_id = ?`,
          values
        );

        updated++;
        logger.info(`[${i + 1}/${rows.length}] IPO ${row.ipo_id}: ${updates.nepali_company_name || '(skip)'}`);
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }

    if (i % 10 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  logger.success(`ipos: Updated ${updated} records, skipped ${skipped}`);
  return updated;
}

async function populateAnnouncedDividends(processExisting = false) {
  logger.info('Processing announced_dividends table...');

  const whereClause = processExisting
    ? 'WHERE company_name IS NOT NULL'
    : 'WHERE company_name IS NOT NULL AND nepali_company_name IS NULL';

  const [rows] = await pool.execute(`
    SELECT id, symbol, company_name, nepali_company_name 
    FROM announced_dividends 
    ${whereClause}
  `);

  logger.info(`Found ${rows.length} records to process`);

  let updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.nepali_company_name && row.company_name) {
      const nepaliName = await translateToNepali(row.company_name);

      if (nepaliName) {
        await pool.execute(
          'UPDATE announced_dividends SET nepali_company_name = ? WHERE id = ?',
          [nepaliName, row.id]
        );

        updated++;
        logger.info(`[${i + 1}/${rows.length}] ${row.symbol}: ${nepaliName}`);
      }
    }

    if (i % 10 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  logger.success(`announced_dividends: Updated ${updated} records`);
  return updated;
}

async function main() {
  logger.info('=== Nepali Names Backfill Script ===');
  logger.info(`Mode: ${processAll ? 'Process ALL records' : 'Process missing translations only'}`);

  if (!process.env.DEEPSEEK_API_KEY) {
    logger.error('DEEPSEEK_API_KEY environment variable is not set!');
    logger.error('Please set it in your .env file and try again.');
    process.exit(1);
  }

  logger.info('DeepSeek API key found. Starting translation...\n');

  let totalUpdated = 0;

  try {
    if (!specificTable || specificTable === 'company_details') {
      totalUpdated += await populateCompanyDetails(processAll);
      console.log('');
    }

    if (!specificTable || specificTable === 'ipos') {
      totalUpdated += await populateIpos(processAll);
      console.log('');
    }

    if (!specificTable || specificTable === 'announced_dividends') {
      totalUpdated += await populateAnnouncedDividends(processAll);
      console.log('');
    }

    logger.success(`=== Backfill Complete ===`);
    logger.success(`Total records updated: ${totalUpdated}`);
    logger.info(`Translation cache size: ${getCacheSize()} entries`);

  } catch (error) {
    logger.error('Backfill failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }

  process.exit(0);
}

main();
