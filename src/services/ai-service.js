/**
 * Unified AI Service
 * Handles all AI-related operations: Stock Summaries, Portfolio Analysis, and Blog Generation.
 * Uses OpenRouter API with DeepSeek LLM for optimal performance and cost.
 */

const OpenAI = require('openai');
const { pool } = require('../database/database');
const { DateTime } = require('luxon');
const logger = require('../utils/logger');

// Singleton client instance
let client = null;

/**
 * Initialize and get the OpenAI/OpenRouter/Gemini client
 * @returns {OpenAI|null} The OpenAI client instance
 */
function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      logger.warn('AI API Key (GEMINI or OPENAI) not set. AI service will return null.');
      return null;
    }

    let baseURL = process.env.OPENAI_BASE_URL;
    // Default to Google's OpenAI-compatible endpoint if using Gemini key
    if (process.env.GEMINI_API_KEY) {
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    }

    client = new OpenAI({
      baseURL: baseURL,
      apiKey: apiKey
    });
  }
  return client;
}

const DEFAULT_MODEL = process.env.AI_MODEL || 'gemini-1.5-flash';

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
      model: process.env.AI_MODEL || DEFAULT_MODEL,
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
      max_tokens: 150,
      response_format: { type: "json_object" }
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
  // 3. Summary was generated on a previous day (daily refresh)
  let needsGeneration = !existingSummary || !updatedAt;

  if (!needsGeneration && updatedAt) {
    try {
      const nepalNow = DateTime.now().setZone('Asia/Kathmandu');
      const todayDate = nepalNow.toISODate();
      const summaryDate = DateTime.fromJSDate(new Date(updatedAt)).setZone('Asia/Kathmandu').toISODate();

      // Check if it's a new day
      if (summaryDate < todayDate) {
        needsGeneration = true;
        logger.info(`🔄 AI summary for ${symbol} is old (${summaryDate} < ${todayDate}), regenerating daily...`);
      }
      // Check if business data is newer than summary (fallback)
      else if (businessDate && summaryDate < businessDate) {
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

/**
 * Generate AI-powered portfolio performance summary
 * @param {string} portfolioName - Name of the portfolio
 * @param {Array} holdings - Array of holdings with symbols, quantities, and stock data
 * @returns {Promise<Object|null>} AI-generated summary and sentiment score or null
 */
async function generatePortfolioSummary(portfolioName, holdings) {
  if (!holdings || holdings.length === 0) {
    return null;
  }

  const openai = getClient();
  if (!openai) {
    return null;
  }

  try {
    // Create compact holdings data for the prompt
    const compactHoldings = holdings.map(h => ({
      sym: h.symbol,
      qty: h.quantity,
      val: h.current_value,
      chg: h.price_change_pct,
      sec: h.sector,
      sum: h.ai_summary ? (h.ai_summary.substring(0, 100) + '...') : 'N/A'
    }));

    const prompt = `Analyze this Nepal stock portfolio "${portfolioName}" and provide a summary:
${JSON.stringify(compactHoldings)}

Provide:
1. A Sentiment Score (1-100) based on overall performance and sector outlook.
2. A 3-4 sentence performance summary highlighting top performers, laggards, and diversification.
3. Actionable advice.

IMPORTANT: Respond ONLY in JSON format like this:
{
  "sentiment_score": 75,
  "summary": "Your summary text here..."
}`;

    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a senior portfolio manager for the Nepal Stock Exchange. Provide professional, data-driven portfolio analysis in JSON format. Use "रु" for currency.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    const result = JSON.parse(content || '{}');
    if (result.summary && result.sentiment_score) {
      return result;
    }
    return null;
  } catch (error) {
    logger.error(`❌ Portfolio AI summary generation failed for ${portfolioName}:`, error.message);
    return null;
  }
}

/**
 * Generate a blog post using AI
 * @param {string} topic - The topic or title of the blog
 * @param {string} category - The category of the blog
 * @returns {Promise<Object>} - Generated blog content
 */
async function generateBlogPost(topic, category) {
  const openai = getClient();
  if (!openai) {
    throw new Error('AI Service not configured');
  }

  try {
    const prompt = `
      Write a comprehensive, SEO-optimized blog post for a Nepali audience about: "${topic}".
      Category: ${category}.
      
      The content should be educational, easy to understand, and relevant to the Nepal Stock Exchange (NEPSE) if applicable.
      
      Return the response strictly as a JSON object with the following fields:
      - title: The blog title
      - content: The full blog content in Markdown format (use headers, lists, etc.)
      - excerpt: A short summary (2-3 sentences)
      - tags: An array of 5-8 relevant tags
      - meta_title: SEO title (under 60 chars)
      - meta_description: SEO description (under 160 chars)
      
      Ensure the tone is professional yet accessible.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      response_format: { type: "json_object" },
    });

    let content = completion.choices[0].message.content;
    // Strip markdown code blocks if present (e.g. ```json ... ```)
    content = content.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    logger.error('Error generating blog post:', error);
    throw new Error('Failed to generate blog content');
  }
}

module.exports = {
  generateStockSummary,
  generateBatchSummaries,
  getOrGenerateSummary,
  generatePortfolioSummary,
  generateBlogPost
};
