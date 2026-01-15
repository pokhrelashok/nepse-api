#!/usr/bin/env bun

const logger = require('../src/utils/logger');

async function createFakeMergers() {
  try {
    logger.info('🧪 Creating fake merger records for testing...');

    const pool = require('../src/database/database').pool;

    // Fake merger 1: NABIL merging to GBIME at ratio 0.5:1
    const merger1 = {
      merger_acquisition_id: 9999,
      sector_id: 1,
      sector_name: 'Commercial Bank',
      nepali_sector_name: 'वाणिज्य बैंक',
      new_company_name: 'Gbime Bank Limited',
      nepali_new_company_name: 'Gbime Bank Limited',
      new_company_stock_symbol: 'GBIME',
      companies: JSON.stringify([
        {
          name: 'Nabil Bank Limited',
          symbol: 'NABIL',
          nepali_name: 'Nabil Bank Limited'
        },
        {
          name: 'Gbime Bank Limited',
          symbol: 'GBIME',
          nepali_name: 'Gbime Bank Limited'
        }
      ]),
      swap_ratio: '0.5:1',
      mou_date_ad: '2026-01-10',
      mou_date_bs: '2082-09-26',
      final_approval_date_ad: '2026-01-12',
      final_approval_date_bs: '2082-09-28',
      joint_date_ad: '2026-01-15',
      joint_date_bs: '2083-10-01',
      action: 'Merger',
      is_completed: false,
      is_trading: true
    };

    // Fake merger 2: TTL acquires HDL
    const merger2 = {
      merger_acquisition_id: 9998,
      sector_id: 5,
      sector_name: 'Hydropower',
      nepali_sector_name: 'जलविद्युत',
      new_company_name: 'Tanahu Hydropower Limited',
      nepali_new_company_name: 'Tanahu Hydropower Limited',
      new_company_stock_symbol: 'TTL',
      companies: JSON.stringify([
        {
          name: 'Himal Power Limited',
          symbol: 'HDL',
          nepali_name: 'Himal Power Limited'
        },
        {
          name: 'Tanahu Hydropower Limited',
          symbol: 'TTL',
          nepali_name: 'Tanahu Hydropower Limited'
        }
      ]),
      swap_ratio: '1:3',
      mou_date_ad: '2025-12-20',
      mou_date_bs: '2082-09-05',
      final_approval_date_ad: '2026-01-05',
      final_approval_date_bs: '2082-09-21',
      joint_date_ad: '2026-01-08',
      joint_date_bs: '2082-09-24',
      action: 'Acquisition',
      is_completed: false,
      is_trading: true
    };

    // Insert both mergers
    const insertSql = `
      INSERT INTO merger_acquisitions 
      (merger_acquisition_id, sector_id, sector_name, nepali_sector_name, 
       new_company_name, nepali_new_company_name, new_company_stock_symbol,
       companies, swap_ratio, mou_date_ad, mou_date_bs, 
       final_approval_date_ad, final_approval_date_bs, joint_date_ad, joint_date_bs,
       action, is_completed, is_trading)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      companies = VALUES(companies),
      swap_ratio = VALUES(swap_ratio),
      is_completed = VALUES(is_completed)
    `;

    logger.info('\n📝 Inserting Merger 1: NABIL → GBIME (ratio 0.5:1)');
    await pool.execute(insertSql, [
      merger1.merger_acquisition_id, merger1.sector_id, merger1.sector_name, merger1.nepali_sector_name,
      merger1.new_company_name, merger1.nepali_new_company_name, merger1.new_company_stock_symbol,
      merger1.companies, merger1.swap_ratio, merger1.mou_date_ad, merger1.mou_date_bs,
      merger1.final_approval_date_ad, merger1.final_approval_date_bs, merger1.joint_date_ad, merger1.joint_date_bs,
      merger1.action, merger1.is_completed ? 1 : 0, merger1.is_trading ? 1 : 0
    ]);
    logger.info('✅ Merger 1 inserted');

    logger.info('\n📝 Inserting Merger 2: TTL acquires HDL (ratio 1:3)');
    await pool.execute(insertSql, [
      merger2.merger_acquisition_id, merger2.sector_id, merger2.sector_name, merger2.nepali_sector_name,
      merger2.new_company_name, merger2.nepali_new_company_name, merger2.new_company_stock_symbol,
      merger2.companies, merger2.swap_ratio, merger2.mou_date_ad, merger2.mou_date_bs,
      merger2.final_approval_date_ad, merger2.final_approval_date_bs, merger2.joint_date_ad, merger2.joint_date_bs,
      merger2.action, merger2.is_completed ? 1 : 0, merger2.is_trading ? 1 : 0
    ]);
    logger.info('✅ Merger 2 inserted');

    // Test the query
    logger.info('\n--- Testing getRecentMergersForSymbols ---\n');
    const { getRecentMergersForSymbols } = require('../src/database/queries');

    const testSymbols = ['NABIL', 'HDL', 'GBIME', 'TTL'];
    const mergers = await getRecentMergersForSymbols(testSymbols);

    logger.info(`\n📊 Query Results for symbols: ${testSymbols.join(', ')}`);
    if (Object.keys(mergers).length === 0) {
      logger.info('❌ No mergers found');
    } else {
      for (const [symbol, symbolMergers] of Object.entries(mergers)) {
        logger.info(`\n${symbol}:`);
        symbolMergers.forEach(merger => {
          logger.info(`  📋 ${merger.new_company_name}`);
          logger.info(`     Action: ${merger.action}`);
          logger.info(`     Ratio: ${merger.swap_ratio}`);
          logger.info(`     Joint Date: ${merger.joint_date_ad}`);
          logger.info(`     Companies:`);
          if (Array.isArray(merger.companies)) {
            merger.companies.forEach(c => {
              logger.info(`       - ${c.symbol}: ${c.name}`);
            });
          }
        });
      }
    }

    logger.info('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

createFakeMergers();
