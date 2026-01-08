# Quick Start Guide - Phase 1: Database Queries Refactoring

This guide will help you get started with the first phase of refactoring.

## Prerequisites

- All tests should be passing
- Create a feature branch: `git checkout -b refactor/database-queries`
- Backup current state

## Step-by-Step Implementation

### Step 1: Create Directory Structure

```bash
mkdir -p src/database/queries
```

### Step 2: Create Module Files

Create the following empty files:

```bash
touch src/database/queries/index.js
touch src/database/queries/stock-queries.js
touch src/database/queries/market-queries.js
touch src/database/queries/company-queries.js
touch src/database/queries/ipo-queries.js
touch src/database/queries/dividend-queries.js
touch src/database/queries/alert-queries.js
touch src/database/queries/scheduler-queries.js
touch src/database/queries/sector-queries.js
```

### Step 3: Function Distribution Checklist

#### stock-queries.js
- [ ] `getAllSecurityIds`
- [ ] `getSecurityIdsWithoutDetails`
- [ ] `getSecurityIdsBySymbols`
- [ ] `searchStocks`
- [ ] `getScriptDetails`
- [ ] `getLatestPrices`
- [ ] `getIntradayData`
- [ ] `insertTodayPrices`
- [ ] `getStockHistory`

#### market-queries.js
- [ ] `saveMarketSummary`
- [ ] `updateMarketStatus`
- [ ] `saveMarketIndex`
- [ ] `saveMarketIndexHistory`
- [ ] `getCurrentMarketStatus`
- [ ] `getMarketIndexData`
- [ ] `getLatestMarketIndexData`
- [ ] `getMarketIndexHistory`
- [ ] `getIntradayMarketIndex`
- [ ] `getMarketIndicesHistory`
- [ ] `getMarketStatusHistory`

#### company-queries.js
- [ ] `getAllCompanies`
- [ ] `getCompaniesBySector`
- [ ] `getTopCompaniesByMarketCap`
- [ ] `getCompanyStats`
- [ ] `insertCompanyDetails`
- [ ] `insertFinancials`

#### ipo-queries.js
- [ ] `insertIpo`
- [ ] `getIpos`

#### dividend-queries.js
- [ ] `insertDividends`
- [ ] `insertAnnouncedDividends`
- [ ] `getAnnouncedDividends`
- [ ] `getRecentBonusForSymbols`
- [ ] `findPublishedDate`

#### alert-queries.js
- [ ] `createPriceAlert`
- [ ] `getUserPriceAlerts`
- [ ] `updatePriceAlert`
- [ ] `deletePriceAlert`
- [ ] `getActivePriceAlerts`
- [ ] `markAlertTriggered`
- [ ] `updateAlertState`
- [ ] `getUserHoldingWACC`

#### scheduler-queries.js
- [ ] `saveSchedulerStatus`
- [ ] `getSchedulerStatus`

#### sector-queries.js
- [ ] `getSectorBreakdown`

### Step 4: Common Imports Template

Each module file should start with:

```javascript
const { pool } = require('../database');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { DateTime } = require('luxon');
const { normalizeShareType, formatShareType } = require('../../utils/share-type-utils');

// Helper function (if needed in this module)
function toMySQLDatetime(isoString) {
  if (!isoString) return null;
  return isoString.replace('T', ' ').replace('Z', '').substring(0, 19);
}
```

### Step 5: Create index.js

The index.js should re-export all functions:

```javascript
// Re-export all query functions
module.exports = {
  // Stock queries
  ...require('./stock-queries'),
  
  // Market queries
  ...require('./market-queries'),
  
  // Company queries
  ...require('./company-queries'),
  
  // IPO queries
  ...require('./ipo-queries'),
  
  // Dividend queries
  ...require('./dividend-queries'),
  
  // Alert queries
  ...require('./alert-queries'),
  
  // Scheduler queries
  ...require('./scheduler-queries'),
  
  // Sector queries
  ...require('./sector-queries')
};
```

### Step 6: Update Imports

Find all files that import from `../database/queries` and update them:

**Before:**
```javascript
const queries = require('../database/queries');
```

**After:**
```javascript
const queries = require('../database/queries/index');
// or simply
const queries = require('../database/queries');
```

Files to update (use grep to find all):
```bash
grep -r "require.*database/queries" src/
```

### Step 7: Testing Strategy

1. **Unit Tests**: Ensure each query function works independently
2. **Integration Tests**: Test that all imports resolve correctly
3. **API Tests**: Run full API test suite
4. **Manual Testing**: Test critical endpoints

```bash
# Run tests
npm test

# Test specific endpoints
curl http://localhost:3000/api/market/status
curl http://localhost:3000/api/stocks/search?q=NABIL
curl http://localhost:3000/api/portfolios
```

### Step 8: Verification Checklist

- [ ] All module files created
- [ ] All functions moved to appropriate modules
- [ ] index.js exports all functions
- [ ] All imports updated across codebase
- [ ] No duplicate function definitions
- [ ] All tests passing
- [ ] No console errors in development
- [ ] API endpoints responding correctly
- [ ] No performance regression

### Step 9: Commit Strategy

Make incremental commits:

```bash
# After creating structure
git add src/database/queries/
git commit -m "refactor(db): create queries module structure"

# After moving stock queries
git add src/database/queries/stock-queries.js
git commit -m "refactor(db): extract stock queries to separate module"

# After moving market queries
git add src/database/queries/market-queries.js
git commit -m "refactor(db): extract market queries to separate module"

# Continue for each module...

# After updating all imports
git add .
git commit -m "refactor(db): update all imports to use modular queries"

# After testing
git commit -m "refactor(db): complete database queries refactoring"
```

## Troubleshooting

### Issue: Module not found
**Solution**: Check that the path in require() is correct relative to the importing file

### Issue: Function is undefined
**Solution**: Ensure the function is exported in the module and re-exported in index.js

### Issue: Circular dependency
**Solution**: Move shared utilities to a separate utils file

### Issue: Tests failing
**Solution**: Check that all imports are updated and functions are properly exported

## Rollback Plan

If issues arise:

```bash
# Rollback to previous commit
git reset --hard HEAD~1

# Or rollback entire branch
git checkout main
git branch -D refactor/database-queries
```

## Next Steps After Phase 1

1. Create PR for review
2. Merge to main after approval
3. Begin Phase 2: NEPSE Scraper refactoring

## Estimated Timeline

- **Structure creation**: 30 minutes
- **Function extraction**: 2-3 hours
- **Import updates**: 1-2 hours
- **Testing**: 2-3 hours
- **Total**: 1 day

## Tips

1. **Work incrementally**: Move one module at a time
2. **Test frequently**: Run tests after each module
3. **Keep original file**: Don't delete queries.js until everything works
4. **Use git**: Commit often, rollback if needed
5. **Document changes**: Update comments and documentation

---

Good luck! 🚀
