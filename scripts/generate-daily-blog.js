/**
 * Manual Daily Market Blog Generation
 * Run with: bun scripts/generate-daily-blog.js
 */

const { generateDailyMarketBlog } = require('../src/scheduler/ai-analysis-jobs');
const logger = require('../src/utils/logger');

// Mock scheduler object
const mockScheduler = {
  isJobRunning: new Map(),
  updateStatus: (jobKey, status, message) => {
    const icon = status === 'START' ? '🚀' : (status === 'SUCCESS' ? '✅' : '❌');
    console.log(`${icon} [${jobKey}] ${status}: ${message}`);
  }
};

async function runManualBlogGen() {
  console.log('🧪 Starting Manual Daily Market Blog Generation...\n');

  try {
    // Force set to false to ensure it runs
    mockScheduler.isJobRunning.set('daily_market_blog_generation', false);

    await generateDailyMarketBlog(mockScheduler);

    console.log('\n✨ Manual generation process finished.');
  } catch (error) {
    console.error('\n❌ Fatal error during manual generation:', error.message);
  } finally {
    process.exit(0);
  }
}

runManualBlogGen();
