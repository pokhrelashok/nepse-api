const { insertIpo } = require('../database/queries');
const logger = require('../utils/logger');
const aiService = require('../services/ai-service');

// Headers for Nepali Paisa API
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-GPC': '1',
  'Connection': 'keep-alive',
  'Referer': 'https://www.nepalipaisa.com/fpo',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

async function fetchFpos(pageNo = 1, itemsPerPage = 10) {
  const url = `https://www.nepalipaisa.com/api/GetFpos?stockSymbol=&pageNo=${pageNo}&itemsPerPage=${itemsPerPage}&pagePerDisplay=5&_=${Date.now()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: HEADERS
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      logger.error('Failed to parse API response as JSON. Raw response preview:', text.substring(0, 200));
      throw e;
    }
  } catch (error) {
    logger.error(`Error fetching FPOs page ${pageNo}:`, error);
    throw error;
  }
}

async function scrapeFpos(checkAll = false) {
  logger.info('Starting FPO scrape...');

  let page = 1;
  let hasNextPage = true;
  let newRecordCount = 0;

  try {
    while (hasNextPage) {
      logger.info(`Fetching FPOs page ${page}...`);
      const response = await fetchFpos(page);

      const { result } = response;
      if (!result || !result.data || result.data.length === 0) {
        logger.info('No FPO data found.');
        break;
      }

      const fpos = result.data;

      // Save to database
      for (const fpo of fpos) {
        // Clean and Map data 
        // Note: insertIpo expects CamelCase fields in the object
        const mappedFpo = {
          ipoId: fpo.fpoId,
          companyName: fpo.companyName || fpo.stockSymbol, // Use symbol as backup name
          stockSymbol: fpo.stockSymbol,
          shareRegistrar: fpo.shareRegistrar,
          sectorName: fpo.sectorName,
          shareType: fpo.shareType, // 'ordinary', 'local' etc.
          offeringType: 'fpo',
          pricePerUnit: fpo.pricePerUnit === "" ? null : fpo.pricePerUnit,
          rating: fpo.rating,
          units: fpo.units === "" ? null : fpo.units,
          minUnits: fpo.minUnits === "" ? null : fpo.minUnits,
          maxUnits: fpo.maxUnits === "" ? null : fpo.maxUnits,
          totalAmount: fpo.totalAmount === "" ? null : fpo.totalAmount,
          openingDateAD: fpo.openingDateAD === "" ? null : fpo.openingDateAD,
          closingDateAD: fpo.closingDateAD === "" ? null : fpo.closingDateAD,
          status: fpo.status
        };

        // Translate company name and sector name to Nepali
        const nepaliCompanyName = await aiService.translateToNepali(mappedFpo.companyName);
        const nepaliSectorName = await aiService.translateToNepali(mappedFpo.sectorName);

        mappedFpo.nepaliCompanyName = nepaliCompanyName;
        mappedFpo.nepaliSectorName = nepaliSectorName;

        await insertIpo(mappedFpo);
      }
      newRecordCount += fpos.length;

      // Pagination logic
      if (!checkAll) {
        hasNextPage = false;
      } else {
        const pager = result.pager;
        if (pager && pager.TotalPages && page >= pager.TotalPages) {
          hasNextPage = false;
        } else if (fpos.length < 10) {
          hasNextPage = false;
        } else {
          page++;
        }
      }

      // Safety break
      if (page > 100) hasNextPage = false;
    }

    logger.info(`FPO scrape completed. Processed ${newRecordCount} records.`);
    return newRecordCount;
  } catch (error) {
    logger.error('FPO scrape failed:', error);
    throw error;
  }
}

// Standalone execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');

  scrapeFpos(checkAll)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { scrapeFpos };
