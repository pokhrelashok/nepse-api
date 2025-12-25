const { insertAnnouncedDividends } = require('../database/queries');
const logger = require('../utils/logger');
const { translateToNepali } = require('../services/translation-service');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-GPC': '1',
  'Connection': 'keep-alive',
  'Referer': 'https://www.nepalipaisa.com/dividend',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Priority': 'u=0'
};

async function fetchDividends(pageNo = 1, itemsPerPage = 20) {
  const url = `https://www.nepalipaisa.com/api/GetDividendRights?stockSymbol=&pageNo=${pageNo}&itemsPerPage=${itemsPerPage}&pagePerDisplay=5&_=${Date.now()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: HEADERS
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error(`Error fetching Dividends page ${pageNo}:`, error);
    throw error;
  }
}

async function scrapeDividends(checkAll = false) {
  logger.info('Starting Announced Dividends scrape...');

  let page = 1;
  let hasNextPage = true;
  let newRecordCount = 0;

  try {
    while (hasNextPage) {
      logger.info(`Fetching Announced Dividends page ${page}...`);
      const response = await fetchDividends(page);

      const { result } = response;
      if (!result || !result.data || result.data.length === 0) {
        logger.info('No data found.');
        break;
      }

      const items = result.data;

      for (const item of items) {
        // Find published_date from dividends table
        const publishedDate = await require('../database/queries').findPublishedDate(item.stockSymbol, item.fiscalYearAD, item.fiscalYearBS);

        // Translate company name to Nepali
        const nepaliCompanyName = await translateToNepali(item.companyName);

        // Map API response to database columns
        const dividendData = {
          symbol: item.stockSymbol,
          company_name: item.companyName,
          nepali_company_name: nepaliCompanyName,
          bonus_share: item.bonus === "" ? null : item.bonus,
          cash_dividend: item.cash === "" ? null : item.cash,
          total_dividend: item.totalDividend === "" ? null : item.totalDividend,
          book_close_date: item.bookClosureDateAD === "" ? null : item.bookClosureDateAD,
          published_date: publishedDate, // Synced from dividends table
          fiscal_year: item.fiscalYearAD,
          fiscal_year_bs: item.fiscalYearBS,
          book_close_date_bs: item.bookClosureDateBS === "" ? null : item.bookClosureDateBS,
          right_share: item.rightShare === "" ? null : item.rightShare,
          right_book_close_date: item.rightBookCloseDateAD === "" ? null : item.rightBookCloseDateAD
        };
        await insertAnnouncedDividends(dividendData);
      }
      newRecordCount += items.length;

      // Pagination logic
      if (!checkAll) {
        hasNextPage = false;
      } else {
        const pager = result.pager;
        // The pager usually has totalNextPages or similar. 
        // Based on ipo-scraper, let's assume if there are items, we check if we should continue.
        // The result structure showed "totalNextPages": 5.
        // We can just keep going until data is empty or we hit a limit.
        if (items.length < 20) {
          hasNextPage = false;
        } else {
          page++;
        }
      }

      // Safety break
      if (page > 100) hasNextPage = false;
    }

    logger.info(`Announced Dividends scrape completed. Processed ${newRecordCount} records.`);
    return newRecordCount;
  } catch (error) {
    logger.error('Announced Dividends scrape failed:', error);
    throw error;
  }
}

// Standalone execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');

  scrapeDividends(checkAll)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { scrapeDividends };
