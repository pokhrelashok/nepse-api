/**
 * Unified AI Service
 * Handles all AI-related operations: Stock Summaries, Portfolio Analysis, and Blog Generation.
 * Uses OpenRouter API with DeepSeek LLM for optimal performance and cost.
 */

const OpenAI = require('openai');
const { pool } = require('../database/database');
const { DateTime } = require('luxon');
const logger = require('../utils/logger');

// Singleton client instances
let deepseekClient = null;
let geminiClient = null;
let blogAIClient = null;
let activeBlogProvider = null;  // Track which provider is actually being used

// In-memory cache for translations
const translationCache = new Map();

// Configuration for blog generation AI
// Default to deepseek, with fallback to gemini
const BLOG_AI_PROVIDER = process.env.BLOG_AI_PROVIDER || 'deepseek'; // 'gemini', 'deepseek'
const BLOG_AI_MODEL = process.env.BLOG_AI_MODEL || 'deepseek/deepseek-chat';

/**
 * Initialize and get the DeepSeek client (for stock/portfolio summaries)
 * @returns {OpenAI|null} The DeepSeek client instance
 */
function getDeepSeekClient() {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      logger.warn('DEEPSEEK_API_KEY not set. Stock/Portfolio summaries will not work.');
      return null;
    }

    deepseekClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      maxRetries: 5,
      timeout: 30000
    });
  }
  return deepseekClient;
}

/**
 * Initialize and get the Gemini client (for blog generation)
 * @returns {OpenAI|null} The Gemini client instance
 */
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not set. Blog generation will not work.');
      return null;
    }

    geminiClient = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: apiKey,
      maxRetries: 5,
      timeout: 30000
    });
  }
  return geminiClient;
}



/**
 * Get the configured AI client for blog generation with fallback support
 * @returns {OpenAI|null} The configured AI client instance
 */
function getBlogAIClient() {
  if (blogAIClient) {
    return blogAIClient;
  }

  // Try the configured provider first
  let client = null;
  let actualProvider = BLOG_AI_PROVIDER;

  switch (BLOG_AI_PROVIDER.toLowerCase()) {
    case 'gemini':
      client = getGeminiClient();
      break;
    case 'deepseek':
      client = getDeepSeekClient();
      break;
    default:
      logger.warn(`Unknown BLOG_AI_PROVIDER: ${BLOG_AI_PROVIDER}, trying DeepSeek as default`);
      client = getDeepSeekClient();
      actualProvider = 'deepseek';
  }

  // Fallback chain: DeepSeek -> Gemini
  if (!client) {
    logger.warn(`${actualProvider} client not available, trying fallback providers...`);

    if (actualProvider !== 'deepseek') {
      client = getDeepSeekClient();
      if (client) {
        actualProvider = 'deepseek';
        logger.info('Using DeepSeek as fallback for blog generation');
      }
    }

    if (!client && actualProvider !== 'gemini') {
      client = getGeminiClient();
      if (client) {
        actualProvider = 'gemini';
        logger.info('Using Gemini as fallback for blog generation');
      }
    }
  }

  if (client) {
    blogAIClient = client;
    activeBlogProvider = actualProvider;  // Store the actual provider being used
    logger.info(`Blog AI initialized with provider: ${actualProvider}, model: ${BLOG_AI_MODEL}`);
  }

  return blogAIClient;
}

const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Get the appropriate model name based on the provider
 * @param {string} provider - The AI provider name
 * @returns {string} The model name to use
 */
function getBlogAIModel(provider) {
  // If a custom model is specified, use it
  if (process.env.BLOG_AI_MODEL) {
    return process.env.BLOG_AI_MODEL;
  }

  // Default models for each provider
  switch (provider.toLowerCase()) {
    case 'gemini':
      return 'gemini-2.0-flash';
    case 'deepseek':
      return 'deepseek/deepseek-chat';
    default:
      return 'deepseek/deepseek-chat';
  }
}

/**
 * Translate a single text to Nepali
 * @param {string} text - English text to translate
 * @returns {Promise<string|null>} Nepali translation or null if failed
 */
async function translateToNepali(text) {
  if (!text || text.trim() === '') {
    return null;
  }

  // Check cache first
  const cacheKey = text.toLowerCase().trim();
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const openai = getGeminiClient();
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: GEMINI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a translator. Translate the given English text to Nepali (Devanagari script). Return ONLY the Nepali translation, nothing else. Do not include any explanations or additional text.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    const translation = response.choices[0]?.message?.content?.trim();

    if (translation) {
      translationCache.set(cacheKey, translation);
      return translation;
    }

    return null;
  } catch (error) {
    logger.error(`❌ Translation failed for "${text}":`, error.message);
    return null;
  }
}

