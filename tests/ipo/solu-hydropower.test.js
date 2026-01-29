const NabilInvestChecker = require('../../src/services/ipo-checker/nabil-invest-checker');
const { pool } = require('../../src/database/database');

describe('Nabil Invest IPO Checker - Solu Hydropower', () => {
  let checker;

  beforeAll(() => {
    checker = new NabilInvestChecker();
  });

  afterAll(async () => {
    await pool.end();
  });

  test('should check bulk results for Solu Hydropower', async () => {
    // 1. Fetch BOIDs from database
    const [rows] = await pool.execute('SELECT boid FROM user_boids');
    const boids = rows.map(r => r.boid);

    expect(boids.length).toBeGreaterThan(0);
    console.log(`Checking ${boids.length} BOIDs for Solu Hydropower...`);

    // 2. Run bulk check
    // Note: The company name and share type should match what is in Nabil's dropdown
    // Based on Nabil Invest's naming convention
    const companyName = 'Solu Hydropower Limited';
    const shareType = 'ordinary';

    const results = await checker.checkResultBulk(boids, companyName, shareType);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(boids.length);

    // 3. Log results summary
    const allotted = results.filter(r => r.allotted);
    console.log(`Summary: ${allotted.length}/${results.length} BOIDs allotted.`);

    results.forEach(r => {
      if (r.success) {
        console.log(`BOID: ${r.boid} | Allotted: ${r.allotted} | Message: ${r.message}`);
      } else {
        console.error(`BOID: ${r.boid} | Error: ${r.error}`);
      }
    });

    // At least one result should be successful if the service is up
    expect(results.some(r => r.success)).toBe(true);
  }, 180000); // 3 minute timeout for bulk check
});
