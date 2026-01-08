/**
 * NEPSE Scraper - Main Entry Point
 * 
 * Refactored modular scraper with full backward compatibility.
 * 
 * Status: Phase 2 - Complete ✅
 * - Browser management: ✅ Complete
 * - Utilities: ✅ Complete
 * - Market scraper: ✅ Complete
 * - Price scraper: ✅ Complete
 * - Company scraper: ✅ Complete
 * - History scraper: ✅ Complete
 * - Integration: ✅ Complete
 */

// Import the new integrated scraper
const {
  NepseScraper,
  scrapeMarketSummary,
  scrapeMarketStatus,
  scrapeTodayPrices,
  scrapeAllCompanyDetails,
  scrapeMarketIndicesHistory,
  fetchTodaysPrices
} = require('./nepse-scraper');

// Export modules for direct use
const BrowserManager = require('./browser-manager');
const MarketScraper = require('./market-scraper');
const PriceScraper = require('./price-scraper');
const CompanyScraper = require('./company-scraper');
const HistoryScraper = require('./history-scraper');
const { parseNumber, cleanText, formatCSVDownloadData, formatAPIData, formatHTMLData } = require('./utils/parsers');
const { NEPSE_URL, TODAY_PRICE_URL } = require('./utils/constants');

// Main export - the new integrated class with backward compatibility
module.exports = {
  NepseScraper,
  scrapeMarketSummary,
  scrapeMarketStatus,
  scrapeTodayPrices,
  scrapeAllCompanyDetails,
  scrapeMarketIndicesHistory,
  fetchTodaysPrices
};

// Named exports for modular access
module.exports.NepseScraper = NepseScraper;
module.exports.BrowserManager = BrowserManager;
module.exports.MarketScraper = MarketScraper;
module.exports.PriceScraper = PriceScraper;
module.exports.CompanyScraper = CompanyScraper;
module.exports.HistoryScraper = HistoryScraper;
module.exports.utils = {
  parseNumber,
  cleanText,
  formatCSVDownloadData,
  formatAPIData,
  formatHTMLData
};
module.exports.constants = {
  NEPSE_URL,
  TODAY_PRICE_URL
};

