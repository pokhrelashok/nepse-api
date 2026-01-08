# Refactoring Plan - Code Organization

## Overview
Several files have grown too large (1000+ lines) and need to be split into smaller, more maintainable modules to reduce AI context usage and improve code organization.

## Files Requiring Refactoring

### 1. **src/database/queries.js** (1,627 lines) - HIGHEST PRIORITY
**Current Size:** 52KB, 47 functions

**Proposed Structure:**
```
src/database/
├── queries/
│   ├── index.js                    # Main export file
│   ├── stock-queries.js            # Stock-related queries
│   ├── market-queries.js           # Market index & status queries
│   ├── company-queries.js          # Company details queries
│   ├── ipo-queries.js              # IPO & FPO queries
│   ├── dividend-queries.js         # Dividend queries
│   ├── alert-queries.js            # Price alert queries
│   ├── portfolio-queries.js        # Portfolio & transaction queries
│   ├── scheduler-queries.js        # Scheduler status queries
│   └── sector-queries.js           # Sector breakdown queries
```

**Function Distribution:**
- **stock-queries.js** (~200 lines):
  - `getAllSecurityIds`, `getSecurityIdsWithoutDetails`, `getSecurityIdsBySymbols`
  - `searchStocks`, `getScriptDetails`, `getLatestPrices`
  - `getIntradayData`, `insertTodayPrices`
  - `getStockHistory`

- **market-queries.js** (~300 lines):
  - `saveMarketSummary`, `updateMarketStatus`, `saveMarketIndex`
  - `getCurrentMarketStatus`, `getMarketIndexData`, `getLatestMarketIndexData`
  - `getMarketIndexHistory`, `getIntradayMarketIndex`
  - `getMarketIndicesHistory`, `getMarketStatusHistory`
  - `saveMarketIndexHistory`

- **company-queries.js** (~200 lines):
  - `getAllCompanies`, `getCompaniesBySector`
  - `getTopCompaniesByMarketCap`, `getCompanyStats`
  - `insertCompanyDetails`, `insertFinancials`

- **ipo-queries.js** (~150 lines):
  - `insertIpo`, `getIpos`

- **dividend-queries.js** (~200 lines):
  - `insertDividends`, `insertAnnouncedDividends`
  - `getAnnouncedDividends`, `getRecentBonusForSymbols`
  - `findPublishedDate`

- **alert-queries.js** (~200 lines):
  - `createPriceAlert`, `getUserPriceAlerts`, `updatePriceAlert`
  - `deletePriceAlert`, `getActivePriceAlerts`
  - `markAlertTriggered`, `updateAlertState`
  - `getUserHoldingWACC`

- **scheduler-queries.js** (~100 lines):
  - `saveSchedulerStatus`, `getSchedulerStatus`

- **sector-queries.js** (~150 lines):
  - `getSectorBreakdown`

- **index.js** (~50 lines):
  - Re-export all functions from sub-modules

---

### 2. **src/scrapers/nepse-scraper.js** (1,886 lines) - HIGH PRIORITY
**Current Size:** 74KB, 40 functions

**Proposed Structure:**
```
src/scrapers/
├── nepse/
│   ├── index.js                    # Main NepseScraper class & exports
│   ├── browser-manager.js          # Browser initialization & management
│   ├── market-scraper.js           # Market status & index scraping
│   ├── price-scraper.js            # Today's prices scraping (CSV, API, HTML)
│   ├── company-scraper.js          # Company details scraping
│   ├── history-scraper.js          # Historical data scraping
│   └── utils/
│       ├── parsers.js              # Number parsing, data formatting utilities
│       └── constants.js            # URLs and constants
```

**Module Distribution:**
- **browser-manager.js** (~200 lines):
  - Browser initialization logic
  - `init()`, `close()` methods
  - Puppeteer configuration

- **market-scraper.js** (~400 lines):
  - `scrapeMarketSummary`, `scrapeMarketStatus`
  - `scrapeMarketIndex`, `fetchMarketIndexFromAPI`

