# IPO Result Checker

This folder contains the IPO result checker system that supports multiple providers for checking IPO allotment results.

## Structure

```
ipo-checker/
├── base-checker.js           # Base class that all providers extend
├── nabil-invest-checker.js   # Nabil Invest implementation
└── index.js                  # Factory methods and provider registry
```

## Adding a New Provider

To add a new provider (e.g., "Example Bank"):

### 1. Create Provider File

Create `example-bank-checker.js`:

```javascript
const IpoResultChecker = require('./base-checker');
const logger = require('../../utils/logger');

class ExampleBankChecker extends IpoResultChecker {
  constructor() {
    super('example-bank', 'Example Bank Limited');
    this.url = 'https://example.com/ipo-results';
  }

  // Implement provider-specific normalization
  _normalizeCompanyName(name) {
    // Your normalization logic
  }

  _extractShareType(name) {
    // Map provider's share type text to database format
    const shareTypeMap = {
      'general': 'ordinary',
      'local citizens': 'local',
      // ... etc
    };
    return shareTypeMap[name.toLowerCase()] || null;
  }

  async getScripts() {
    // Scrape/fetch list of IPOs with published results
    // Return: [{ rawName, companyName, shareType, value }]
  }

  async checkResult(boid, companyName, shareType) {
    // Check allotment for given BOID
    // Return: { success, allotted, units, message, ... }
  }
}

module.exports = ExampleBankChecker;
```

### 2. Register Provider

Update `index.js`:

```javascript
const NabilInvestChecker = require('./nabil-invest-checker');
const ExampleBankChecker = require('./example-bank-checker');

const SUPPORTED_PROVIDERS = {
  'nabil-invest': {
    id: 'nabil-invest',
    name: 'Nabil Invest',
    displayName: 'Nabil Investment Banking Limited',
    url: 'https://result.nabilinvest.com.np/search/ipo-share',
    checker: NabilInvestChecker
  },
  'example-bank': {
    id: 'example-bank',
    name: 'Example Bank',
    displayName: 'Example Bank Limited',
    url: 'https://example.com/ipo-results',
    checker: ExampleBankChecker
  }
};
```

### 3. Test Your Provider

Create tests in `tests/ipo-result-checker.test.js`:

```javascript
describe('Example Bank Checker', () => {
  test('should fetch scripts', async () => {
    const checker = getChecker('example-bank');
    const scripts = await checker.getScripts();
    expect(scripts.length).toBeGreaterThan(0);
  });
});
```

## Share Type Mapping

Each provider must map their share type text to database format:

| Database Value | Common Provider Texts |
|----------------|----------------------|
| `ordinary` | General Public, General, Public Shares |
| `local` | Local, Public, Project Affected |
| `migrant_workers` | Foreign Employment, Migrant Workers |
| `foreign` | Foreign, Non-Resident |
| `mutual_fund` | Mutual Fund |
| `employees` | Employees, Staff |

## Required Methods

All providers must implement:

- **`getScripts()`** - Returns array of IPO scripts with published results
- **`checkResult(boid, companyName, shareType)`** - Checks allotment status

## Best Practices

1. **Normalization**: Each provider implements its own company name and share type normalization
2. **Error Handling**: Always return structured error responses
3. **Logging**: Use logger for debugging and monitoring
4. **Stealth**: Use puppeteer-extra-plugin-stealth for web scraping
5. **Timeouts**: Set appropriate timeouts for network requests
