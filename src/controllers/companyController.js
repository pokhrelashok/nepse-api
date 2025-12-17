const {
  searchStocks,
  getScriptDetails,
  getAllCompanies,
  getCompaniesBySector,
  getTopCompaniesByMarketCap,
  getIpos,
  insertIpo,
  getAnnouncedDividends
} = require('../database/queries');
const { formatResponse, formatError } = require('../utils/formatter');

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
    const symbol = req.params.symbol.toUpperCase();
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
    const fromDate = req.query.from;
    const toDate = req.query.to;

    const ipos = await getIpos(limit, offset, fromDate, toDate);
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
    const fromDate = req.query.from;
    const toDate = req.query.to;

    const dividends = await getAnnouncedDividends(limit, offset, fromDate, toDate);
    res.json(formatResponse(dividends));
  } catch (e) {
    console.error('API Announced Dividends Error:', e);
    res.status(500).json(formatError("Internal Server Error"));
  }
};
