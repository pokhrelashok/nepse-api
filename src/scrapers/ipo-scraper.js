const { insertIpo } = require('../database/queries');
const logger = require('../utils/logger');
const aiService = require('../services/ai-service');

// Headers user provided
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-GPC': '1',
  'Connection': 'keep-alive',
  'Referer': 'https://www.nepalipaisa.com/ipo',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

async function fetchIpos(pageNo = 1, itemsPerPage = 10) {
  const url = `https://www.nepalipaisa.com/api/GetIpos?stockSymbol=&pageNo=${pageNo}&itemsPerPage=${itemsPerPage}&pagePerDisplay=5&_=${Date.now()}`;

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
    logger.error(`Error fetching IPOs page ${pageNo}:`, error);
    throw error;
  }
}

async function scrapeIpos(checkAll = false) {
  logger.info('Starting IPO scrape...');

  let page = 1;
  let hasNextPage = true;
  let newRecordCount = 0;

  try {
    while (hasNextPage) {
      logger.info(`Fetching IPOs page ${page}...`);
      const response = await fetchIpos(page);

      const { result } = response;
      if (!result || !result.data || result.data.length === 0) {
        logger.info('No data found properly.');
        break;
      }

      const ipos = result.data;

      // Save to database
      for (const ipo of ipos) {
        // Clean data (handle empty strings for numeric fields)
        const cleanedIpo = {
          ...ipo,
          units: ipo.units === "" ? null : ipo.units,
          minUnits: ipo.minUnits === "" ? null : ipo.minUnits,
          maxUnits: ipo.maxUnits === "" ? null : ipo.maxUnits,
          totalAmount: ipo.totalAmount === "" ? null : ipo.totalAmount,
          pricePerUnit: ipo.pricePerUnit === "" ? null : ipo.pricePerUnit,
          openingDateAD: ipo.openingDateAD === "" ? null : ipo.openingDateAD,
          closingDateAD: ipo.closingDateAD === "" ? null : ipo.closingDateAD
        };

        // Translate company name and sector name to Nepali
        const nepaliCompanyName = await aiService.translateToNepali(ipo.companyName);
        const nepaliSectorName = await aiService.translateToNepali(ipo.sectorName);

        cleanedIpo.nepaliCompanyName = nepaliCompanyName;
        cleanedIpo.nepaliSectorName = nepaliSectorName;

        await insertIpo(cleanedIpo);
      }
      newRecordCount += ipos.length;

      // Check pagination logic
      // User output showed: result: { data: [...], pager: { ... } }
      // We need to stop if we processed enough, or checks "pager" to see total pages.
      // If checkAll is false, we only do page 1.
      if (!checkAll) {
        hasNextPage = false;
      } else {
        // Check pager for total pages
        const pager = result.pager;
        // Assuming pager has TotalPages or similar. 
        // If not explicit, we just loop until data is empty, which we handled above.
        // But safer to check pager if available.
        // Let's assume standard pager: { TotalItems, CurrentPage, PageSize, TotalPages, ... }
        if (pager && pager.TotalPages && page >= pager.TotalPages) {
          hasNextPage = false;
        } else if (ipos.length < 10) {
          // Heuristic if pager structure isn't exactly known but list is smaller than limit
          hasNextPage = false;
        } else {
          page++;
        }
      }

      // Safety break
      if (page > 100) hasNextPage = false;
    }

    logger.info(`IPO scrape completed. Processed ${newRecordCount} records.`);
    return newRecordCount;
  } catch (error) {
    logger.error('IPO scrape failed:', error);
    throw error;
  }
}

// Standalone execution if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');

  scrapeIpos(checkAll)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { scrapeIpos };
