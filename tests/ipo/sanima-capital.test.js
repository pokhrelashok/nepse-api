const SanimaCapitalChecker = require('../../src/services/ipo-checker/sanima-capital-checker');
const axios = require('axios');

jest.mock('axios');

describe('SanimaCapitalChecker', () => {
  let checker;

  beforeEach(() => {
    checker = new SanimaCapitalChecker();
    jest.clearAllMocks();
  });

  describe('getScripts', () => {
    it('should return list of companies', async () => {
      const mockResponse = {
        data: [
          {
            id: 20,
            name: "Mathillo Mailun Khola Jalvidhyut Limited - General Public",
            flag: "1",
            created_id: 3,
            updated_id: null,
            created_at: "2023-10-20 07:38:05",
            updated_at: "2023-10-20 07:38:05"
          }
        ]
      };

      axios.get.mockResolvedValue(mockResponse);

      const scripts = await checker.getScripts();

      expect(scripts).toHaveLength(1);
      expect(scripts[0].companyName).toBe('mathillo mailun khola jalvidhyut');
      expect(scripts[0].shareType).toBe('ordinary');
      expect(scripts[0].value).toBe(20);
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
        data: [{ id: 20, name: "Mathillo Mailun Khola Jalvidhyut Limited" }]
      });

      // Mock checkResult
      // Using data structure inferred from success case logic
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

      const result = await checker.checkResult('1301670000015818', 'Mathillo Mailun Khola Jalvidhyut', 'IPO');

      expect(result.success).toBe(true);
      expect(result.allotted).toBe(true);
      expect(result.units).toBe(10);
    });

    it('should return not allotted when result is empty or error=true', async () => {
      // Mock getScripts first
      axios.get.mockResolvedValueOnce({
        data: [{ id: 20, name: "Mathillo Mailun Khola Jalvidhyut Limited" }]
      });

      // Mock checkResult
      const mockResultResponse = {
        data: {
          error: true,
          message: "Sorry not allotted"
        }
      };
      axios.get.mockResolvedValueOnce(mockResultResponse);

      const result = await checker.checkResult('1301120000423024', 'Mathillo Mailun Khola Jalvidhyut', 'IPO');

      expect(result.success).toBe(true);
      expect(result.allotted).toBe(false);
      expect(result.units).toBe(null);
    });

    it('should handle company not found', async () => {
      axios.get.mockResolvedValueOnce({
        data: []
      });

      const result = await checker.checkResult('1234567890123456', 'Unknown Company', 'IPO');

      expect(result.success).toBe(true);
      expect(result.allotted).toBe(false);
      expect(result.message).toContain('Company not found');
    });

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      // Since getScripts is called first in checkResult
      const result = await checker.checkResult('1234567890123456', 'Some Company', 'IPO');
      // If getScripts fails, it returns [], then "Company not found"
      expect(result.message).toBeDefined();
    });
  });
});
