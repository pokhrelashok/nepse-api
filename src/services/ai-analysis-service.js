/**
 * AI Analysis Service using OpenRouter API
 * Generates stock performance summaries using DeepSeek LLM via OpenRouter
 * Optimized for minimal token usage with compact data format
 */

const OpenAI = require('openai');
const { pool } = require('../database/database');
const { DateTime } = require('luxon');
const logger = require('../utils/logger');

// Reuse client initialization from translation service
let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logger.warn('DEEPSEEK_API_KEY not set. AI analysis service will return null.');
      return null;
    }
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://nepse-portfolio.com',
        'X-Title': 'NEPSE Portfolio API'
      }
    });
  }
  return client;
}

/**
 * Generate AI-powered stock performance summary
 * @param {Object} stockData - Stock data including price, financials, dividends
 * @returns {Promise<string|null>} AI-generated summary or null if failed
 */
async function generateStockSummary(stockData) {
  if (!stockData || !stockData.symbol) {
    return null;
  }

  const openai = getClient();
  if (!openai) {
    return null;
  }

  try {
    // Create highly compact data format to minimize tokens
    const compactData = {
      sym: stockData.symbol,
      name: stockData.company_name,
      sec: stockData.sector_name,
      ltp: stockData.last_traded_price || stockData.ltp,
      chg: stockData.price_change,
      chg_pct: stockData.percentage_change,
      h52: stockData.fifty_two_week_high,
      l52: stockData.fifty_two_week_low,
      mcap: stockData.market_capitalization,
      vol: stockData.total_traded_quantity,
      pe: stockData.pe_ratio,
      pb: stockData.pb_ratio,
      eps: stockData.eps,
      div_yield: stockData.dividend_yield
    };

    // Compact prompt optimized for minimal tokens
    const prompt = `Analyze this Nepal stock data and provide a 2-3 sentence performance summary:
${JSON.stringify(compactData)}

Focus on: price trend vs 52w range, valuation (PE if avail), dividend yield, sector context. Be concise and actionable.`;

    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst specializing in Nepal Stock Exchange. Provide concise, actionable stock summaries. Max 3 sentences. IMPORTANT: Always use "रु" (not ₹ or Rs) when mentioning Nepali Rupee currency.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    });

    const summary = response.choices[0]?.message?.content?.trim();

    if (summary) {
      logger.info(`✅ Generated AI summary for ${stockData.symbol}`);
      return summary;
    }

    return null;
  } catch (error) {
    logger.error(`❌ AI summary generation failed for ${stockData.symbol}:`, error.message);
    return null;
  }
}

/**
 * Generate summaries for multiple stocks in batch
 * @param {Array} stocksData - Array of stock data objects
 * @returns {Promise<Object>} Map of symbol to summary
 */
async function generateBatchSummaries(stocksData) {
  const results = {};

  if (!stocksData || stocksData.length === 0) {
    return results;
  }

  // Process in batches with rate limiting
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000; // 1 second between batches

  for (let i = 0; i < stocksData.length; i += BATCH_SIZE) {
    const batch = stocksData.slice(i, i + BATCH_SIZE);

    // Generate summaries in parallel for this batch
    const summaries = await Promise.all(
      batch.map(stock => generateStockSummary(stock))
    );

    // Store results
    batch.forEach((stock, idx) => {
      results[stock.symbol] = summaries[idx];
    });

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < stocksData.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return results;
}

/**
 * Get or generate AI summary for a stock
 * @param {Object} stockData - Stock details from getScriptDetails
 * @returns {Promise<string|null>} Summary content
 */
async function getOrGenerateSummary(stockData) {
  if (!stockData || !stockData.symbol) return null;

  const symbol = stockData.symbol;
  const existingSummary = stockData.ai_summary;
  const updatedAt = stockData.ai_summary_updated_at;
  const businessDate = stockData.business_date; // Format expected: YYYY-MM-DD

  // Check if we need to regenerate
  // 1. No summary exists
  // 2. Summary timestamp is older than the latest trading data (business_date)
  let needsGeneration = !existingSummary || !updatedAt;

  if (!needsGeneration && updatedAt && businessDate) {
    try {
      const summaryDate = DateTime.fromJSDate(new Date(updatedAt)).toISODate();
      if (summaryDate < businessDate) {
        needsGeneration = true;
        logger.info(`🔄 AI summary for ${symbol} is stale (${summaryDate} < ${businessDate}), regenerating...`);
      }
    } catch (e) {
      logger.warn(`Failed to parse summary date for ${symbol}, forcing regeneration`);
      needsGeneration = true;
    }
  }

  if (needsGeneration) {
    const newSummary = await generateStockSummary(stockData);
    if (newSummary) {
      try {
        await pool.execute(
          'UPDATE company_details SET ai_summary = ?, ai_summary_updated_at = NOW() WHERE symbol = ?',
          [newSummary, symbol]
        );
        return newSummary;
      } catch (error) {
        logger.error(`❌ Failed to save AI summary for ${symbol}:`, error.message);
        return newSummary; // Return generated summary anyway
      }
    }
  }

  return existingSummary;
}

module.exports = {
  generateStockSummary,
  generateBatchSummaries,
  getOrGenerateSummary
};
