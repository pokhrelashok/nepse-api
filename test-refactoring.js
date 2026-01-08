#!/usr/bin/env node

/**
 * Test script to verify Phase 1 refactoring
 * Tests that all 44 functions are properly exported and accessible
 */

const queries = require('./src/database/queries');

console.log('🧪 Testing Phase 1 Refactoring - Database Queries\n');
console.log('='.repeat(60));

// Test 1: Module loads
console.log('\n✅ Test 1: Module Loading');
console.log('   Module loaded successfully');

// Test 2: Function count
const functionCount = Object.keys(queries).length;
console.log(`\n✅ Test 2: Function Count`);
console.log(`   Expected: 44 functions`);
console.log(`   Actual: ${functionCount} functions`);
if (functionCount === 44) {
  console.log('   ✅ PASS');
} else {
  console.log('   ❌ FAIL - Function count mismatch');
}

// Test 3: Check all expected functions exist
console.log(`\n✅ Test 3: Function Existence Check`);

const expectedFunctions = {
  'Stock Queries': [
    'getAllSecurityIds',
    'getSecurityIdsWithoutDetails',
    'getSecurityIdsBySymbols',
    'searchStocks',
    'getScriptDetails',
    'getLatestPrices',
    'getIntradayData',
    'insertTodayPrices',
    'getStockHistory'
  ],
  'Market Queries': [
    'saveMarketSummary',
    'updateMarketStatus',
    'saveMarketIndex',
    'saveMarketIndexHistory',
    'getCurrentMarketStatus',
    'getMarketIndexData',
    'getLatestMarketIndexData',
    'getMarketIndexHistory',
    'getIntradayMarketIndex',
    'getMarketIndicesHistory',
    'getMarketStatusHistory'
  ],
  'Company Queries': [
    'getAllCompanies',
    'getCompaniesBySector',
    'getTopCompaniesByMarketCap',
    'getCompanyStats',
    'insertCompanyDetails',
    'insertFinancials'
  ],
  'IPO Queries': [
    'insertIpo',
    'getIpos'
  ],
  'Dividend Queries': [
    'insertDividends',
    'insertAnnouncedDividends',
    'getAnnouncedDividends',
    'getRecentBonusForSymbols',
    'findPublishedDate'
  ],
  'Alert Queries': [
    'createPriceAlert',
    'getUserPriceAlerts',
    'updatePriceAlert',
    'deletePriceAlert',
    'getActivePriceAlerts',
    'markAlertTriggered',
    'updateAlertState',
    'getUserHoldingWACC'
  ],
  'Scheduler Queries': [
    'saveSchedulerStatus',
    'getSchedulerStatus'
  ],
  'Sector Queries': [
    'getSectorBreakdown'
  ]
};

let totalExpected = 0;
let totalFound = 0;
let missingFunctions = [];

for (const [category, functions] of Object.entries(expectedFunctions)) {
  console.log(`\n   ${category}:`);
  for (const funcName of functions) {
    totalExpected++;
    if (typeof queries[funcName] === 'function') {
      console.log(`      ✅ ${funcName}`);
      totalFound++;
    } else {
      console.log(`      ❌ ${funcName} - MISSING`);
      missingFunctions.push(funcName);
    }
  }
}

console.log(`\n   Summary: ${totalFound}/${totalExpected} functions found`);
if (missingFunctions.length === 0) {
  console.log('   ✅ PASS - All functions exist');
} else {
  console.log(`   ❌ FAIL - Missing functions: ${missingFunctions.join(', ')}`);
}

// Test 4: Check function types
console.log(`\n✅ Test 4: Function Type Check`);
const allAreFunctions = Object.values(queries).every(val => typeof val === 'function');
if (allAreFunctions) {
  console.log('   ✅ PASS - All exports are functions');
} else {
  console.log('   ❌ FAIL - Some exports are not functions');
}

// Test 5: Module file structure
console.log(`\n✅ Test 5: Module File Structure`);
const fs = require('fs');
const path = require('path');

const expectedModules = [
  'index.js',
  'stock-queries.js',
  'market-queries.js',
  'company-queries.js',
  'ipo-queries.js',
  'dividend-queries.js',
  'alert-queries.js',
  'scheduler-queries.js',
  'sector-queries.js'
];

const queriesDir = path.join(__dirname, 'src/database/queries');
let allModulesExist = true;

for (const module of expectedModules) {
  const modulePath = path.join(queriesDir, module);
  if (fs.existsSync(modulePath)) {
    console.log(`   ✅ ${module}`);
  } else {
    console.log(`   ❌ ${module} - MISSING`);
    allModulesExist = false;
  }
}

if (allModulesExist) {
  console.log('   ✅ PASS - All module files exist');
} else {
  console.log('   ❌ FAIL - Some module files are missing');
}

// Final Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Test Summary\n');

const allTestsPassed =
  functionCount === 44 &&
  missingFunctions.length === 0 &&
  allAreFunctions &&
  allModulesExist;

if (allTestsPassed) {
  console.log('✅ ALL TESTS PASSED!');
  console.log('\nPhase 1 refactoring is working correctly.');
  console.log('All 44 functions are properly exported and accessible.');
  console.log('\n✅ Ready for production use!');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('\nPlease review the failures above.');
  process.exit(1);
}
