const axios = require('axios');

async function testNepalSbiConnection() {
  console.log('🔍 Testing Real Connection to Nepal SBI API...');

  const baseUrl = 'https://www.nsmbl.com.np/frontapi/en';
  const url = `${baseUrl}/ipo`;

  console.log(`\n1️⃣ Fetching Lists from: ${url}`);

  try {
    const start = Date.now();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nsmbl.com.np/ipo',
        'Origin': 'https://www.nsmbl.com.np',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });

    const duration = Date.now() - start;
    console.log(`✅ Success! (took ${duration}ms)`);
    console.log(`   Status: ${response.status} ${response.statusText}`);

    const data = response.data;
    if (Array.isArray(data)) {
      console.log(`   Found ${data.length} companies.`);
      if (data.length > 0) {
        console.log('   First item sample:', JSON.stringify(data[0], null, 2));
      }
    } else {
      console.log('   ⚠️ Startling format! Expected array but got:', typeof data);
      console.log('   Data peek:', JSON.stringify(data).substring(0, 200));
    }

  } catch (error) {
    console.log('❌ Connection Failed!');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Headers:`, JSON.stringify(error.response.headers, null, 2));
      console.log(`   Data:`, error.response.data);
    } else if (error.request) {
      console.log('   No response received (Timeout or Network Error)');
      console.log('   Error code:', error.code);
    } else {
      console.log('   Error:', error.message);
    }
  }
}

testNepalSbiConnection();
