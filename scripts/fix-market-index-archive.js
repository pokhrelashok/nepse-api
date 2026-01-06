#!/usr/bin/env node
/**
 * Fix Market Index Archive
 * 
 * This script fixes market_indices_history records that have closing_index = 0 
 * by pulling the correct data from market_index table.
 * 
 * Usage: node scripts/fix-market-index-archive.js [date]
 * Example: node scripts/fix-market-index-archive.js 2026-01-06
 */

const { pool } = require('../src/database/database');

async function fixMarketIndexArchive(targetDate = null) {
  const connection = await pool.getConnection();

  try {
    // If no date provided, find all records with closing_index = 0
    let datesToFix = [];

    if (targetDate) {
      datesToFix = [targetDate];
    } else {
      // Find all problematic records
      const [rows] = await connection.execute(`
        SELECT DISTINCT business_date 
        FROM market_indices_history 
        WHERE closing_index = 0 OR closing_index IS NULL
        ORDER BY business_date DESC
      `);
      datesToFix = rows.map(r => r.business_date instanceof Date
        ? r.business_date.toISOString().split('T')[0]
        : r.business_date);
    }

    if (datesToFix.length === 0) {
      console.log('✅ No records with closing_index = 0 found.');
      return { fixed: 0, dates: [] };
    }

    console.log(`📋 Found ${datesToFix.length} dates to fix:`, datesToFix);

    let fixedCount = 0;
    const fixedDates = [];

    for (const dateStr of datesToFix) {
      // Get correct data from market_index table
      const [indexRows] = await connection.execute(`
        SELECT nepse_index, index_change, index_percentage_change,
               total_turnover, total_traded_shares
        FROM market_index 
        WHERE trading_date = ?
        ORDER BY last_updated DESC
        LIMIT 1
      `, [dateStr]);

      if (indexRows.length === 0 || !indexRows[0].nepse_index || parseFloat(indexRows[0].nepse_index) <= 0) {
        console.log(`⚠️ No valid data found in market_index for ${dateStr}, skipping...`);
        continue;
      }

      const correctData = indexRows[0];
      console.log(`📊 Found correct data for ${dateStr}: NEPSE Index = ${correctData.nepse_index}`);

      // Update market_indices_history
      const [updateResult] = await connection.execute(`
        UPDATE market_indices_history
        SET closing_index = ?,
            turnover_value = ?,
            turnover_volume = ?,
            abs_change = ?,
            percentage_change = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE business_date = ? AND exchange_index_id = 58
      `, [
        parseFloat(correctData.nepse_index),
        parseFloat(correctData.total_turnover) || 0,
        parseFloat(correctData.total_traded_shares) || 0,
        parseFloat(correctData.index_change) || 0,
        parseFloat(correctData.index_percentage_change) || 0,
        dateStr
      ]);

      if (updateResult.affectedRows > 0) {
        console.log(`✅ Fixed ${dateStr}: closing_index = ${correctData.nepse_index}`);
        fixedCount++;
        fixedDates.push(dateStr);
      } else {
        // Record doesn't exist, insert it
        const [insertResult] = await connection.execute(`
          INSERT INTO market_indices_history (
            business_date, exchange_index_id, index_name, closing_index,
            open_index, high_index, low_index, fifty_two_week_high,
            fifty_two_week_low, turnover_value, turnover_volume,
            total_transaction, abs_change, percentage_change
          ) VALUES (?, 58, 'NEPSE Index', ?, 0, 0, 0, 0, 0, ?, ?, 0, ?, ?)
        `, [
          dateStr,
          parseFloat(correctData.nepse_index),
          parseFloat(correctData.total_turnover) || 0,
          parseFloat(correctData.total_traded_shares) || 0,
          parseFloat(correctData.index_change) || 0,
          parseFloat(correctData.index_percentage_change) || 0
        ]);

        if (insertResult.affectedRows > 0) {
          console.log(`✅ Inserted ${dateStr}: closing_index = ${correctData.nepse_index}`);
          fixedCount++;
          fixedDates.push(dateStr);
        }
      }
    }

    console.log(`\n📊 Summary: Fixed ${fixedCount} records`);
    return { fixed: fixedCount, dates: fixedDates };

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  const targetDate = process.argv[2] || null;

  fixMarketIndexArchive(targetDate)
    .then(result => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { fixMarketIndexArchive };
