// Modular query exports
// This index file re-exports all query functions from their respective modules

// Import from specialized modules
const stockQueries = require('./stock-queries');
const companyQueries = require('./company-queries');
const schedulerQueries = require('./scheduler-queries');
const sipQueries = require('./sip-queries');
const marketQueries = require('./market-queries');
const ipoQueries = require('./ipo-queries');
const dividendQueries = require('./dividend-queries');
const alertQueries = require('./alert-queries');
const sectorQueries = require('./sector-queries');
const blogQueries = require('./blog-queries');
const goalQueries = require('./goal-queries');
const mergerQueries = require('./merger-queries');

// Re-export all functions
module.exports = {
  // Stock queries
  ...stockQueries,

  // Company queries
  ...companyQueries,

  // Scheduler queries
  ...schedulerQueries,

  // SIP queries
  ...sipQueries,

  // SIP queries
  ...sipQueries,

  // Market queries
  ...marketQueries,

  // IPO queries
  ...ipoQueries,

  // Dividend queries
  ...dividendQueries,

  // Alert queries
  ...alertQueries,

  // Sector queries
  ...sectorQueries,

  // Blog queries
  ...blogQueries,

  // Goal queries
  ...goalQueries,

  // Merger queries
  ...mergerQueries
};
