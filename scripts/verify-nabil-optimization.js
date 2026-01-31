const NabilInvestChecker = require('../src/services/ipo-checker/nabil-invest-checker');
const logger = require('../src/utils/logger');

// Mock logger to console with timestamp
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
logger.info = log;
logger.error = (msg, err) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`, err);
logger.warn = log;

async function runVerification() {
  console.log('🚀 Starting Nabil Invest Optimization Verification (Debug Mode)');
  const checker = new NabilInvestChecker();
  // Reduce timeout for testing
  checker.timeout = 30000;

  try {
    console.log('1️⃣ Fetching available scripts...');
    const startScripts = Date.now();
    const scripts = await checker.getScripts();
    console.log(`✅ Fetched ${scripts.length} scripts in ${(Date.now() - startScripts) / 1000}s`);

    if (scripts.length === 0) return;

    const targetScript = scripts[0];
    console.log(`🎯 Using script: ${targetScript.companyName} (${targetScript.shareType})`);

    // Test SINGLE check first
    console.log('2️⃣ Testing SINGLE check...');
    const singleBoid = '1301000000000000';
    try {
      const startSingle = Date.now();
      const singleResult = await checker.checkResult(singleBoid, targetScript.companyName, targetScript.shareType);
      console.log(`✅ Single check result:`, singleResult);
      console.log(`⏱️ Single check took: ${(Date.now() - startSingle) / 1000}s`);
    } catch (e) {
      console.error('❌ Single check failed:', e);
    }

    // Test BULK check
    const boids = ['1301000000000001', '1301000000000002', '1301000000000003', '1301000000000004'];
    console.log(`3️⃣ Testing BULK check with ${boids.length} BOIDs (Concurrency: 2)...`);

    const startBulk = Date.now();
    const results = await checker.checkResultBulk(boids, targetScript.companyName, targetScript.shareType);
    const duration = (Date.now() - startBulk) / 1000;

    console.log(`✅ Bulk check completed in ${duration}s`);
    console.log(`📊 Average time per BOID: ${duration / boids.length}s`);
    console.log(`Results count: ${results.length}`);
    if (results.length > 0) console.log('Sample:', results[0]);

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

runVerification();
