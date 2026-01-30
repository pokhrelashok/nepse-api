const { extractShareType, SHARE_TYPES } = require('../../src/services/ipo-checker/share-type-utils');

describe('Share Type Utilities', () => {
  describe('extractShareType', () => {
    test('should extract ordinary share types', () => {
      expect(extractShareType('Example Company (General Public)')).toBe(SHARE_TYPES.ORDINARY);
      expect(extractShareType('Example Company (Public)')).toBe(SHARE_TYPES.ORDINARY);
      expect(extractShareType('Example Company IPO')).toBe(SHARE_TYPES.ORDINARY);
      expect(extractShareType('Example Company FPO')).toBe(SHARE_TYPES.ORDINARY);
    });

    test('should extract local share types', () => {
      expect(extractShareType('Example Company (Local)')).toBe(SHARE_TYPES.LOCAL);
      expect(extractShareType('Example Company (Local Residents)')).toBe(SHARE_TYPES.LOCAL);
      expect(extractShareType('Example Company (Project Affected)')).toBe(SHARE_TYPES.LOCAL);
    });

    test('should extract migrant worker share types', () => {
      expect(extractShareType('Example Company (Foreign Employment)')).toBe(SHARE_TYPES.MIGRANT_WORKERS);
      expect(extractShareType('Example Company (Migrant Workers)')).toBe(SHARE_TYPES.MIGRANT_WORKERS);
      expect(extractShareType('Example Company (Remittance)')).toBe(SHARE_TYPES.MIGRANT_WORKERS);
    });

    test('should extract mutual fund share types', () => {
      expect(extractShareType('Example Company (Mutual Fund)')).toBe(SHARE_TYPES.MUTUAL_FUND);
      expect(extractShareType('Generic Fund')).toBe(SHARE_TYPES.MUTUAL_FUND);
    });

    test('should extract employee share types', () => {
      expect(extractShareType('Example Company (Employees)')).toBe(SHARE_TYPES.EMPLOYEES);
      expect(extractShareType('Example Company (Staff)')).toBe(SHARE_TYPES.EMPLOYEES);
    });

    test('should extract promoter share types', () => {
      expect(extractShareType('Example Company (Promoter)')).toBe(SHARE_TYPES.PROMOTER);
    });

    test('should extract general foreign share types', () => {
      expect(extractShareType('Example Company (Foreign)')).toBe(SHARE_TYPES.FOREIGN);
    });

    test('should default to ordinary if no match or empty', () => {
      expect(extractShareType('')).toBe(SHARE_TYPES.ORDINARY);
      expect(extractShareType(null)).toBe(SHARE_TYPES.ORDINARY);
      expect(extractShareType('Just a name')).toBe(SHARE_TYPES.ORDINARY);
    });
  });
});
