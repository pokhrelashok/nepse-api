/**
 * Test suite for Sector Breakdown API
 * Run with: bun test tests/sector-breakdown.test.js
 * Or in Docker: docker compose run --rm app bun test tests/sector-breakdown.test.js
 */

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function testSectorBreakdownEndpoint() {
  console.log('\n📊 Testing Sector Breakdown Endpoint');
  console.log('═'.repeat(50));

  const tests = [
    {
      name: 'Basic sector breakdown',
      url: `${baseUrl}/api/market/sectors`,
      validate: (data) => {
        if (!data.success) return 'Response should have success=true';
        if (!data.data.sectors) return 'Response should have sectors array';
        if (!Array.isArray(data.data.sectors)) return 'Sectors should be an array';
        if (data.data.count !== data.data.sectors.length) return 'Count should match sectors length';
        return null;
      }
    },
    {
      name: 'Sector structure validation',
      url: `${baseUrl}/api/market/sectors`,
      validate: (data) => {
        if (data.data.sectors.length === 0) return null; // Skip if no data

        const sector = data.data.sectors[0];
        const requiredFields = [
          'sector_name', 'company_count', 'total_market_cap',
          'avg_price_change', 'sector_percentage_change',
          'total_volume', 'total_turnover',
          'gainers', 'losers', 'unchanged', 'top_companies'
        ];

        for (const field of requiredFields) {
          if (!(field in sector)) return `Sector missing required field: ${field}`;
        }

        if (!Array.isArray(sector.top_companies)) return 'top_companies should be an array';
        if (sector.top_companies.length > 3) return 'top_companies should have max 3 items';

        return null;
      }
    },
    {
      name: 'Sort by market cap (default)',
      url: `${baseUrl}/api/market/sectors?sortBy=market_cap&order=desc`,
      validate: (data) => {
        if (data.data.sectors.length < 2) return null; // Skip if not enough data

        const sectors = data.data.sectors;
        for (let i = 0; i < sectors.length - 1; i++) {
          if (sectors[i].total_market_cap < sectors[i + 1].total_market_cap) {
            return `Sectors not sorted by market_cap DESC: ${sectors[i].sector_name} (${sectors[i].total_market_cap}) < ${sectors[i + 1].sector_name} (${sectors[i + 1].total_market_cap})`;
          }
        }
        return null;
      }
    },
    {
      name: 'Sort by company count',
      url: `${baseUrl}/api/market/sectors?sortBy=company_count&order=desc`,
      validate: (data) => {
        if (data.data.sectors.length < 2) return null;

        const sectors = data.data.sectors;
        for (let i = 0; i < sectors.length - 1; i++) {
          if (sectors[i].company_count < sectors[i + 1].company_count) {
            return `Sectors not sorted by company_count DESC`;
          }
        }
        return null;
      }
    },
    {
      name: 'Sort by sector change',
      url: `${baseUrl}/api/market/sectors?sortBy=sector_change&order=desc`,
      validate: (data) => {
        if (data.data.sectors.length < 2) return null;

        const sectors = data.data.sectors;
        for (let i = 0; i < sectors.length - 1; i++) {
          if (sectors[i].sector_percentage_change < sectors[i + 1].sector_percentage_change) {
            return `Sectors not sorted by sector_percentage_change DESC`;
          }
        }
        return null;
      }
    },
    {
      name: 'Ascending order',
      url: `${baseUrl}/api/market/sectors?sortBy=market_cap&order=asc`,
      validate: (data) => {
        if (data.data.sectors.length < 2) return null;

        const sectors = data.data.sectors;
        for (let i = 0; i < sectors.length - 1; i++) {
          if (sectors[i].total_market_cap > sectors[i + 1].total_market_cap) {
            return `Sectors not sorted by market_cap ASC`;
          }
        }
        return null;
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🧪 ${test.name}...`);
      console.log(`   URL: ${test.url}`);

      // Add headers for authentication (same-origin or API key)
      const headers = {
        'referer': baseUrl,
        'origin': baseUrl
      };

      // If TEST_API_KEY is set, use it
      if (process.env.TEST_API_KEY) {
        headers['x-api-key'] = process.env.TEST_API_KEY;
      }

      const response = await fetch(test.url, { headers });

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        failed++;
        continue;
      }

      const data = await response.json();
      const error = test.validate(data);

      if (error) {
        console.log(`   ❌ Validation failed: ${error}`);
        failed++;
      } else {
        console.log(`   ✅ Passed`);
        if (data.data.sectors.length > 0) {
          console.log(`   📈 Found ${data.data.count} sectors`);
          console.log(`   🏆 Top sector: ${data.data.sectors[0].sector_name} (${data.data.sectors[0].company_count} companies)`);
        }
        passed++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function displaySectorSummary() {
  console.log('\n📊 Sector Market Summary');
  console.log('═'.repeat(80));

  try {
    const headers = {
      'referer': baseUrl,
      'origin': baseUrl
    };

    if (process.env.TEST_API_KEY) {
      headers['x-api-key'] = process.env.TEST_API_KEY;
    }

    const response = await fetch(`${baseUrl}/api/market/sectors?sortBy=market_cap&order=desc`, { headers });
    if (!response.ok) {
      console.log('❌ Failed to fetch sector data');
      return;
    }

    const data = await response.json();
    const sectors = data.data.sectors;

    if (sectors.length === 0) {
      console.log('No sector data available');
      return;
    }

    console.log('\nSector'.padEnd(30) + 'Companies'.padEnd(12) + 'Market Cap (B)'.padEnd(18) + 'Change %');
    console.log('-'.repeat(80));

    sectors.forEach(sector => {
      const marketCapB = (sector.total_market_cap / 1_000_000_000).toFixed(2);
      const changeStr = sector.sector_percentage_change >= 0
        ? `+${sector.sector_percentage_change.toFixed(2)}%`
        : `${sector.sector_percentage_change.toFixed(2)}%`;

      console.log(
        sector.sector_name.padEnd(30) +
        String(sector.company_count).padEnd(12) +
        marketCapB.padEnd(18) +
        changeStr
      );
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`Total Sectors: ${sectors.length}`);
    console.log(`Total Companies: ${sectors.reduce((sum, s) => sum + s.company_count, 0)}`);
    console.log(`Total Market Cap: ${(sectors.reduce((sum, s) => sum + s.total_market_cap, 0) / 1_000_000_000).toFixed(2)}B`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 NEPSE Sector Breakdown Test Suite');
  console.log('═'.repeat(50));

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  const testsPassed = await testSectorBreakdownEndpoint();
  await displaySectorSummary();

  console.log('\n' + '═'.repeat(50));
  console.log(testsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  console.log('═'.repeat(50));

  return testsPassed;
}

if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

module.exports = { testSectorBreakdownEndpoint, displaySectorSummary, runTests };
