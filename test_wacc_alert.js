const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const USER_ID = '53362b38-678e-498e-ad84-77ab2fdf7483';
const API_KEY = 'npt_82bc05f3a46fa9d92bf92f7213f1d18245f4445b62ecfabdc0357074f4fd60f1';

// Mock JWT token for testing - you'll need a real one in production
const mockToken = 'test-jwt-token';

async function testWaccAlert() {
  console.log('🧪 Testing WACC Alert Functionality\n');

  try {
    // Test 1: Create a WACC-based alert
    console.log('1. Creating WACC-based alert (+20% profit target)...');
    const createResponse = await axios.post(
      `${API_BASE}/alerts`,
      {
        symbol: 'KSBBL',
        condition: 'ABOVE',
        alert_type: 'WACC_PERCENTAGE',
        target_percentage: 20.0
      },
      {
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Alert created successfully:');
    console.log('   Alert ID:', createResponse.data.data.id);
    console.log('   Symbol:', createResponse.data.data.symbol);
    console.log('   Type:', createResponse.data.data.alert_type);
    console.log('   Target %:', createResponse.data.data.target_percentage);

    const alertId = createResponse.data.data.id;

    // Test 2: Get all alerts
    console.log('\n2. Fetching all alerts...');
    const getResponse = await axios.get(
      `${API_BASE}/alerts`,
      {
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${mockToken}`
        }
      }
    );

    console.log('✅ Found', getResponse.data.data.length, 'alert(s)');
    const waccAlerts = getResponse.data.data.filter(a => a.alert_type === 'WACC_PERCENTAGE');
    console.log('   -', waccAlerts.length, 'WACC-based alert(s)');

    // Test 3: Update the alert
    console.log('\n3. Updating alert target to +15%...');
    await axios.put(
      `${API_BASE}/alerts/${alertId}`,
      {
        target_percentage: 15.0
      },
      {
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${mockToken}`
        }
      }
    );
    console.log('✅ Alert updated successfully');

    // Test 4: Delete the alert
    console.log('\n4. Deleting test alert...');
    await axios.delete(
      `${API_BASE}/alerts/${alertId}`,
      {
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${mockToken}`
        }
      }
    );
    console.log('✅ Alert deleted successfully');

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testWaccAlert();
