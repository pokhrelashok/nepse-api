/**
 * Shared utility for IPO share type extraction and normalization
 */

/**
 * Standardized share types based on database requirements
 */
const SHARE_TYPES = {
  ORDINARY: 'ordinary',
  LOCAL: 'local',
  MIGRANT_WORKERS: 'migrant_workers',
  MUTUAL_FUND: 'mutual_fund',
  EMPLOYEES: 'employees',
  PROMOTER: 'promoter',
  FOREIGN: 'foreign'
};

/**
 * Extract and normalize share type from a company name string
 * 
 * @param {string} name - Raw company name from provider
 * @returns {string} - Normalized share type
 */
function extractShareType(name) {
  if (!name) return SHARE_TYPES.ORDINARY;

  const lowerName = name.toLowerCase();

  // 1. Migrant Workers / Foreign Employment
  if (
    lowerName.includes('foreign employment') ||
    lowerName.includes('migrant') ||
    lowerName.includes('remittance')
  ) {
    return SHARE_TYPES.MIGRANT_WORKERS;
  }

  // 2. Local Residents / Project Affected
  if (
    lowerName.includes('local') ||
    lowerName.includes('affected') ||
    lowerName.includes('resident')
  ) {
    return SHARE_TYPES.LOCAL;
  }

  // 3. Mutual Funds
  if (
    lowerName.includes('mutual fund') ||
    lowerName.includes('fund')
  ) {
    return SHARE_TYPES.MUTUAL_FUND;
  }

  // 4. Employees / Staff
  if (
    lowerName.includes('staff') ||
    lowerName.includes('employee')
  ) {
    // If it specifically says 'promoter employee' or similar, we might need a choice.
    // But usually 'employee' is its own category.
    return SHARE_TYPES.EMPLOYEES;
  }

  // 5. Promoter
  if (lowerName.includes('promoter')) {
    return SHARE_TYPES.PROMOTER;
  }

  // 6. Foreign (General, not specifically migrant workers)
  if (lowerName.includes('foreign')) {
    return SHARE_TYPES.FOREIGN;
  }

  // Default to ordinary for "Public", "General Public", "IPO", "FPO" or no match
  return SHARE_TYPES.ORDINARY;
}

module.exports = {
  SHARE_TYPES,
  extractShareType
};
