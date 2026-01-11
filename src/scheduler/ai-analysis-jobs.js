const logger = require('../utils/logger');
const HolidayService = require('../services/holiday-service');
const { pool } = require('../database/database');
const { getScriptDetails } = require('../database/queries');
const { generateBatchSummaries } = require('../services/ai-analysis-service');

/**
 * Generate AI summaries for active stocks
 * Called at 4:00 PM daily (after market close and data archiving)
 */
async function generateStockSummaries(scheduler) {
  const jobKey = 'ai_summary_generation';

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping AI stock summary generation: Today is a market holiday');
    return;
  }

  // Prevent overlapping runs
  if (scheduler.isJobRunning.get(jobKey)) {
    logger.warn(`${jobKey} is already running, skipping...`);
    return;
  }

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Starting AI stock summary generation...');

  try {
    // Get all active companies with recent price data
    const sql = `
      SELECT DISTINCT cd.symbol
      FROM company_details cd
      WHERE cd.status = 'A' 
        AND cd.last_traded_price > 0
        AND cd.market_capitalization > 0
      ORDER BY cd.market_capitalization DESC
      LIMIT 100
    `;

    const [companies] = await pool.execute(sql);

    if (!companies || companies.length === 0) {
      const msg = 'No active companies found for AI summary generation';
      scheduler.updateStatus(jobKey, 'SUCCESS', msg);
      return;
    }

    logger.info(`📊 Generating AI summaries for ${companies.length} companies...`);

    // Fetch full details for each company
    const stocksData = [];
    for (const company of companies) {
      const details = await getScriptDetails(company.symbol);
      if (details) {
        stocksData.push(details);
      }
    }

    // Generate summaries in batches
    const summaries = await generateBatchSummaries(stocksData);

    // Update database with generated summaries
    let successCount = 0;
    let failCount = 0;

    for (const [symbol, summary] of Object.entries(summaries)) {
      if (summary) {
        try {
          await pool.execute(
            'UPDATE company_details SET ai_summary = ? WHERE symbol = ?',
            [summary, symbol]
          );
          successCount++;
        } catch (error) {
          logger.error(`Failed to save AI summary for ${symbol}:`, error.message);
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    const msg = `Generated and saved ${successCount} AI summaries (${failCount} failed)`;
    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
    logger.info(`✅ ${msg}`);
  } catch (error) {
    logger.error('❌ AI summary generation failed:', error);
    scheduler.updateStatus(jobKey, 'FAIL', error.message);
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  generateStockSummaries
};
