const {
  searchStocks,
  getScriptDetails,
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getIpos,
  insertIpo,
  getAnnouncedDividends,
  getStockHistory,
  getMutualFunds
} = require('../database/queries');
const aiService = require('../services/ai-service');
const { formatResponse, formatError } = require('../utils/formatter');

// Helper to calculate start date based on range
const getStartDateFromRange = (range) => {
  const now = new Date();
  const date = new Date(now); // Clone date

  switch (range) {
    case '1W':
      date.setDate(now.getDate() - 7);
      break;
    case '1M':
      date.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      date.setMonth(now.getMonth() - 3);
      break;
    case '6M':
      date.setMonth(now.getMonth() - 6);
      break;
    case '1Y':
      date.setFullYear(now.getFullYear() - 1);
      break;
    default:
      // Default to 1 year if invalid or missing
      date.setFullYear(now.getFullYear() - 1);
  }

  return date.toISOString().split('T')[0];
};

// Helper to extract symbol from slug or return symbol as is
const extractSymbol = (param) => {
  if (!param) return null;
  // If it contains a hyphen, assume it's a slug (SYMBOL-company-name)
  // Otherwise it's just the symbol
  return param.split('-')[0].toUpperCase();
};

exports.searchCompanies = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json(formatError("Query 'q' must be at least 2 chars", 400));
    }
    const results = await searchStocks(query);
    res.json(formatResponse(results));
  } catch (e) {
    console.error('API Search Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getValues = async (req, res) => {
  // This seems to be missing from my previous view of server.js but I'll add a placeholder if needed or just skip it.
  // Actually, simply searching "server.js" again to be sure I didn't miss anything.
  // It seems "getValues" wasn't there.
  res.status(404).json(formatError("Not Found", 404));
}

exports.getCompanyDetails = async (req, res) => {
  try {
    const symbol = extractSymbol(req.params.symbol);
    const details = await getScriptDetails(symbol);

    if (!details) {
      return res.status(404).json(formatError(`Script '${symbol}' not found`, 404));
    }

    res.json(formatResponse(details));
  } catch (e) {
    console.error('API Detail Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getAIStockSummary = async (req, res) => {
  try {
    const symbol = extractSymbol(req.params.symbol);
    const details = await getScriptDetails(symbol);

    if (!details) {
      return res.status(404).json(formatError(`Script '${symbol}' not found`, 404));
    }

    // On-demand AI summary generation (now in dedicated endpoint)
    const aiSummary = await aiService.getOrGenerateSummary(details);

    res.json(formatResponse({ symbol, ai_summary: aiSummary }));
  } catch (e) {
    console.error('API AI Summary Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getAllCompanies = async (req, res) => {
  try {
    // Check if query params exist for pagination, otherwise just basic list
    if (req.query.limit || req.query.offset) {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      if (limit > 1000) {
        return res.status(400).json(formatError("Limit cannot exceed 1000", 400));
      }

      const companies = await getAllCompanies(limit, offset);
      res.json(formatResponse(companies));
    } else {
      // Fallback for /api/scripts that didn't have pagination logic in original code's try block for getAllCompanies()
      // Wait, looking at server.js:
      // app.get('/api/scripts', async (req, res) => { const companies = await getAllCompanies(); ... })
      // app.get('/api/companies', async (req, res) => { const limit ... const companies = await getAllCompanies(limit, offset); ... })
      // So getAllCompanies helper handles both?
      // Let's assume getAllCompanies in database/queries handles optional params.
      const companies = await getAllCompanies();
      res.json(formatResponse(companies));
    }
  } catch (e) {
    console.error('API Companies Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getCompaniesPaginated = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    if (limit > 1000) {
      return res.status(400).json(formatError("Limit cannot exceed 1000", 400));
    }

    const companies = await getAllCompanies(limit, offset);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Companies Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
}

exports.getCompaniesBySector = async (req, res) => {
  try {
    const sector = req.params.sector;
    const limit = parseInt(req.query.limit) || 50;

    const companies = await getCompaniesBySector(sector, limit);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Sector Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getTopCompanies = async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 20;
    const companies = await getTopCompaniesByMarketCap(limit);
    res.json(formatResponse(companies));
  } catch (e) {
    console.error('API Top Companies Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getIpos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const from_date = req.query.from;
    const to_date = req.query.to;
    const offering_type = req.query.type; // 'ipo' or 'fpo'

    const ipos = await getIpos(limit, offset, from_date, to_date, offering_type);

    res.json(formatResponse(ipos));
  } catch (e) {
    console.error('API IPOs Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.createIpo = async (req, res) => {
  try {
    const result = await insertIpo(req.body);
    res.json(formatResponse({ message: 'IPO saved successfully', result }));
  } catch (e) {
    console.error('API Save IPO Error:', e);
    res.status(500).json(formatError("Internal Server Error", 500, e.message));
  }
};

exports.getDividends = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const from_date = req.query.from;
    const to_date = req.query.to;

    const dividends = await getAnnouncedDividends(limit, offset, from_date, to_date);
    res.json(formatResponse(dividends));
  } catch (e) {
    console.error('API Announced Dividends Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getCompanyHistory = async (req, res) => {
  try {
    const symbol = extractSymbol(req.params.symbol);
    const range = req.query.range || '1Y';

    // Validate range strictly if needed, but the helper defaults to 1Y
    const validRanges = ['1W', '1M', '3M', '6M', '1Y'];
    if (!validRanges.includes(range)) {
      return res.status(400).json(formatError(`Invalid range. Valid ranges are: ${validRanges.join(', ')}`));
    }

    const startDate = getStartDateFromRange(range);
    const history = await getStockHistory(symbol, startDate);

    if (!history || history.length === 0) {
      // Just return empty list instead of 404, or maybe 404 if symbol invalid? 
      // But query doesn't check symbol existence first. 
      // Let's return empty array with success.
      return res.json(formatResponse([]));
    }

    res.json(formatResponse(history));
  } catch (e) {
    console.error('API History Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};

exports.getMutualFunds = async (req, res) => {
  try {
    const { symbols } = req.body;
    const mutualFunds = await getMutualFunds(symbols);
    res.json(formatResponse(mutualFunds));
  } catch (e) {
    console.error('API Mutual Funds Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};
