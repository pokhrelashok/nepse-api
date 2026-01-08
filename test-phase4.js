// Phase 4 Test - Scheduler Refactoring Verification
const path = require('path');

console.log('🧪 Phase 4: Testing Scheduler Refactoring');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Backward compatibility - original import still works
test('Backward compatibility: require("./src/scheduler") loads successfully', () => {
  const Scheduler = require('./src/scheduler');
  if (!Scheduler) throw new Error('Scheduler not loaded');
  if (typeof Scheduler !== 'function') throw new Error('Scheduler is not a constructor');
});

// Test 2: New modular imports work
test('Modular import: require("./src/scheduler/index") loads', () => {
  const Scheduler = require('./src/scheduler/index');
  if (!Scheduler) throw new Error('Scheduler not loaded');
  if (typeof Scheduler !== 'function') throw new Error('Scheduler is not a constructor');
});

// Test 3: Base scheduler exists
test('Base scheduler module exists', () => {
  const BaseScheduler = require('./src/scheduler/base-scheduler');
  if (!BaseScheduler) throw new Error('BaseScheduler not loaded');
  if (typeof BaseScheduler !== 'function') throw new Error('BaseScheduler is not a constructor');
});

// Test 4: Job modules load
test('Market jobs module loads', () => {
  const marketJobs = require('./src/scheduler/market-jobs');
  if (!marketJobs.updateMarketIndex) throw new Error('updateMarketIndex not found');
  if (!marketJobs.updatePricesAndStatus) throw new Error('updatePricesAndStatus not found');
});

test('Company jobs module loads', () => {
  const companyJobs = require('./src/scheduler/company-jobs');
  if (!companyJobs.updateCompanyDetails) throw new Error('updateCompanyDetails not found');
});

test('Data jobs module loads', () => {
  const dataJobs = require('./src/scheduler/data-jobs');
  if (!dataJobs.runIpoScrape) throw new Error('runIpoScrape not found');
  if (!dataJobs.runFpoScrape) throw new Error('runFpoScrape not found');
  if (!dataJobs.runDividendScrape) throw new Error('runDividendScrape not found');
  if (!dataJobs.runMarketIndicesHistoryScrape) throw new Error('runMarketIndicesHistoryScrape not found');
});

test('Archive jobs module loads', () => {
  const archiveJobs = require('./src/scheduler/archive-jobs');
  if (!archiveJobs.archiveDailyPrices) throw new Error('archiveDailyPrices not found');
  if (!archiveJobs.archiveMarketIndex) throw new Error('archiveMarketIndex not found');
});

test('Maintenance jobs module loads', () => {
  const maintenanceJobs = require('./src/scheduler/maintenance-jobs');
  if (!maintenanceJobs.runSystemCleanup) throw new Error('runSystemCleanup not found');
  if (!maintenanceJobs.runDatabaseBackup) throw new Error('runDatabaseBackup not found');
  if (!maintenanceJobs.runNotificationCheck) throw new Error('runNotificationCheck not found');
});

// Test 5: Scheduler instantiation
test('Scheduler can be instantiated', () => {
  const Scheduler = require('./src/scheduler');
  const scheduler = new Scheduler();
  if (!scheduler) throw new Error('Scheduler instance not created');
  if (typeof scheduler.startPriceUpdateSchedule !== 'function') throw new Error('startPriceUpdateSchedule method missing');
  if (typeof scheduler.stopAllSchedules !== 'function') throw new Error('stopAllSchedules method missing');
  if (typeof scheduler.getHealth !== 'function') throw new Error('getHealth method missing');
});

// Test 6: BaseScheduler functionality
test('BaseScheduler has required methods', () => {
  const BaseScheduler = require('./src/scheduler/base-scheduler');
  const base = new BaseScheduler();
  if (typeof base.getHealth !== 'function') throw new Error('getHealth missing');
  if (typeof base.loadStats !== 'function') throw new Error('loadStats missing');
  if (typeof base.updateStatus !== 'function') throw new Error('updateStatus missing');
  if (typeof base.waitForJobsToFinish !== 'function') throw new Error('waitForJobsToFinish missing');
  if (!base.jobs) throw new Error('jobs Map missing');
  if (!base.stats) throw new Error('stats object missing');
});

// Test 7: File structure validation
test('Directory structure is correct', () => {
  const fs = require('fs');
  const schedulerDir = path.join(__dirname, 'src', 'scheduler');
  
  if (!fs.existsSync(schedulerDir)) throw new Error('scheduler directory missing');
  
  const requiredFiles = [
    'base-scheduler.js',
    'market-jobs.js',
    'company-jobs.js',
    'data-jobs.js',
    'archive-jobs.js',
    'maintenance-jobs.js',
    'index.js'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(schedulerDir, file);
    if (!fs.existsSync(filePath)) throw new Error(`${file} missing`);
  }
  
  const wrapperPath = path.join(__dirname, 'src', 'scheduler.js');
  if (!fs.existsSync(wrapperPath)) throw new Error('scheduler.js wrapper missing');
  
  const backupPath = path.join(__dirname, 'src', 'scheduler.js.old');
  if (!fs.existsSync(backupPath)) throw new Error('scheduler.js.old backup missing');
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`   Passed: ${testsPassed}`);
console.log(`   Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All tests passed! Phase 4 refactoring complete.');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the errors above.');
  process.exit(1);
}
