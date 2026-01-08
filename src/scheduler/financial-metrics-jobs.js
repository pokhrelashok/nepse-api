const { updateMetricsForAll } = require('../services/financial-metrics-service');
const logger = require('../utils/logger');

/**
 * Job to calculate financial metrics for all active companies
 * This should run after market close and before AI analysis
 */
async function calculateFinancialMetrics(scheduler) {
  logger.info('🕒 Starting scheduled financial metrics calculation...');

  try {
    const summary = await updateMetricsForAll();

    logger.info(`✅ Scheduled financial metrics update complete: ${summary.success} succeeded, ${summary.failed} failed`);

    if (summary.failed > 0) {
      logger.warn(`⚠️ ${summary.failed} companies failed to update metrics`);
    }
  } catch (error) {
    logger.error('❌ Scheduled financial metrics update failed:', error);
  }
}

module.exports = {
  calculateFinancialMetrics
};