- **price-scraper.js** (~500 lines):
  - `scrapeTodayPrices`, `scrapeTodayPricesCSVDownload`
  - `scrapeTodayPricesAPI`, `scrapeTodayPricesHTML`
  - `formatCSVDownloadData`, `formatAPIData`, `formatHTMLData`

- **company-scraper.js** (~500 lines):
  - `scrapeAllCompanyDetails`
  - `parseApiProfileData`

- **history-scraper.js** (~200 lines):
  - `scrapeMarketIndicesHistory`

- **parsers.js** (~100 lines):
  - Common parsing utilities
  - Number formatters
  - Data cleaners

---

### 3. **src/routes/portfolio.js** (1,078 lines) - HIGH PRIORITY
**Current Size:** 37KB, 65+ route handlers

**Proposed Structure:**
```
src/routes/
├── portfolio/
│   ├── index.js                    # Main router
│   ├── portfolio-routes.js         # Portfolio CRUD routes
│   ├── transaction-routes.js       # Transaction CRUD routes
│   ├── holdings-routes.js          # Holdings & analytics routes
│   ├── sync-routes.js              # Sync endpoints
│   └── validation.js               # Shared validation logic
```

**Route Distribution:**
- **portfolio-routes.js** (~200 lines):
  - GET /api/portfolios
  - POST /api/portfolios
  - PUT /api/portfolios/:id
  - DELETE /api/portfolios/:id

- **transaction-routes.js** (~300 lines):
  - GET /api/portfolios/:id/transactions
  - POST /api/portfolios/:id/transactions
  - PUT /api/portfolios/:id/transactions/:txId
  - DELETE /api/portfolios/:id/transactions/:txId

- **holdings-routes.js** (~300 lines):
  - GET /api/portfolios/:id/holdings
  - GET /api/portfolios/:id/analytics
  - GET /api/portfolios/:id/performance

- **sync-routes.js** (~200 lines):
  - GET /api/portfolios/sync
  - POST /api/portfolios/sync

- **validation.js** (~100 lines):
  - Shared validation schemas
  - Validation helper functions

---

### 4. **src/scheduler.js** (880 lines) - MEDIUM PRIORITY
**Current Size:** 32KB, 25 functions

**Proposed Structure:**
```
src/scheduler/
├── index.js                        # Main Scheduler class
├── jobs/
│   ├── price-update-job.js         # Price update scheduling
│   ├── market-index-job.js         # Market index updates
│   ├── company-details-job.js      # Company details updates
│   ├── scraper-jobs.js             # IPO, FPO, Dividend scrapers
│   ├── archive-jobs.js             # Daily archiving jobs
│   ├── cleanup-job.js              # System cleanup
│   ├── backup-job.js               # Database backup
│   └── notification-job.js         # Notification checks
├── scheduler-state.js              # State management & stats
└── scheduler-utils.js              # Helper utilities
```

**Module Distribution:**
- **index.js** (~150 lines):
  - Main Scheduler class
  - Job orchestration
  - Start/stop methods

- **price-update-job.js** (~200 lines):
  - `startPriceUpdateSchedule`
  - `updatePricesAndStatus`

- **market-index-job.js** (~100 lines):
  - `updateMarketIndex`

- **company-details-job.js** (~100 lines):
  - `updateCompanyDetails`

- **scraper-jobs.js** (~150 lines):
  - `runIpoScrape`, `runFpoScrape`, `runDividendScrape`

- **archive-jobs.js** (~100 lines):
  - `archiveDailyPrices`, `archiveMarketIndex`

- **cleanup-job.js** (~100 lines):
  - `runSystemCleanup`

- **backup-job.js** (~50 lines):
  - `runDatabaseBackup`

- **notification-job.js** (~50 lines):
  - `runNotificationCheck`

---

### 5. **src/services/notification-service.js** (594 lines) - MEDIUM PRIORITY
**Current Size:** 21KB, 16 functions

