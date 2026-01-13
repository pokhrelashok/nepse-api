const logger = require('../utils/logger');
const HolidayService = require('../services/holiday-service');
const { pool } = require('../database/database');
const { getScriptDetails } = require('../database/queries');
const aiService = require('../services/ai-service');

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
    const summaries = await aiService.generateBatchSummaries(stocksData);

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

/**
 * Generate a daily market summary blog post
 * Called at 4:30 PM daily (after market close and all data archiving)
 */
async function generateDailyMarketBlog(scheduler) {
  const jobKey = 'daily_market_blog_generation';

  // Holiday check
  if (await HolidayService.isHoliday()) {
    logger.info('Skipping daily market blog generation: Today is a market holiday');
    return;
  }

  // Prevent overlapping runs
  if (scheduler.isJobRunning.get(jobKey)) {
    logger.warn(`${jobKey} is already running, skipping...`);
    return;
  }

  scheduler.isJobRunning.set(jobKey, true);
  scheduler.updateStatus(jobKey, 'START', 'Starting daily market blog generation...');

  try {
    const { getLatestMarketIndexData, getLatestPrices } = require('../database/queries');
    const { slugify } = require('../utils/formatter');

    // 1. Fetch market data
    const indexData = await getLatestMarketIndexData();
    if (!indexData) {
      throw new Error('Latest market index data not found');
    }

    const gainers = await getLatestPrices(null, { filter: 'gainers', limit: 10, sortBy: 'percentage_change', order: 'DESC' });
    const losers = await getLatestPrices(null, { filter: 'losers', limit: 10, sortBy: 'percentage_change', order: 'ASC' });

    // 2. Generate blog content via AI
    const marketData = {
      index: indexData,
      gainers,
      losers
    };

    logger.info('Generating daily market summary blog via AI...');
    const generatedBlog = await aiService.generateDailyMarketSummaryBlog(marketData);

    // 3. Prepare blog record
    const title = generatedBlog.title;
    const baseSlug = slugify(title);
    const dateStr = indexData.trading_date || new Date().toISOString().split('T')[0];
    const slug = `${baseSlug}-${dateStr}`;

    const [result] = await pool.execute(
      `INSERT INTO blogs (title, slug, content, excerpt, category, tags, is_published, published_at, meta_title, meta_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         content = VALUES(content),
         excerpt = VALUES(excerpt),
         updated_at = NOW()`,
      [
        title,
        slug,
        generatedBlog.content,
        generatedBlog.excerpt,
        'market_update',
        JSON.stringify(generatedBlog.tags || []),
        1, // Published by default
        new Date(),
        generatedBlog.meta_title,
        generatedBlog.meta_description
      ]
    );

    const msg = `Daily market blog generated and published: ${title}`;
    scheduler.updateStatus(jobKey, 'SUCCESS', msg);
    logger.info(`✅ ${msg}`);

  } catch (error) {
    // If it's a duplicate slug for the same day, we can ignore or update
    if (error.code === 'ER_DUP_ENTRY') {
      logger.warn('Daily market blog already exists for today, skipped or updated.');
      scheduler.updateStatus(jobKey, 'SUCCESS', 'Daily market blog already exists for today');
    } else {
      logger.error('❌ Daily market blog generation failed:', error);
      scheduler.updateStatus(jobKey, 'FAIL', error.message);
    }
  } finally {
    scheduler.isJobRunning.set(jobKey, false);
  }
}

module.exports = {
  generateStockSummaries,
  generateDailyMarketBlog
};
