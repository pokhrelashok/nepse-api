const logger = require('../utils/logger');
const aiService = require('../services/ai-service');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-GPC': '1',
  'Connection': 'keep-alive',
  'Referer': 'https://nepalipaisa.com/merger',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Priority': 'u=0'
};

async function fetchMergers(pageNo = 1, itemsPerPage = 20) {
  const url = `https://nepalipaisa.com/api/GetMergerAquisitions?stockSymbol=&sectorCode=&action=&status=1&pageNo=${pageNo}&itemsPerPage=${itemsPerPage}&pagePerDisplay=5&_=${Date.now()}`;

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
    logger.error(`Error fetching Mergers page ${pageNo}:`, error);
    throw error;
  }
}

async function scrapeMergers(checkAll = false) {
  logger.info('Starting Merger/Acquisition scrape...');

  let page = 1;
  let hasNextPage = true;
  let newRecordCount = 0;

  const { insertMergers } = require('../database/queries');

  try {
    while (hasNextPage) {
      logger.info(`Fetching Merger/Acquisition page ${page}...`);
      const response = await fetchMergers(page);

      const { result } = response;
      if (!result || !result.data || result.data.length === 0) {
        logger.info('No data found.');
        break;
      }

      const items = result.data;

      for (const item of items) {
        // Build companies array from all companies involved
        const companies = [];

        const addCompanyIfExists = (id, name, symbol) => {
          if (name && symbol) {
            companies.push({
              name,
              nepali_name: name, // TODO: Add translation when AI service is stable
              symbol
            });
          }
        };

        // Add all involved companies
        addCompanyIfExists(item.company1Id, item.company1Name, item.company1StockSymbol);
        addCompanyIfExists(item.company2Id, item.company2Name, item.company2StockSymbol);
        addCompanyIfExists(item.company3Id, item.company3Name, item.company3StockSymbol);
        addCompanyIfExists(item.company4Id, item.company4Name, item.company4StockSymbol);
        addCompanyIfExists(item.company5Id, item.company5Name, item.company5StockSymbol);

        // Map API response to database columns
        const mergerData = {
          merger_acquisition_id: item.mergerAcquisitionId,
          sector_id: item.sectorId,
          sector_name: item.sectorName,
          nepali_sector_name: item.sectorName, // TODO: Add translation when AI service is stable
          new_company_name: item.newCompanyName,
          nepali_new_company_name: item.newCompanyName, // TODO: Add translation when AI service is stable
          new_company_stock_symbol: item.newCompanyStockSymbol,
          companies: JSON.stringify(companies),
          swap_ratio: item.swapRatio || null,
          mou_date_ad: item.mouDateAd || null,
          mou_date_bs: item.mouDateBs || null,
          final_approval_date_ad: item.finalApprovalDateAd || null,
          final_approval_date_bs: item.finalApprovalDateBs || null,
          joint_date_ad: item.jointDateAd || null,
          joint_date_bs: item.jointDateBs || null,
          action: item.action,
          is_completed: item.isCompleted || false,
          is_trading: item.isTrading || false
        };

        await insertMergers(mergerData);
      }

      newRecordCount += items.length;

      // Pagination logic
      if (!checkAll) {
        hasNextPage = false;
      } else {
        if (items.length < itemsPerPage) {
          hasNextPage = false;
        } else {
          page++;
        }
      }
    }

    logger.info(`✅ Merger/Acquisition scrape completed: ${newRecordCount} records processed`);
    return newRecordCount;
  } catch (error) {
    logger.error('❌ Merger/Acquisition scrape failed:', error);
    throw error;
  }
}

// Standalone execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');

  scrapeMergers(checkAll)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { scrapeMergers };
