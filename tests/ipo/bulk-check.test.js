const NmbCapitalChecker = require('../../src/services/ipo-checker/nmb-capital-checker');
const NabilInvestChecker = require('../../src/services/ipo-checker/nabil-invest-checker');

describe('IPO Bulk Result Checker Tests', () => {

  describe('API Based (NMB Capital)', () => {
    let checker;

    beforeAll(() => {
      checker = new NmbCapitalChecker();
    });

    test('should check multiple BOIDs in parallel', async () => {
      const boids = ['1301670000015818', '1301370007277768']; // Allotted, Not Allotted
      const companyName = 'Himalayan ReInsurance Limited - Public';
      const shareType = 'ordinary';

      const results = await checker.checkResultBulk(boids, companyName, shareType);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);

      // First BOID should be allotted
      expect(results[0].boid).toBe(boids[0]);
      expect(results[0].allotted).toBe(true);

      // Second BOID should be not allotted
      expect(results[1].boid).toBe(boids[1]);
      expect(results[1].allotted).toBe(false);
    }, 60000);
  });

  describe('Puppeteer Based (Nabil Invest)', () => {
    let checker;

    beforeAll(() => {
      checker = new NabilInvestChecker();
    });

    test('should check multiple BOIDs with browser reuse', async () => {
      // Get scripts to find a valid company
      const scripts = await checker.getScripts();
      const testScript = scripts[0];

      // We'll use the same BOID twice for simplicity of the test, 
      // but the logic will trigger the bulk loop.
      const boids = ['1301670000015818', '1301670000015818'];

      const results = await checker.checkResultBulk(boids, testScript.companyName, testScript.shareType);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(boids.length);

      results.forEach((result, index) => {
        expect(result.boid).toBe(boids[index]);
        expect(result.success).toBe(true);
      });
    }, 120000);
  });
});
