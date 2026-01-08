# Project Structure - Before & After Refactoring

## Current Structure (Before)

```
Nepse-Portfolio-Api/
├── src/
│   ├── config/
│   │   ├── firebase.js
│   │   └── redis.js
│   │
│   ├── controllers/
│   │   ├── admin/
│   │   ├── alertController.js
│   │   ├── companyController.js
│   │   ├── feedbackController.js
│   │   ├── marketController.js (413 lines) 🟢
│   │   └── schedulerController.js
│   │
│   ├── database/
│   │   ├── admin/
│   │   ├── apiKeyQueries.js
│   │   ├── database.js (425 lines) 🟢
│   │   ├── feedbackQueries.js
│   │   ├── migrate.js
│   │   └── queries.js (1,627 lines) 🔴 NEEDS REFACTORING
│   │
│   ├── middleware/
│   │   ├── apiKeyAuth.js
│   │   └── auth.js
│   │
│   ├── routes/
│   │   ├── admin/
│   │   ├── alerts.js
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── feedback.js
│   │   └── portfolio.js (1,078 lines) 🔴 NEEDS REFACTORING
│   │
│   ├── scrapers/
│   │   ├── dividend-scraper.js
│   │   ├── fpo-scraper.js
│   │   ├── ipo-scraper.js
│   │   └── nepse-scraper.js (1,886 lines) 🔴 NEEDS REFACTORING
│   │
│   ├── services/
│   │   ├── notification-service.js (594 lines) 🟡 NEEDS REFACTORING
│   │   └── translation-service.js
│   │
│   ├── utils/
│   │   ├── formatter.js
│   │   ├── image-handler.js
│   │   ├── logger.js
│   │   ├── share-type-utils.js
│   │   └── system-metrics.js
│   │
│   ├── index.js
│   ├── scheduler.js (880 lines) 🟡 NEEDS REFACTORING
│   └── server.js
│
├── tests/
├── migrations/
├── public/
└── package.json
```

---

## Proposed Structure (After)

```
Nepse-Portfolio-Api/
├── src/
│   ├── config/
│   │   ├── firebase.js
│   │   └── redis.js
│   │
│   ├── controllers/
│   │   ├── admin/
│   │   ├── alertController.js
│   │   ├── companyController.js
│   │   ├── feedbackController.js
│   │   ├── marketController.js (413 lines) 🟢
│   │   └── schedulerController.js
│   │
│   ├── database/
│   │   ├── admin/
│   │   ├── queries/                           ✨ NEW MODULAR STRUCTURE
│   │   │   ├── index.js                       (~50 lines)
│   │   │   ├── stock-queries.js               (~200 lines) ✅
│   │   │   ├── market-queries.js              (~300 lines) ✅
│   │   │   ├── company-queries.js             (~200 lines) ✅
│   │   │   ├── ipo-queries.js                 (~150 lines) ✅
│   │   │   ├── dividend-queries.js            (~200 lines) ✅
│   │   │   ├── alert-queries.js               (~200 lines) ✅
│   │   │   ├── scheduler-queries.js           (~100 lines) ✅
│   │   │   └── sector-queries.js              (~150 lines) ✅
│   │   ├── apiKeyQueries.js
│   │   ├── database.js (425 lines) 🟢
│   │   ├── feedbackQueries.js
│   │   └── migrate.js
│   │
│   ├── middleware/
│   │   ├── apiKeyAuth.js
│   │   └── auth.js
│   │
│   ├── routes/
│   │   ├── admin/
│   │   ├── portfolio/                         ✨ NEW MODULAR STRUCTURE
│   │   │   ├── index.js                       (~100 lines)
│   │   │   ├── portfolio-routes.js            (~200 lines) ✅
│   │   │   ├── transaction-routes.js          (~300 lines) ✅
│   │   │   ├── holdings-routes.js             (~300 lines) ✅
│   │   │   ├── sync-routes.js                 (~200 lines) ✅
│   │   │   └── validation.js                  (~100 lines) ✅
│   │   ├── alerts.js
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── feedback.js
│   │
│   ├── scrapers/
│   │   ├── nepse/                             ✨ NEW MODULAR STRUCTURE
│   │   │   ├── index.js                       (~150 lines)
│   │   │   ├── browser-manager.js             (~200 lines) ✅
│   │   │   ├── market-scraper.js              (~400 lines) ✅
│   │   │   ├── price-scraper.js               (~500 lines) ✅
│   │   │   ├── company-scraper.js             (~500 lines) ✅
│   │   │   ├── history-scraper.js             (~200 lines) ✅
│   │   │   └── utils/
│   │   │       ├── parsers.js                 (~100 lines) ✅
│   │   │       └── constants.js               (~50 lines) ✅
│   │   ├── dividend-scraper.js
│   │   ├── fpo-scraper.js
│   │   └── ipo-scraper.js
│   │
│   ├── scheduler/                             ✨ NEW MODULAR STRUCTURE
│   │   ├── index.js                           (~150 lines)
│   │   ├── scheduler-state.js                 (~100 lines) ✅
│   │   ├── scheduler-utils.js                 (~50 lines) ✅
│   │   └── jobs/
│   │       ├── price-update-job.js            (~200 lines) ✅
│   │       ├── market-index-job.js            (~100 lines) ✅
│   │       ├── company-details-job.js         (~100 lines) ✅
│   │       ├── scraper-jobs.js                (~150 lines) ✅
│   │       ├── archive-jobs.js                (~100 lines) ✅
│   │       ├── cleanup-job.js                 (~100 lines) ✅
│   │       ├── backup-job.js                  (~50 lines) ✅
│   │       └── notification-job.js            (~50 lines) ✅
│   │
│   ├── services/
│   │   ├── notification/                      ✨ NEW MODULAR STRUCTURE
│   │   │   ├── index.js                       (~100 lines)
│   │   │   ├── price-alert-notifier.js        (~100 lines) ✅
│   │   │   ├── ipo-notifier.js                (~150 lines) ✅
│   │   │   ├── dividend-notifier.js           (~100 lines) ✅
│   │   │   ├── right-share-notifier.js        (~100 lines) ✅
│   │   │   ├── token-manager.js               (~50 lines) ✅
│   │   │   └── formatters.js                  (~50 lines) ✅
│   │   └── translation-service.js
│   │
│   ├── utils/
│   │   ├── formatter.js
│   │   ├── image-handler.js
│   │   ├── logger.js
│   │   ├── share-type-utils.js
│   │   └── system-metrics.js
│   │
│   ├── index.js
│   └── server.js
│
├── tests/
├── migrations/
├── public/
├── REFACTORING_PLAN.md                        ✨ NEW
├── CODE_SIZE_ANALYSIS.md                      ✨ NEW
├── REFACTORING_QUICKSTART.md                  ✨ NEW
└── package.json
```

