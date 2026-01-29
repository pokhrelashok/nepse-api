const LsCapitalChecker = require('../../src/services/ipo-checker/ls-capital-checker');

describe('LS Capital Checker', () => {
  let checker;

  beforeAll(() => {
    checker = new LsCapitalChecker();
  });

  test('should fetch scripts successfully', async () => {
    const scripts = await checker.getScripts();
    expect(Array.isArray(scripts)).toBe(true);
    expect(scripts.length).toBeGreaterThan(0);

    // Ensure "Trade Tower Limited" exists (ID 31)
    const targetScript = scripts.find(s => s.value === 31 || s.rawName.includes('Trade Tower'));
    expect(targetScript).toBeDefined();
    // Since normalization removes "Limited", we expect "trade tower" or similar
    expect(targetScript.companyName).toContain('trade tower');
  }, 30000);

  test('should verify success case: Trade Tower Limited (Allotted)', async () => {
    const boid = '1301670000015818';
    const companyName = 'Trade Tower Limited';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(true);
    expect(result.units).toBe(10);
    expect(result.message).toContain('Allotted 10 units');
  }, 60000);

  test('should verify failure case: Trade Tower Limited (Not Allotted)', async () => {
    const boid = '1301670000024187';
    const companyName = 'Trade Tower Limited';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(false);
    expect(result.units).toBeNull(); // or 0
    expect(result.message).toContain('Sorry, not allotted');
  }, 60000);
});
