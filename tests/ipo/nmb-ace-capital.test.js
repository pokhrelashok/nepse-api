const NimbAceCapitalChecker = require('../../src/services/ipo-checker/nimb-ace-capital-checker');

describe('NIMB Ace Capital Checker', () => {
  let checker;

  beforeAll(() => {
    checker = new NimbAceCapitalChecker();
  });

  test('should fetch scripts successfully', async () => {
    const scripts = await checker.getScripts();
    expect(Array.isArray(scripts)).toBe(true);
    expect(scripts.length).toBeGreaterThan(0);

    // Log the first few scripts to help with debugging
    console.log('Sample scripts:', scripts.slice(0, 3));

    // Check for structure
    const script = scripts[0];
    expect(script).toHaveProperty('rawName');
    expect(script).toHaveProperty('companyName');
    expect(script).toHaveProperty('value');
  }, 30000);

  test('should verify success case: Barahi Hydropower (Allotted)', async () => {
    // Note: This relies on "Barahi Hydropower" being in the list or us handling the Code "BHPL" manually if needed.
    // The user prompt used "BHPL".
    // Let's try to mock the finding logic/dependency manually if we can't find it in live list,
    // but checkResult depends on getScripts.

    // If the live list doesn't have BHPL anymore (it's old), this test will fail on "Company not found".
    // In that case, we might need to mock getScripts or use a more recent company.
    // If it fails, I'll inspect the list from the first test and update the company name.

    const boid = '1301670000015803';
    // Using a name that should normalize to match likely entry. 
    // If the list has "BARAHI HYDROPOWER PUBLIC LIMITED (Local)", my normalizer produces "barahi hydropower public".
    // Use the name that matches the Ordinary share entry (BHPL)
    const companyName = 'BARAHI HYDROPOWER PUBLIC LIMITED';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    console.log('Success Result:', result);
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    // Since we know this BOID is allotted in the example
    expect(result.allotted).toBe(true);
    expect(result.units).toBeGreaterThan(0);
  }, 60000);

  test('should verify failure case: Barahi Hydropower (Not Allotted)', async () => {
    const boid = '1301670000015818'; // Not allotted BOID from prompt
    const companyName = 'BARAHI HYDROPOWER PUBLIC LIMITED';
    const shareType = 'ordinary';

    const result = await checker.checkResult(boid, companyName, shareType);

    console.log('Failure Result:', result);
    expect(result.success).toBe(true);
    expect(result.boid).toBe(boid);
    expect(result.allotted).toBe(false);
    expect(result.units).toBe(0);
  }, 60000);
});