---

## Key Changes Summary

### 1. Database Queries Module
**Before:** 1 monolithic file (1,627 lines)  
**After:** 9 focused modules (~160 lines each)

### 2. NEPSE Scraper Module
**Before:** 1 monolithic file (1,886 lines)  
**After:** 8 focused modules (~235 lines each)

### 3. Portfolio Routes Module
**Before:** 1 monolithic file (1,078 lines)  
**After:** 6 focused modules (~180 lines each)

### 4. Scheduler Module
**Before:** 1 monolithic file (880 lines)  
**After:** 11 focused modules (~80 lines each)

### 5. Notification Service Module
**Before:** 1 monolithic file (594 lines)  
**After:** 7 focused modules (~85 lines each)

---

## File Count Comparison

| Category | Before | After | Change |
|----------|--------|-------|--------|
| Database queries | 1 file | 9 files | +8 files |
| NEPSE scraper | 1 file | 8 files | +7 files |
| Portfolio routes | 1 file | 6 files | +5 files |
| Scheduler | 1 file | 11 files | +10 files |
| Notification service | 1 file | 7 files | +6 files |
| **Total** | **5 files** | **41 files** | **+36 files** |

---

## Benefits of New Structure

### 🎯 **Better Organization**
- Related code grouped together
- Clear module boundaries
- Easier to navigate

### 📖 **Improved Readability**
- Smaller, focused files
- Less scrolling
- Easier to understand

### 🧪 **Enhanced Testability**
- Individual modules can be tested in isolation
- Easier to mock dependencies
- Better test coverage

### 🤝 **Better Collaboration**
- Fewer merge conflicts
- Easier code reviews
- Clear ownership

### 🤖 **AI-Friendly**
- Reduced context size
- Faster AI processing
- More accurate suggestions

### 🔧 **Easier Maintenance**
- Bugs easier to locate
- Changes more isolated
- Refactoring safer

---

## Import Changes

### Before
```javascript
// Importing from monolithic file
const queries = require('./database/queries');
const { NepseScraper } = require('./scrapers/nepse-scraper');
const Scheduler = require('./scheduler');
```

### After
```javascript
// Importing from modular structure (backward compatible)
const queries = require('./database/queries'); // index.js re-exports all
const { NepseScraper } = require('./scrapers/nepse'); // index.js re-exports
const Scheduler = require('./scheduler'); // index.js re-exports

// Or import specific modules directly
const stockQueries = require('./database/queries/stock-queries');
const marketScraper = require('./scrapers/nepse/market-scraper');
const priceUpdateJob = require('./scheduler/jobs/price-update-job');
```

---

## Migration Path

1. ✅ **Phase 1**: Database Queries (Week 1)
2. ⏳ **Phase 2**: NEPSE Scraper (Week 2)
3. ⏳ **Phase 3**: Portfolio Routes (Week 3)
4. ⏳ **Phase 4**: Scheduler (Week 4)
5. ⏳ **Phase 5**: Notification Service (Week 5)

Each phase is:
- Independently committable
- Backward compatible
- Fully tested
- Rollback-able

---

## Legend

- 🔴 Critical - Needs immediate refactoring (> 1000 lines)
- 🟡 High - Should be refactored (500-1000 lines)
- 🟢 OK - Current size is manageable (< 500 lines)
- ✨ New - Created during refactoring
- ✅ Refactored - Successfully modularized
