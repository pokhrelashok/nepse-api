# Phase 2 Completion Guide

**Status:** 40% Complete - Ready for Final Push  
**Remaining:** 2-3 hours of focused work  
**Goal:** Complete NEPSE Scraper refactoring

---

## 📋 What's Done (40%)

✅ **Foundation Complete:**
- `browser-manager.js` (168 lines) - Browser lifecycle
- `utils/constants.js` (8 lines) - URLs
- `utils/parsers.js` (135 lines) - Data formatters
- `market-scraper.js` (145 lines) - Market status (partial)
- `index.js` (45 lines) - Transitional wrapper

---

## 🎯 What's Needed (60%)

### 1. Complete market-scraper.js (30 min)

**Extract from:** `src/scrapers/nepse-scraper.js` lines ~1100-1600

**Methods to add:**
```javascript
async scrapeMarketIndex() {
  // Extract from original file
  // Handles market index data scraping
}

async fetchMarketIndexFromAPI() {
  // Extract from original file
  // API-based market index fetching
}
```

**Key points:**
- Use `this.browserManager` for browser access
- Keep error handling
- Remove verbose comments

---

### 2. Create price-scraper.js (1 hour)

**Extract from:** `src/scrapers/nepse-scraper.js` lines ~296-743

**Structure:**
```javascript
const { TODAY_PRICE_URL } = require('./utils/constants');
const { formatCSVDownloadData, formatAPIData, formatHTMLData } = require('./utils/parsers');

class PriceScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async scrapeTodayPrices(maxRetries = 3) {
    // Main entry point - tries all methods
  }

  async scrapeTodayPricesAPI(page) {
    // API capture method
  }

  async scrapeTodayPricesCSVDownload(page) {
    // CSV download method
  }

  async scrapeTodayPricesHTML(page) {
    // HTML scraping fallback
  }
}

module.exports = PriceScraper;
```

**Lines to extract:** ~450 lines total

---

### 3. Create company-scraper.js (45 min)

**Extract from:** `src/scrapers/nepse-scraper.js` lines ~745-1400

**Structure:**
```javascript
const { parseNumber, cleanText } = require('./utils/parsers');
const { processImageData } = require('../../utils/image-handler');
const { translateToNepali } = require('../../services/translation-service');

class CompanyScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async scrapeAllCompanyDetails(securityIds) {
    // Scrape company details for multiple companies
  }

  parseApiProfileData(profileData, securityData, symbol) {
    // Parse API response data
  }
}

module.exports = CompanyScraper;
```

**Lines to extract:** ~500 lines

---

### 4. Create history-scraper.js (15 min)

**Extract from:** `src/scrapers/nepse-scraper.js` lines ~1600-1800

**Structure:**
```javascript
class HistoryScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async scrapeMarketIndicesHistory(indexId, startDate, endDate) {
    // Scrape historical market data
  }
}

module.exports = HistoryScraper;
```

**Lines to extract:** ~200 lines

---

### 5. Create New NepseScraper Class (30 min)

**File:** `src/scrapers/nepse/nepse-scraper.js`

**Structure:**
```javascript
const BrowserManager = require('./browser-manager');
const MarketScraper = require('./market-scraper');
const PriceScraper = require('./price-scraper');
const CompanyScraper = require('./company-scraper');
const HistoryScraper = require('./history-scraper');

class NepseScraper {
  constructor(options = {}) {
    this.browserManager = new BrowserManager(options);
    this.marketScraper = new MarketScraper(this.browserManager);
    this.priceScraper = new PriceScraper(this.browserManager);
    this.companyScraper = new CompanyScraper(this.browserManager);
    this.historyScraper = new HistoryScraper(this.browserManager);
  }

  async init() {
    return this.browserManager.init();
  }

  async close() {
    return this.browserManager.close();
  }

  // Delegate to scrapers
  async scrapeMarketSummary() {
    return this.marketScraper.scrapeMarketSummary();
  }

  async scrapeMarketStatus(maxRetries) {
    return this.marketScraper.scrapeMarketStatus(maxRetries);
  }

  async scrapeMarketIndex() {
    return this.marketScraper.scrapeMarketIndex();
  }

  async scrapeTodayPrices(maxRetries) {
    return this.priceScraper.scrapeTodayPrices(maxRetries);
  }

  async scrapeAllCompanyDetails(securityIds) {
    return this.companyScraper.scrapeAllCompanyDetails(securityIds);
  }

  async scrapeMarketIndicesHistory(indexId, startDate, endDate) {
    return this.historyScraper.scrapeMarketIndicesHistory(indexId, startDate, endDate);
  }

  // Add other delegated methods...
}

module.exports = NepseScraper;
```

