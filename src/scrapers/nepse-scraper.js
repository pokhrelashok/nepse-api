/**
 * NEPSE Scraper - Backward Compatibility Wrapper
 * 
 * This file maintains backward compatibility by re-exporting
 * from the refactored modular implementation in ./nepse/
 * 
 * All imports from './scrapers/nepse-scraper' will continue to work.
 */

// Re-export everything from the refactored implementation
module.exports = require('./nepse/nepse-scraper');
