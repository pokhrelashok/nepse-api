# Code Size Analysis & Refactoring Impact

## Current State - Large Files

| File | Lines | Size | Functions | Status |
|------|-------|------|-----------|--------|
| `src/scrapers/nepse-scraper.js` | 1,886 | 74 KB | 40 | 🔴 Critical |
| `src/database/queries.js` | 1,627 | 52 KB | 47 | 🔴 Critical |
| `src/routes/portfolio.js` | 1,078 | 37 KB | 65+ | 🔴 Critical |
| `src/scheduler.js` | 880 | 32 KB | 25 | 🟡 High |
| `src/services/notification-service.js` | 594 | 21 KB | 16 | 🟡 High |
| `src/database/database.js` | 425 | 14 KB | 10 | 🟢 OK |
| `src/controllers/marketController.js` | 413 | 12 KB | 13 | 🟢 OK |

**Total lines in files requiring refactoring: 6,063 lines**

---

## Projected State - After Refactoring

### 1. Database Queries Module
**Before:** 1 file, 1,627 lines  
**After:** 10 files, avg ~160 lines per file

```
queries/
├── index.js                    (~50 lines)
├── stock-queries.js            (~200 lines)
├── market-queries.js           (~300 lines)
├── company-queries.js          (~200 lines)
├── ipo-queries.js              (~150 lines)
├── dividend-queries.js         (~200 lines)
├── alert-queries.js            (~200 lines)
├── scheduler-queries.js        (~100 lines)
└── sector-queries.js           (~150 lines)
```

### 2. NEPSE Scraper Module
**Before:** 1 file, 1,886 lines  
**After:** 8 files, avg ~235 lines per file

```
nepse/
├── index.js                    (~150 lines)
├── browser-manager.js          (~200 lines)
├── market-scraper.js           (~400 lines)
├── price-scraper.js            (~500 lines)
├── company-scraper.js          (~500 lines)
├── history-scraper.js          (~200 lines)
└── utils/
    ├── parsers.js              (~100 lines)
    └── constants.js            (~50 lines)
```

### 3. Portfolio Routes Module
**Before:** 1 file, 1,078 lines  
**After:** 6 files, avg ~180 lines per file

```
portfolio/
├── index.js                    (~100 lines)
├── portfolio-routes.js         (~200 lines)
├── transaction-routes.js       (~300 lines)
├── holdings-routes.js          (~300 lines)
├── sync-routes.js              (~200 lines)
└── validation.js               (~100 lines)
```

### 4. Scheduler Module
**Before:** 1 file, 880 lines  
**After:** 11 files, avg ~80 lines per file

```
scheduler/
├── index.js                    (~150 lines)
├── scheduler-state.js          (~100 lines)
├── scheduler-utils.js          (~50 lines)
└── jobs/
    ├── price-update-job.js     (~200 lines)
    ├── market-index-job.js     (~100 lines)
    ├── company-details-job.js  (~100 lines)
    ├── scraper-jobs.js         (~150 lines)
    ├── archive-jobs.js         (~100 lines)
    ├── cleanup-job.js          (~100 lines)
    ├── backup-job.js           (~50 lines)
    └── notification-job.js     (~50 lines)
```

### 5. Notification Service Module
**Before:** 1 file, 594 lines  
**After:** 7 files, avg ~85 lines per file

```
notification/
├── index.js                    (~100 lines)
├── price-alert-notifier.js     (~100 lines)
├── ipo-notifier.js             (~150 lines)
├── dividend-notifier.js        (~100 lines)
├── right-share-notifier.js     (~100 lines)
├── token-manager.js            (~50 lines)
└── formatters.js               (~50 lines)
```

---

## Impact Analysis

### AI Context Reduction

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Largest file | 1,886 lines | ~500 lines | **73% reduction** |
| Avg file size (top 5) | 1,213 lines | ~160 lines | **87% reduction** |
| Files > 1000 lines | 3 files | 0 files | **100% reduction** |
| Files > 500 lines | 5 files | 1 file | **80% reduction** |

### Developer Experience

**Before:**
- 😰 Opening a file shows 1000+ lines
- 🔍 Hard to find specific functions
- 🐛 Difficult to debug and test
- 🤝 Merge conflicts common
- 📚 Steep learning curve for new contributors

**After:**
- ✅ Files are focused and readable (< 300 lines)
- 🎯 Clear separation of concerns
- 🧪 Easier to test individual modules
- 🤝 Fewer merge conflicts
- 📖 Easier onboarding for new developers

### Code Organization

**Before:**
```
src/
├── database/
│   ├── queries.js          (1,627 lines) 😱
│   └── database.js         (425 lines)
├── scrapers/
│   └── nepse-scraper.js    (1,886 lines) 😱
├── routes/
│   └── portfolio.js        (1,078 lines) 😱
├── services/
│   └── notification-service.js (594 lines) 😰
└── scheduler.js            (880 lines) 😰
```

**After:**
```
src/
├── database/
│   ├── queries/            (10 files, well organized) ✅
│   └── database.js
├── scrapers/
│   └── nepse/              (8 files, modular) ✅
├── routes/
│   └── portfolio/          (6 files, by resource) ✅
├── services/
│   └── notification/       (7 files, by type) ✅
└── scheduler/              (11 files, by job) ✅
```

---

## Estimated Effort

| Phase | Files | Estimated Time | Risk Level |
|-------|-------|----------------|------------|
| Phase 1: Database Queries | 10 | 1 week | Low |
| Phase 2: NEPSE Scraper | 8 | 1 week | Medium |
| Phase 3: Portfolio Routes | 6 | 1 week | Low |
| Phase 4: Scheduler | 11 | 1 week | Medium |
| Phase 5: Notification Service | 7 | 1 week | Low |
| **Total** | **42 files** | **5 weeks** | **Low-Medium** |

---

## Success Metrics

After refactoring, we should achieve:

1. ✅ **No files over 500 lines** (except complex scrapers)
2. ✅ **Average file size < 200 lines**
3. ✅ **Clear module boundaries**
4. ✅ **100% backward compatibility**
5. ✅ **All tests passing**
6. ✅ **No performance regression**
7. ✅ **Improved AI context efficiency**

---

## Next Steps

1. ✅ Review and approve refactoring plan
2. 🔄 Create feature branch: `refactor/modularize-large-files`
3. ⏳ Begin Phase 1: Database Queries
4. ⏳ Iterative testing and review
5. ⏳ Merge to main after each phase

---

## Notes

- All refactoring maintains **100% backward compatibility**
- Existing imports continue to work via index.js re-exports
- No API changes, no database schema changes
- Each phase is independently committable and rollback-able
- Testing strategy includes unit, integration, and manual testing
