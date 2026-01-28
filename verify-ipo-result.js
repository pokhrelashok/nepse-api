const { checkIpoResult } = require('./src/controllers/ipo-result-controller');
const logger = require('./src/utils/logger');

// Mock request and response
const req = {
  body: {
    boid: '1301670000015818',
    companyName: 'Solu Hydropower Ltd. (General Public)',
    shareType: 'ordinary'
  }
};

const res = {
  status: (code) => ({
    json: (data) => {
      console.log(`Status: ${code}`);
      console.log(JSON.stringify(data, null, 2));
    }
  }),
  json: (data) => {
    console.log('Status: 200');
    console.log(JSON.stringify(data, null, 2));
  }
};

console.log('Testing IPO result check with detached data...');
checkIpoResult(req, res)
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed', err));
