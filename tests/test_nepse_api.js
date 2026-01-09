/**
 * Test NEPSE API Endpoints Directly
 * Tests if we can call the NEPSE API without Puppeteer
 */

const https = require('https');

async function testNepseAPI() {
  console.log('🧪 Testing NEPSE API Endpoints...\n');

  const securityId = 131; // NABIL
  const endpoints = [
    `/api/nots/security/${securityId}`,
    `/api/nots/security/${securityId}/profile/`
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: https://www.nepalstock.com${endpoint}`);
    console.log('─'.repeat(60));

    try {
      const data = await makeRequest(endpoint);
      console.log('✅ Success! Response:');
      console.log(JSON.stringify(data, null, 2).substring(0, 500));

      if (data) {
        console.log(`\n📊 Response keys: ${Object.keys(data).join(', ')}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.nepalstock.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nepalstock.com/company/detail/131',
        'Origin': 'https://www.nepalstock.com'
      },
      timeout: 10000,
      rejectUnauthorized: false // Bypass SSL verification for testing
    };

    const req = https.request(options, (res) => {
      let data = '';

      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2).substring(0, 200)}`);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            console.log(`   Raw response: ${data.substring(0, 200)}`);
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

// Run the test
testNepseAPI()
  .then(() => {
    console.log('\n✅ API test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ API test failed:', error);
    process.exit(1);
  });
