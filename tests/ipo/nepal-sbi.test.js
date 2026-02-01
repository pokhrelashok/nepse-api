const NepalSbiChecker = require('../../src/services/ipo-checker/nepal-sbi-checker');
const axios = require('axios');

jest.mock('axios');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('NepalSbiChecker', () => {
  let checker;

  beforeEach(() => {
    checker = new NepalSbiChecker();
    jest.clearAllMocks();
  });

  describe('getScripts', () => {
    it('should return list of companies with correct normalization', async () => {
      const mockResponse = {
        data: [
          {
            id: 21,
            name: "Bandipur Cable Car & Tourism Limited - IPO for General Public",
            flag: "1",
            created_id: 1,
            updated_id: null,
            created_at: "2025-09-15 09:41:43",
            updated_at: "2025-09-15 09:41:43"
          }
        ]
      };

      axios.get.mockResolvedValue(mockResponse);

      const scripts = await checker.getScripts();

      expect(scripts).toHaveLength(1);
      expect(scripts[0].companyName).toBe('bandipur cable car & tourism');
      expect(scripts[0].shareType).toBe('ordinary');
      expect(scripts[0].value).toBe(21);
    });

    it('should return empty array on failure', async () => {
      axios.get.mockRejectedValue(new Error('API error'));
      const scripts = await checker.getScripts();
      expect(scripts).toEqual([]);
    });
  });

  describe('checkResult', () => {
    it('should return allotment result when allotted', async () => {
      // Mock getScripts first
      axios.get.mockResolvedValueOnce({
        data: [{ id: 21, name: "Bandipur Cable Car & Tourism Limited - IPO for General Public" }]
      });

      // Mock checkResult
      const mockResultResponse = {
        data: {
          error: false,
          message: "Congrats!! Allotted.",
          data: {
            allotments: {
              alloted_kitta: "10"
            }
          }
        }
      };
      axios.get.mockResolvedValueOnce(mockResultResponse);

      const result = await checker.checkResult('1301670000015818', 'Bandipur Cable Car & Tourism', 'ordinary');

      expect(result.success).toBe(true);
      expect(result.allotted).toBe(true);
      expect(result.units).toBe(10);
    });

    it('should return not allotted when result is empty or error=true', async () => {
      // Mock getScripts first
      axios.get.mockResolvedValueOnce({
        data: [{ id: 21, name: "Bandipur Cable Car & Tourism Limited - IPO for General Public" }]
      });

      // Mock checkResult
      const mockResultResponse = {
        data: {
          error: true,
          message: "Sorry not allotted"
        }
      };
      axios.get.mockResolvedValueOnce(mockResultResponse);

      const result = await checker.checkResult('1301120000423024', 'Bandipur Cable Car & Tourism', 'ordinary');

      expect(result.success).toBe(true);
      expect(result.allotted).toBe(false);
      expect(result.units).toBe(null);
    });

    it('should handle company not found', async () => {
      axios.get.mockResolvedValueOnce({
        data: []
      });

      const result = await checker.checkResult('1234567890123456', 'Unknown Company', 'ordinary');

      expect(result.success).toBe(true);
      expect(result.allotted).toBe(false);
      expect(result.message).toContain('Company not found');
    });

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      const result = await checker.checkResult('1234567890123456', 'Some Company', 'ordinary');
      expect(result.message).toBeDefined();
    });
  });
});
