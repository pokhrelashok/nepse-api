/**
 * Translation Service using OpenRouter API
 * Translates English text to Nepali using DeepSeek LLM via OpenRouter (OpenAI-compatible API)
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');

// In-memory cache to avoid re-translating the same text
const translationCache = new Map();

// Initialize OpenAI client with OpenRouter configuration
let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not set. Translation service will return null for translations.');
      return null;
    }
    client = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: apiKey
    });
  }
  return client;
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

  const openai = getClient();
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gemini-1.5-flash',
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
      // Cache the result
      translationCache.set(cacheKey, translation);
      return translation;
    }

    return null;
  } catch (error) {
    logger.error(`Translation failed for "${text}":`, error.message);
    return null;
  }
}

/**
 * Translate multiple texts to Nepali in batch
 * @param {string[]} texts - Array of English texts to translate
 * @returns {Promise<Object>} Map of original text to Nepali translation
 */
async function translateBatch(texts) {
  const results = {};
  const uniqueTexts = [...new Set(texts.filter(t => t && t.trim()))];

  // Process in batches with rate limiting
  const BATCH_SIZE = 5;
  const DELAY_MS = 200;

  for (let i = 0; i < uniqueTexts.length; i += BATCH_SIZE) {
    const batch = uniqueTexts.slice(i, i + BATCH_SIZE);

    // Translate batch in parallel
    const translations = await Promise.all(
      batch.map(text => translateToNepali(text))
    );

    // Store results
    batch.forEach((text, idx) => {
      results[text] = translations[idx];
    });

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < uniqueTexts.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return results;
}

/**
 * Translate company and sector names for a data object
 * @param {Object} data - Object containing company_name and optionally sector_name
 * @returns {Promise<Object>} Same object with nepali_company_name and nepali_sector_name added
 */
async function translateCompanyData(data) {
  if (!data) return data;

  const updates = {};

  // Translate company name
  if (data.company_name || data.companyName) {
    const companyName = data.company_name || data.companyName;
    updates.nepali_company_name = await translateToNepali(companyName);
  }

  // Translate sector name
  if (data.sector_name || data.sectorName) {
    const sectorName = data.sector_name || data.sectorName;
    updates.nepali_sector_name = await translateToNepali(sectorName);
  }

  return { ...data, ...updates };
}

/**
 * Clear the translation cache
 */
function clearCache() {
  translationCache.clear();
}

/**
 * Get cache size
 */
function getCacheSize() {
  return translationCache.size;
}

module.exports = {
  translateToNepali,
  translateBatch,
  translateCompanyData,
  clearCache,
  getCacheSize
};
