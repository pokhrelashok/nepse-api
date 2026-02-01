const KumariCapitalChecker = require('../../src/services/ipo-checker/kumari-capital-checker');

describe('Kumari Capital Checker', () => {
  let checker;

  beforeAll(() => {
    checker = new KumariCapitalChecker();
  });

  test('should fetch scripts successfully', async () => {
    const scripts = await checker.getScripts();
    expect(Array.isArray(scripts)).toBe(true);
    // We expect at least one script given the user context
    expect(scripts.length).toBeGreaterThan(0);

    // Log scripts for debugging if needed
    // console.log(scripts);
  }, 30000);

  test('should verify success case: IPO (General Public) (Allotted)', async () => {
    const boid = '1301120000423024';
    // We need to dynamically find the company name for ID 452 or any active IPO
    // Using 452 as per user example
    const scripts = await checker.getScripts();
    const targetScript = scripts.find(s => s.value === 452);

    if (!targetScript) {
      console.warn('Target script (ID 452) not found, skipping specific test');
      return;
    }

    const result = await checker.checkResult(boid, targetScript.companyName, targetScript.shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(true);
    expect(result.units).toBeGreaterThan(0);
    // expect(result.message).toContain('Allotted');
  }, 60000);

  test('should verify failure case: IPO (General Public) (Not Allotted)', async () => {
    const boid = '1301670000015818';
    const scripts = await checker.getScripts();
    const targetScript = scripts.find(s => s.value === 452);

    if (!targetScript) {
      console.warn('Target script (ID 452) not found, skipping specific test');
      return;
    }

    const result = await checker.checkResult(boid, targetScript.companyName, targetScript.shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(false);
    expect(result.units).toBeNull();
    // expect(result.message).toContain('Sorry, not allotted');
  }, 60000);
});
