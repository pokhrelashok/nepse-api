
const { getUpdates } = require('./src/controllers/marketController');
const { getLatestPrices, getCurrentMarketStatus, getMarketIndexData } = require('./src/database/queries');

// Mock dependencies
jest.mock('./src/database/queries', () => ({
  getLatestPrices: jest.fn().mockResolvedValue([]),
  getCurrentMarketStatus: jest.fn().mockResolvedValue({ is_open: false }),
  getMarketIndexData: jest.fn().mockResolvedValue({ nepse_index: 2000 })
}));

// Mock Res
const res = {
  json: jest.fn(),
  status: jest.fn().mockReturnThis()
};

const req = {
  body: {} // Empty body
};

async function test() {
  await getUpdates(req, res);
  console.log('Response:', JSON.stringify(res.json.mock.calls[0][0], null, 2));
}

test();
