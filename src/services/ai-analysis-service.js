/**
 * AI Analysis Service using OpenRouter API
 * Generates stock performance summaries using DeepSeek LLM via OpenRouter
 * Optimized for minimal token usage with compact data format
 */

const OpenAI = require('openai');
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
          content: 'You are a financial analyst. Provide concise, actionable stock summaries. Max 3 sentences.'
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

module.exports = {
  generateStockSummary,
  generateBatchSummaries
};
