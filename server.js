const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { searchStocks, getScriptDetails, getLatestPrices } = require('./db');
const { formatResponse, formatError } = require('./formatter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 1. Search API
// Endpoint: GET /api/search?q=NABIL
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json(formatError("Query 'q' must be at least 2 chars", 400));
    }
    const results = await searchStocks(query);
    res.json(formatResponse(results));
  } catch (e) {
    console.error('[API] Search Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

// 2. Script Details API
// Endpoint: GET /api/script/NABIL
app.get('/api/script/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const details = await getScriptDetails(symbol);

    if (!details) {
      return res.status(404).json(formatError(`Script '${symbol}' not found`, 404));
    }
    res.json(formatResponse(details));
  } catch (e) {
    console.error('[API] Detail Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

// 3. Batch Latest Prices API
// Endpoint: POST /api/prices
// Body: { "symbols": ["NABIL", "SHIVM"] }
app.post('/api/prices', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json(formatError("Invalid body. Expected { symbols: ['SYM', ...] }", 400));
    }

    const data = await getLatestPrices(symbols);
    res.json(formatResponse(data));
  } catch (e) {
    console.error('[API] Prices Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] API running at http://localhost:${PORT}`);
});