/**
 * Translate multiple texts to Nepali in batch
 */
async function translateBatch(texts) {
  const results = {};
  const uniqueTexts = [...new Set(texts.filter(t => t && t.trim()))];

  const BATCH_SIZE = 5;
  const DELAY_MS = 200;

  for (let i = 0; i < uniqueTexts.length; i += BATCH_SIZE) {
    const batch = uniqueTexts.slice(i, i + BATCH_SIZE);
    const translations = await Promise.all(
      batch.map(text => translateToNepali(text))
    );

    batch.forEach((text, idx) => {
      results[text] = translations[idx];
    });

    if (i + BATCH_SIZE < uniqueTexts.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return results;
}

/**
 * Translate company and sector names for a data object
 */
async function translateCompanyData(data) {
  if (!data) return data;

  const updates = {};

  // Only translate company name if it's missing or empty
  if ((data.company_name || data.companyName) && !data.nepali_company_name && !data.nepaliCompanyName) {
    const companyName = data.company_name || data.companyName;
    updates.nepali_company_name = await translateToNepali(companyName);
  } else if (data.nepali_company_name || data.nepaliCompanyName) {
    updates.nepali_company_name = data.nepali_company_name || data.nepaliCompanyName;
  }

  // Only translate sector name if it's missing or empty
  if ((data.sector_name || data.sectorName) && !data.nepali_sector_name && !data.nepaliSectorName) {
    const sectorName = data.sector_name || data.sectorName;
    updates.nepali_sector_name = await translateToNepali(sectorName);
  } else if (data.nepali_sector_name || data.nepaliSectorName) {
    updates.nepali_sector_name = data.nepali_sector_name || data.nepaliSectorName;
  }

  return { ...data, ...updates };
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

  const openai = getDeepSeekClient();
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
    const prompt = `Analyze Nepal stock:
${JSON.stringify(compactData)}

Provide 2 sentences: price trend, valuation, outlook.`;

    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst for Nepal Stock Exchange. Provide concise, actionable stock summaries in exactly 2-3 sentences. Always use "रु" (not ₹ or Rs) for Nepali Rupee currency.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 70
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

  const openai = getDeepSeekClient();
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

    const prompt = `Portfolio "${portfolioName}":
${JSON.stringify(compactHoldings)}

JSON format:
{"sentiment_score": 1-100, "summary": "2 sentences: top movers, advice"}`;

    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a portfolio manager for Nepal Stock Exchange. Provide concise portfolio analysis in JSON format. Use "रु" for currency.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 70,
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
async function generateBlogPost(topic, category, blogType = 'informative') {
  const client = getBlogAIClient();
  if (!client) {
    throw new Error('No AI service configured. Please set GEMINI_API_KEY or DEEPSEEK_API_KEY in environment variables.');
  }

  // Use the actual provider that was determined by getBlogAIClient
  const provider = activeBlogProvider || BLOG_AI_PROVIDER.toLowerCase();
  const model = getBlogAIModel(provider);

  // Define blog type instructions
  const blogTypeInstructions = {
    'informative': 'Write an educational, fact-based article that explains concepts clearly with examples.',
    'tutorial': 'Write a step-by-step guide with numbered instructions, actionable tips, and clear examples.',
    'news': 'Write a news-style article covering recent developments, market analysis, and implications.',
    'opinion': 'Write an editorial/commentary piece with analysis, insights, and well-reasoned perspectives.',
    'beginner': 'Write for absolute beginners with simple language, basic concepts, and foundational knowledge.',
    'advanced': 'Write an in-depth analysis with technical details, advanced concepts, and expert-level insights.'
  };

  const typeInstruction = blogTypeInstructions[blogType] || blogTypeInstructions['informative'];

  try {
    const prompt = `
      Write a comprehensive, SEO-optimized blog post in English for a global and Nepali audience about: "${topic}".
      Category: ${category}.
      Blog Type: ${blogType.toUpperCase()}
      
      WRITING STYLE FOR THIS TYPE:
      ${typeInstruction}
      
      The content should be relevant to the Nepal Stock Exchange (NEPSE) if applicable.
      
      Return the response strictly as a JSON object with the following fields:
      - title: The blog title (should reflect the blog type)
      - content: The full blog content in Markdown format (use headers, lists, etc.)
      - excerpt: A short summary (2-3 sentences)
      - tags: An array of 5-8 relevant tags
      - meta_title: SEO title (under 60 chars)
      - meta_description: SEO description (under 160 chars)
      
      Ensure the tone matches the blog type while remaining professional.
      IMPORTANT: The whole response must be in English. No Nepali characters should be used in the content, except during explicit translations if requested.
      Make the content engaging, informative, and detailed according to the blog type specified.
    `;

    logger.info(`Generating blog with ${provider} using model: ${model}`);

    const requestOptions = {
      messages: [{ role: "user", content: prompt }],
      model: model,
    };

    // Only add response_format for models that support it (DeepSeek and Gemini)
    if (provider === 'deepseek' || provider === 'gemini') {
      requestOptions.response_format = { type: "json_object" };
    }

    const completion = await client.chat.completions.create(requestOptions);

    let content = completion.choices[0].message.content;
    // Strip markdown code blocks if present (e.g. ```json ... ```)
    content = content.replace(/```json\n?|```/g, '').trim();

    const result = JSON.parse(content);
    logger.info('Blog post generated successfully');
    return result;
  } catch (error) {
    logger.error(`Error generating blog post with ${provider}:`, error.message);

    // More detailed error message
    if (error.response) {
      logger.error('API Response Error:', error.response.data);
    }

    throw new Error(`Failed to generate blog content: ${error.message}`);
  }
}

/**
 * Generate a daily market summary blog post
 * @param {Object} marketData - Object containing index data and top movers
 * @returns {Promise<Object>} - Generated blog content
 */
async function generateDailyMarketSummaryBlog(marketData) {
  // Use DeepSeek as primary, with Gemini as fallback
  let client = getDeepSeekClient();
  let provider = 'deepseek';
  let model = DEEPSEEK_MODEL;

  if (!client) {
    logger.warn('DeepSeek not available for market summary blog, trying Gemini fallback...');
    client = getGeminiClient();
    provider = 'gemini';
    model = GEMINI_MODEL;
  }

  if (!client) {
    throw new Error('AI Service not configured. Please set DEEPSEEK_API_KEY or GEMINI_API_KEY in environment variables.');
  }

  try {
    const { index, gainers, losers } = marketData;

    const prompt = `
      Write a daily market summary blog post in English for the Nepal Stock Exchange (NEPSE) based on the following data:
      
      Market Index: ${index.nepse_index} (${index.index_change > 0 ? '+' : ''}${index.index_change}, ${index.index_percentage_change}%)
      Total Turnover: रु ${index.total_turnover}
      Total Traded Shares: ${index.total_traded_shares}
      Market Breadth: ${index.advanced} Advanced, ${index.declined} Declined, ${index.unchanged} Unchanged
      
      Top Gainers: ${gainers.slice(0, 5).map(g => `${g.symbol} (+${g.percentage_change}%)`).join(', ')}
      Top Losers: ${losers.slice(0, 5).map(l => `${l.symbol} (${l.percentage_change}%)`).join(', ')}
      
      Return the response strictly as a JSON object with the following fields:
      - title: A compelling title for today's market summary
      - content: The full market summary in Markdown format (including analysis of index movement, turnover, and top stocks)
      - excerpt: A short summary (2-3 sentences)
      - tags: An array of 5-8 relevant tags (e.g. #NEPSE, #MarketSummary, #StocksNepal)
      - meta_title: SEO title (under 60 chars)
      - meta_description: SEO description (under 160 chars)
      
      Ensure the tone is analytical yet readable. Use "रु" for currency.
      IMPORTANT: The whole response, including the title and excerpt, MUST be in English.
      Provide a deep dive into what the turnover and breadth movements signify for the next trading day.
    `;

    logger.info(`Generating daily market summary with ${provider} using model: ${model}`);

    const completion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: model,
      response_format: { type: "json_object" },
    });

    let content = completion.choices[0].message.content;
    content = content.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    logger.error('Error generating daily market summary blog:', error);
    throw new Error('Failed to generate daily market summary content');
  }
}

module.exports = {
  translateToNepali,
  translateBatch,
  translateCompanyData,
  generateStockSummary,
  generateBatchSummaries,
  getOrGenerateSummary,
  generatePortfolioSummary,
  generateBlogPost,
  generateDailyMarketSummaryBlog
};