---

### 6. Update index.js (5 min)

**Change from:**
```javascript
const OriginalNepseScraper = require('../nepse-scraper');
module.exports = OriginalNepseScraper;
```

**To:**
```javascript
const NepseScraper = require('./nepse-scraper');
module.exports = NepseScraper;
```

---

## 🧪 Testing Checklist

After completing all modules:

```bash
# 1. Test module loading
node -e "const NepseScraper = require('./src/scrapers/nepse'); console.log('✅ Loads');"

# 2. Test in Docker
docker exec nepse-backend node -e "const NepseScraper = require('./src/scrapers/nepse'); console.log('✅ Works in Docker');"

# 3. Run existing scraper tests (if any)
bun test tests/scraper.test.js

# 4. Test actual scraping (optional)
# Create a test script to verify scrapers work
```

---

## 📝 Implementation Tips

### Best Practices

1. **Extract, don't rewrite** - Copy code from original file
2. **Keep error handling** - Don't simplify error logic
3. **Minimal comments** - Only essential context
4. **Test incrementally** - Test each module as you create it
5. **Use existing patterns** - Follow Phase 1 approach

### Common Patterns

**Constructor:**
```javascript
class SomeScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }
}
```

**Browser access:**
```javascript
await this.browserManager.init();
const browser = this.browserManager.getBrowser();
const userAgent = this.browserManager.getUserAgent();
```

**Imports:**
```javascript
const { NEPSE_URL } = require('./utils/constants');
const { parseNumber } = require('./utils/parsers');
```

---

## 🚀 Quick Start Commands

```bash
# 1. Create the files
touch src/scrapers/nepse/price-scraper.js
touch src/scrapers/nepse/company-scraper.js
touch src/scrapers/nepse/history-scraper.js
touch src/scrapers/nepse/nepse-scraper.js

# 2. Open original file for reference
code src/scrapers/nepse-scraper.js

# 3. Start extracting methods systematically

# 4. Test as you go
node -e "const Scraper = require('./src/scrapers/nepse/price-scraper'); console.log('✅');"

# 5. When done, commit
git add src/scrapers/nepse/
git commit -m "refactor(scraper): Phase 2 complete - NEPSE scraper modularized"
```

---

## 📊 Expected Results

**Before:**
```
src/scrapers/nepse-scraper.js    1,886 lines  🔴
```

**After:**
```
src/scrapers/nepse/
├── nepse-scraper.js              ~100 lines  ✅ (main class)
├── browser-manager.js             168 lines  ✅
├── market-scraper.js              ~300 lines  ✅
├── price-scraper.js               ~500 lines  ✅
├── company-scraper.js             ~500 lines  ✅
├── history-scraper.js             ~200 lines  ✅
├── index.js                        ~50 lines  ✅
└── utils/
    ├── constants.js                  8 lines  ✅
    └── parsers.js                  135 lines  ✅

Average: ~220 lines per module (88% reduction)
```

---

## ✅ Completion Checklist

- [ ] Complete `market-scraper.js` (add 2 methods)
- [ ] Create `price-scraper.js` (4 methods)
- [ ] Create `company-scraper.js` (2 methods)
- [ ] Create `history-scraper.js` (1 method)
- [ ] Create new `nepse-scraper.js` (main class)
- [ ] Update `index.js` to use new class
- [ ] Test all modules load
- [ ] Test in Docker
- [ ] Verify backward compatibility
- [ ] Update `PHASE2_PROGRESS.md` to 100%
- [ ] Commit Phase 2 completion

---

## 🎯 Success Criteria

✅ All scraper methods working  
✅ Backward compatible (existing code works)  
✅ Tests passing  
✅ Docker environment verified  
✅ Original file can be deprecated  

---

**Estimated Time:** 2-3 hours of focused work  
**Difficulty:** Medium (following established patterns)  
**Reward:** Clean, maintainable scraper code! 🎉

---

**You've got this! The foundation is solid, just need to extract the remaining methods systematically.**
