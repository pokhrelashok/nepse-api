# Cleanup Mutual Funds Script - Fix Summary

## Issue
The `scripts/cleanup-mutual-funds.js` script was failing with the error:
```
❌ Failed to save SEF: Column count doesn't match value count at row 1
```

## Root Cause Analysis
The issue was caused by **two separate problems**:

### 1. Missing Fields in Formatter (`src/utils/formatter.js`)
The `formatCompanyDetailsForDatabase` function was missing the `maturity_date` and `maturity_period` fields that were added to the database schema for mutual funds.

**Fix Applied:**
- Added `maturity_date` and `maturity_period` fields to the formatter (lines 77-78)
- These fields support both camelCase and snake_case property names for flexibility

### 2. Missing Placeholder in SQL Statement (`src/database/database.js`)
The INSERT statement in `saveCompanyDetails` function had a mismatch:
- **40 columns** in the INSERT clause
- **38 `?` placeholders + 1 `NOW()`** = 39 values (missing 1 placeholder)

**Fix Applied:**
- Added one missing `?` placeholder in the VALUES clause (line 205)
- Now correctly has: **39 `?` placeholders + 1 `NOW()`** = 40 values

## Changes Made

### File: `src/utils/formatter.js`
```javascript
// Added lines 77-78:
maturity_date: detail.maturity_date || detail.maturityDate || null,
maturity_period: detail.maturity_period || detail.maturityPeriod || null,
```

### File: `src/database/database.js`
```javascript
// Line 205 - Added one more ? placeholder:
// Before: ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
// After:  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
```

## Testing

### Local Testing
✅ Created test script `scripts/test-save-company.js` to verify the fix
✅ Successfully saved test mutual fund data (SEF)
✅ Ran `scripts/cleanup-mutual-funds.js` - working correctly

### Docker Testing
✅ Verified database schema has `maturity_date` and `maturity_period` columns
✅ Ran script in Docker container - working correctly
✅ Verified NBF2 data:
   - symbol: NBF2
   - company_name: NABIL BALANCED FUND-2
   - sector_name: Mutual Funds
   - instrument_type: Mutual Funds
   - maturity_date: NULL
   - maturity_period: NULL
   - status: A

### Data Verification
Checked multiple mutual funds in the database:
- ✅ Mutual funds have correct sector_name = "Mutual Funds"
- ✅ Mutual funds have maturity_date/maturity_period = NULL (as expected)
- ✅ Debentures retain their original sector names and maturity dates
- ✅ All 43 columns in company_details table are properly populated

## Script Functionality
The `cleanup-mutual-funds.js` script now:
1. ✅ Identifies all mutual funds in the database
2. ✅ Re-scrapes company details from NEPSE
3. ✅ Correctly formats the data with all required fields
4. ✅ Successfully saves to the database without errors
5. ✅ Fixes mutual fund company names and sectors

## Status
🎉 **FIXED** - The script is now working correctly in both local and Docker environments.
