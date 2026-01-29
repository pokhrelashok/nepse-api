const GlobalImeCapitalChecker = require('../../src/services/ipo-checker/global-ime-capital-checker');

describe('Global Ime Capital Checker', () => {
  let checker;

  beforeAll(() => {
    checker = new GlobalImeCapitalChecker();
  });

  test('should fetch scripts successfully', async () => {
    const scripts = await checker.getScripts();
    expect(Array.isArray(scripts)).toBe(true);
    expect(scripts.length).toBeGreaterThan(0);

    // Ensure "Balephi" exists as we rely on it for testing
    const balephiScript = scripts.find(s => s.companyName.includes('balephi'));
    expect(balephiScript).toBeDefined();
  }, 30000);

  test('should verify success case: Balephi Hydropower (Allotted)', async () => {
    const boid = '1301070000060334';
    const companyName = 'Balephi Hydropower Limited- General Public';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(true);
    expect(result.units).toBe(10);
    expect(result.message).toContain('Allotted 10 units');
  }, 60000);

  test('should verify failure case: Balephi Hydropower (Not Allotted)', async () => {
    const boid = '1301670000015818';
    const companyName = 'Balephi Hydropower Limited- General Public';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(false);
    expect(result.units).toBeNull();
    expect(result.message).toContain('Sorry, not allotted');
  }, 60000);
});
