/**
 * Main Queries Module
 * 
 * This file serves as a barrel export for all database query functions.
 * All query logic has been organized into specialized modules in the ./queries directory:
 * 
 * - stock-queries.js: Stock and security related queries, prices, and intraday data
 * - company-queries.js: Company details and statistics
 * - market-queries.js: Market status and index queries
 * - ipo-queries.js: IPO related queries
 * - dividend-queries.js: Dividend related queries
 * - alert-queries.js: Price alert queries
 * - scheduler-queries.js: Scheduler status queries
 * - sector-queries.js: Sector breakdown and analysis
 * 
 * This improves maintainability by:
 * - Separating concerns into focused modules
 * - Making it easier to locate and update specific query logic
 * - Reducing file size and cognitive load
 * - Enabling better testing and code organization
 */

// Re-export all query functions from the modular structure
module.exports = require('./queries/index');
