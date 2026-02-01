const NabilInvestChecker = require('./nabil-invest-checker');
const NmbCapitalChecker = require('./nmb-capital-checker');
const LsCapitalChecker = require('./ls-capital-checker');
const GlobalImeCapitalChecker = require('./global-ime-capital-checker');
const KumariCapitalChecker = require('./kumari-capital-checker');
const SanimaCapitalChecker = require('./sanima-capital-checker');
const NepalSbiChecker = require('./nepal-sbi-checker');

/**
 * Registry of supported providers
 */
const SUPPORTED_PROVIDERS = {
  'nabil-invest': {
    id: 'nabil-invest',
    name: 'Nabil Invest',
    displayName: 'Nabil Investment Banking Limited',
    url: 'https://result.nabilinvest.com.np/search/ipo-share',
    checker: NabilInvestChecker
  },
  'nmb-capital': {
    id: 'nmb-capital',
    name: 'NMB Capital',
    displayName: 'NMB Capital Limited',
    url: 'https://nmbcl.com.np/ipo',
    checker: NmbCapitalChecker
  },
  'ls-capital': {
    id: 'ls-capital',
    name: 'LS Capital',
    displayName: 'Laxmi Sunrise Capital Limited',
    url: 'https://lscapital.com.np/ipo',
    checker: LsCapitalChecker
  },
  'global-ime-capital': {
    id: 'global-ime-capital',
    name: 'Global IME Capital',
    displayName: 'Global IME Capital Limited',
    url: 'https://globalimecapital.com/ipo-fpo-share-allotment-check',
    checker: GlobalImeCapitalChecker
  },
  'kumari-capital': {
    id: 'kumari-capital',
    name: 'Kumari Capital',
    displayName: 'Kumari Capital Limited',
    url: 'https://kumaricapital.com/ipo', // Assuming generic URL
    checker: KumariCapitalChecker
  },
  'sanima-capital': {
    id: 'sanima-capital',
    name: 'Sanima Capital',
    displayName: 'Sanima Capital Limited',
    url: 'https://www.sanima.capital/ipo',
    checker: SanimaCapitalChecker
  },
  'nepal-sbi': {
    id: 'nepal-sbi',
    name: 'Nepal SBI',
    displayName: 'Nepal SBI Merchant Banking Limited',
    url: 'https://www.nsmbl.com.np/ipo',
    checker: NepalSbiChecker
  }
};

/**
 * Factory method to get appropriate checker for a provider
 * @param {string} providerId - Provider identifier (e.g., 'nabil-invest')
 * @returns {IpoResultChecker} - Checker instance
 */
function getChecker(providerId) {
  const providerConfig = SUPPORTED_PROVIDERS[providerId];
  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${providerId}. Supported providers: ${Object.keys(SUPPORTED_PROVIDERS).join(', ')}`);
  }

  return new providerConfig.checker();
}

/**
 * Get list of supported providers
 * @returns {Array} - Array of provider info objects
 */
function getSupportedProviders() {
  return Object.entries(SUPPORTED_PROVIDERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    displayName: config.displayName,
    url: config.url
  }));
}

/**
 * Get all providers as checker instances
 * @returns {Array<IpoResultChecker>} - Array of checker instances
 */
function getAllCheckers() {
  return Object.keys(SUPPORTED_PROVIDERS).map(providerId => getChecker(providerId));
}

module.exports = {
  getChecker,
  getSupportedProviders,
  getAllCheckers,
  SUPPORTED_PROVIDERS
};
