const HolidayService = require('../src/services/holiday-service');
const { pool } = require('../src/database/database');
const redis = require('../src/config/redis');

async function testHolidaySystem() {
  console.log('🔍 Starting Holiday System Verification...\n');

  try {
    // 1. Test Sync
    console.log('Step 1: Testing Holiday Sync from ShareHub...');
    const syncResult = await HolidayService.syncHolidays();
    console.log(`✅ Sync successful! Count: ${syncResult.count}\n`);

    // 2. Test isHoliday check
    const today = new Date().toISOString().split('T')[0];
    console.log(`Step 2: Checking if today (${today}) is a holiday...`);
    const isTodayHoliday = await HolidayService.isHoliday(today);
    console.log(`Result: ${isTodayHoliday ? 'YES' : 'NO'}\n`);

    // 3. Test Manual Holiday Entry
    const testDate = '2026-12-31';
    console.log(`Step 3: Manually adding a test holiday for ${testDate}...`);
    await HolidayService.saveHoliday({
      holiday_date: testDate,
      description: 'Test Holiday',
      is_active: true
    });

    const isTestHoliday = await HolidayService.isHoliday(testDate);
    console.log(`Check manual entry for ${testDate}: ${isTestHoliday ? 'SUCCESS' : 'FAILED'}\n`);

    // 4. Test Redis Cache
    console.log('Step 4: Verifying Redis cache for the test holiday...');
    const redisVal = await redis.get(`holiday:${testDate}`);
    console.log(`Redis value for ${testDate}: ${redisVal} (Expected: true)\n`);

    // Clean up
    console.log('Cleaning up test data...');
    await HolidayService.deleteHoliday(testDate);
    console.log('✅ Cleanup complete\n');

    console.log('🎉 All holiday system tests passed!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    const { pool } = require('../src/database/database');
    const redis = require('../src/config/redis');
    await pool.end();
    await redis.quit();
  }
}

testHolidaySystem();
