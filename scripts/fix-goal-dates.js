#!/usr/bin/env node

/**
 * Fix existing goals that are missing start_date and end_date
 * This updates all yearly-type goals and dividend_income goals to have proper date ranges
 */

const { pool } = require('../src/database/database');
const logger = require('../src/utils/logger');

async function fixGoalDates() {
  try {
    console.log('🔧 Fixing goal dates for existing goals...\n');

    // Get all goals that should have dates but don't
    const [goals] = await pool.execute(`
      SELECT id, type, metadata, start_date, end_date, created_at
      FROM user_goals
      WHERE (type LIKE 'yearly_%' OR type = 'dividend_income')
      AND (start_date IS NULL OR end_date IS NULL)
    `);

    if (goals.length === 0) {
      console.log('✅ No goals need fixing. All goals have proper dates!');
      return;
    }

    console.log(`📋 Found ${goals.length} goal(s) that need dates:\n`);

    let updated = 0;
    for (const goal of goals) {
      // Parse metadata to get the year
      let metadata = goal.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      // Determine the year
      let year = metadata?.year;
      if (!year) {
        // Try to infer from created_at
        year = new Date(goal.created_at).getFullYear();
        // Update metadata to include the year
        metadata = { ...metadata, year };
      }

      const start_date = `${year}-01-01`;
      const end_date = `${year}-12-31`;

      console.log(`  📅 Updating ${goal.type} (ID: ${goal.id.substring(0, 8)}...)`);
      console.log(`     Year: ${year}, Dates: ${start_date} to ${end_date}`);

      await pool.execute(
        `UPDATE user_goals 
         SET start_date = ?, end_date = ?, metadata = ?
         WHERE id = ?`,
        [start_date, end_date, JSON.stringify(metadata), goal.id]
      );

      updated++;
    }

    console.log(`\n✅ Successfully updated ${updated} goal(s)!`);
    console.log('\n📊 All goals now have proper date ranges for tracking.');

  } catch (error) {
    console.error('❌ Error fixing goal dates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixGoalDates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
