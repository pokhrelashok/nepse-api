 const NmbCapitalChecker = require('../../src/services/ipo-checker/nmb-capital-checker');

describe('NMB Capital Checker', () => {
  let checker;

  beforeAll(() => {
    checker = new NmbCapitalChecker();
  });

  test('should fetch scripts successfully', async () => {
    const scripts = await checker.getScripts();
    expect(Array.isArray(scripts)).toBe(true);
    expect(scripts.length).toBeGreaterThan(0);

    // Ensure "Himalayan ReInsurance" matches
    const targetScript = scripts.find(s => s.value === 28 || s.rawName.includes('Himalayan ReInsurance'));
    expect(targetScript).toBeDefined();
    // Since normalization removes "Public", we check the base name part
    expect(targetScript.companyName).toContain('himalayan reinsurance');
  }, 30000);

  test('should verify success case: Himalayan ReInsurance (Allotted)', async () => {
    const boid = '1301670000015818';
    const companyName = 'Himalayan ReInsurance Limited - Public';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(true);
    expect(result.units).toBe(20);
    expect(result.message).toContain('Allotted 20 units');
  }, 60000);

  test('should verify failure case: Himalayan ReInsurance (Not Allotted)', async () => {
    const boid = '1301370007277768';
    const companyName = 'Himalayan ReInsurance Limited - Public';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(false);
    expect(result.units).toBeNull(); // or 0
    expect(result.message.toLowerCase()).toContain('not allotted');
  }, 60000);
});
