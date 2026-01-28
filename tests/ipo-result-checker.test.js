const { validateBoid } = require('../src/utils/boid-validator');
const { getSupportedProviders, getChecker } = require('../src/services/ipo-checker');

describe('IPO Result Checker Tests (Updated)', () => {

  describe('BOID Validation', () => {
    test('should validate correct 16-digit BOID', () => {
      const result = validateBoid('1301670000015818');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject invalid BOID', () => {
      const result = validateBoid('130167');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('16 digits');
    });
  });

  describe('Supported Providers', () => {
    test('should return list of supported providers', () => {
      const providers = getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0]).toHaveProperty('id');
      expect(providers[0]).toHaveProperty('name');
    });
  });

  describe('Checker Factory', () => {
    test('should create Nabil Invest checker', () => {
      const checker = getChecker('nabil-invest');
      expect(checker).toBeDefined();
      expect(checker.providerId).toBe('nabil-invest');
      expect(typeof checker.checkResult).toBe('function');
      expect(typeof checker.getScripts).toBe('function');
    });
  });

  describe('Nabil Invest Checker - getScripts', () => {
    test('should fetch and parse scripts', async () => {
      const checker = getChecker('nabil-invest');
      const scripts = await checker.getScripts();

      expect(Array.isArray(scripts)).toBe(true);
      expect(scripts.length).toBeGreaterThan(0);

      // Check script structure
      const script = scripts[0];
      expect(script).toHaveProperty('rawName');
      expect(script).toHaveProperty('companyName');
      expect(script).toHaveProperty('shareType');
      expect(script).toHaveProperty('value');

      // Verify share type mapping
      const hasOrdinary = scripts.some(s => s.shareType === 'ordinary');
      const hasLocal = scripts.some(s => s.shareType === 'local');
      const hasMigrantWorkers = scripts.some(s => s.shareType === 'migrant_workers');

      expect(hasOrdinary || hasLocal || hasMigrantWorkers).toBe(true);
    }, 60000);

    test('should normalize company names correctly', async () => {
      const checker = getChecker('nabil-invest');
      const scripts = await checker.getScripts();

      // Company names should be normalized (no Ltd, no parentheses)
      scripts.forEach(script => {
        expect(script.companyName).not.toContain('(');
        expect(script.companyName).not.toContain(')');
        expect(script.companyName).not.toMatch(/Ltd\.?$/);
      });
    }, 60000);
  });

  describe('Nabil Invest Checker - checkResult with shareType', () => {
    test('should check result with company name and share type', async () => {
      const checker = getChecker('nabil-invest');

      // First get scripts to find a valid company
      const scripts = await checker.getScripts();
      const testScript = scripts[0];

      const result = await checker.checkResult(
        '1301670000015818',
        testScript.companyName,
        testScript.shareType
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('allotted');
      expect(result.provider).toBe('nabil-invest');
    }, 120000);
  });
});
