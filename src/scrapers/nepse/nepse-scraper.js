const BrowserManager = require('./browser-manager');
const MarketScraper = require('./market-scraper');
const PriceScraper = require('./price-scraper');
const CompanyScraper = require('./company-scraper');
const HistoryScraper = require('./history-scraper');

/**
 * NEPSE Scraper - Integrated scraper using modular components
 * 
 * This class provides a unified interface to all NEPSE scraping functionality
 * by delegating to specialized scraper modules.
 */
class NepseScraper {
  constructor() {
    this.browserManager = new BrowserManager();
    this.marketScraper = new MarketScraper(this.browserManager);
    this.priceScraper = new PriceScraper(this.browserManager);
    this.companyScraper = new CompanyScraper(this.browserManager);
    this.historyScraper = new HistoryScraper(this.browserManager);
  }

  // Browser management methods
  async init() {
    return this.browserManager.init();
  }

  async close() {
    return this.browserManager.close();
  }

  getBrowser() {
    return this.browserManager.getBrowser();
  }

  getUserAgent() {
    return this.browserManager.getUserAgent();
  }

  // Market scraping methods
  async scrapeMarketSummary() {
    return this.marketScraper.scrapeMarketSummary();
  }

  async scrapeMarketStatus(maxRetries = 3) {
    return this.marketScraper.scrapeMarketStatus(maxRetries);
  }

  async scrapeMarketIndex(maxRetries = 3) {
    return this.marketScraper.scrapeMarketIndex(maxRetries);
  }

  async fetchMarketIndexFromAPI() {
    return this.marketScraper.fetchMarketIndexFromAPI();
  }

  // Price scraping methods
  async scrapeTodayPrices(maxRetries = 3) {
    return this.priceScraper.scrapeTodayPrices(maxRetries);
  }

  async scrapeTodayPricesCSVDownload(page) {
    return this.priceScraper.scrapeTodayPricesCSVDownload(page);
  }

  async scrapeTodayPricesAPI(page) {
    return this.priceScraper.scrapeTodayPricesAPI(page);
  }

  async scrapeTodayPricesHTML(page) {
    return this.priceScraper.scrapeTodayPricesHTML(page);
  }

  // Company scraping methods
  async scrapeAllCompanyDetails(securityIds, saveCallback = null, dividendCallback = null, financialCallback = null) {
    return this.companyScraper.scrapeAllCompanyDetails(securityIds, saveCallback, dividendCallback, financialCallback);
  }

  parseApiProfileData(profileData, securityData, symbol) {
    return this.companyScraper.parseApiProfileData(profileData, securityData, symbol);
  }

  // History scraping methods
  async scrapeMarketIndicesHistory(maxRetries = 3) {
    return this.historyScraper.scrapeMarketIndicesHistory(maxRetries);
  }
}

// Export functions for backward compatibility
async function scrapeMarketSummary() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeMarketSummary();
  } finally {
    await scraper.close();
  }
}

async function scrapeMarketStatus() {
  const scraper = new NepseScraper();
  try {
    const summary = await scraper.scrapeMarketSummary();
    return summary.status;
  } finally {
    await scraper.close();
  }
}

async function scrapeTodayPrices() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeTodayPrices();
  } finally {
    await scraper.close();
  }
}

async function scrapeAllCompanyDetails(securityIds, saveCallback = null) {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeAllCompanyDetails(securityIds, saveCallback);
  } finally {
    await scraper.close();
  }
}

async function scrapeMarketIndicesHistory() {
  const scraper = new NepseScraper();
  try {
    return await scraper.scrapeMarketIndicesHistory();
  } finally {
    await scraper.close();
  }
}

// Legacy function name for compatibility
const fetchTodaysPrices = scrapeTodayPrices;

module.exports = {
  NepseScraper,
  scrapeMarketSummary,
  scrapeMarketStatus,
  scrapeTodayPrices,
  scrapeAllCompanyDetails,
  scrapeMarketIndicesHistory,
  fetchTodaysPrices
};
