#!/usr/bin/env node

/**
 * Run migration to add portfolio_id to user_goals table
 */

const { pool } = require('../src/database/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Running migration: add portfolio_id to user_goals...\n');

    const migrationFile = path.join(__dirname, '../migrations/2026_01_13_000002_add_portfolio_to_goals.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      await pool.execute(statement);
      console.log('✅ Success\n');
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Changes made:');
    console.log('  - Added portfolio_id column to user_goals table');
    console.log('  - Added foreign key constraint to portfolios table');
    console.log('  - Added indexes for better query performance');
    console.log('  - NULL portfolio_id means goal tracks all portfolios\n');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists - migration may have already been run');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
