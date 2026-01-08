/**
 * NEPSE Scraper - Main Entry Point
 * 
 * This is a transitional wrapper that maintains backward compatibility
 * while we complete the modularization of the scraper.
 * 
 * Current Status: Phase 2 - Partial Refactoring
 * - Browser management: ✅ Extracted
 * - Utilities: ✅ Extracted  
 * - Market scraper: 🚧 Partial
 * - Price scraper: ⏳ Pending
 * - Company scraper: ⏳ Pending
 * - History scraper: ⏳ Pending
 * 
 * For now, this exports the original NepseScraper class.
 * Once all modules are complete, this will integrate them.
 */

// Temporarily export the original scraper
const OriginalNepseScraper = require('../nepse-scraper');

// Export modules for direct use if needed
const BrowserManager = require('./browser-manager');
const MarketScraper = require('./market-scraper');
const { parseNumber, cleanText, formatCSVDownloadData, formatAPIData, formatHTMLData } = require('./utils/parsers');
const { NEPSE_URL, TODAY_PRICE_URL } = require('./utils/constants');

// Main export - currently the original class
module.exports = OriginalNepseScraper;

// Named exports for modular access
module.exports.BrowserManager = BrowserManager;
module.exports.MarketScraper = MarketScraper;
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
