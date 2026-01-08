/**
 * Backfill Financial Metrics
 * One-time script to calculate and populate financial metrics for all existing companies
 * Run with: bun scripts/backfill-financial-metrics.js
 */

const { updateMetricsForAll } = require('../src/services/financial-metrics-service');
const logger = require('../src/utils/logger');

async function backfillMetrics() {
  console.log('🔄 Starting financial metrics backfill...\n');

  try {
    const summary = await updateMetricsForAll();

    console.log('\n✅ Backfill complete!');
    console.log(`   Total companies: ${summary.total}`);
    console.log(`   Successfully updated: ${summary.success}`);
    console.log(`   Failed: ${summary.failed}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

backfillMetrics();