**Proposed Structure:**
```
src/services/
├── notification/
│   ├── index.js                    # Main NotificationService class
│   ├── price-alert-notifier.js     # Price alert notifications
│   ├── ipo-notifier.js             # IPO notifications
│   ├── dividend-notifier.js        # Dividend notifications
│   ├── right-share-notifier.js     # Right share notifications
│   ├── token-manager.js            # FCM token management
│   └── formatters.js               # Notification message formatters
```

**Module Distribution:**
- **index.js** (~100 lines):
  - Main NotificationService class
  - `checkAndSendNotifications` orchestrator

- **price-alert-notifier.js** (~100 lines):
  - `checkAndSendPriceAlerts`
  - `sendPriceAlertNotification`

- **ipo-notifier.js** (~150 lines):
  - `processNewIpos`
  - `processIpoClosingReminders`
  - `sendIpoNotification`
  - `sendIpoClosingNotification`

- **dividend-notifier.js** (~100 lines):
  - `processNewDividends`
  - `sendDividendNotification`

- **right-share-notifier.js** (~100 lines):
  - `processNewRightShares`
  - `sendRightShareNotification`

- **token-manager.js** (~50 lines):
  - `handleFailedTokens`

- **formatters.js** (~50 lines):
  - `formatDate`
  - Message formatting utilities

---

## Implementation Strategy

### Phase 1: Database Queries (Week 1)
1. Create `src/database/queries/` directory
2. Split functions into respective modules
3. Create index.js with re-exports
4. Update all imports across the codebase
5. Test all endpoints

### Phase 2: NEPSE Scraper (Week 2)
1. Create `src/scrapers/nepse/` directory
2. Extract browser management logic
3. Split scraping methods by domain
4. Extract common utilities
5. Update scheduler and other consumers
6. Test all scraping jobs

### Phase 3: Portfolio Routes (Week 3)
1. Create `src/routes/portfolio/` directory
2. Split routes by resource type
3. Extract validation logic
4. Update main router
5. Test all portfolio endpoints

### Phase 4: Scheduler (Week 4)
1. Create `src/scheduler/` directory
2. Extract individual jobs
3. Refactor state management
4. Update scheduler initialization
5. Test all scheduled jobs

### Phase 5: Notification Service (Week 5)
1. Create `src/services/notification/` directory
2. Extract notification type handlers
3. Extract token management
4. Extract formatters
5. Update scheduler and other consumers
6. Test all notification types

## Priority Order

Based on file size, complexity, and impact on AI context:

1. **HIGHEST**: `src/database/queries.js` (1,627 lines) - Most referenced file
2. **HIGH**: `src/scrapers/nepse-scraper.js` (1,886 lines) - Complex scraping logic
3. **HIGH**: `src/routes/portfolio.js` (1,078 lines) - Many route handlers
4. **MEDIUM**: `src/scheduler.js` (880 lines) - Job orchestration
5. **MEDIUM**: `src/services/notification-service.js` (594 lines) - Notification logic


## Benefits

1. **Reduced AI Context**: Smaller files are easier for AI to process
2. **Better Organization**: Related code grouped together
3. **Easier Maintenance**: Smaller files are easier to understand and modify
4. **Improved Testability**: Individual modules can be tested in isolation
5. **Better Collaboration**: Reduced merge conflicts
6. **Clearer Dependencies**: Explicit imports show relationships

## Backward Compatibility

All refactoring will maintain backward compatibility:
- Existing imports will continue to work via index.js re-exports
- No API changes
- No database schema changes
- No breaking changes to consumers

## Testing Strategy

For each phase:
1. Run existing test suite
2. Manual testing of affected endpoints
3. Integration testing
4. Performance testing (ensure no regression)

## Rollback Plan

Each phase will be committed separately, allowing easy rollback if issues arise.

---

## Next Steps

1. Review and approve this plan
2. Create feature branch for refactoring
3. Begin Phase 1 implementation
4. Iterative review and testing
