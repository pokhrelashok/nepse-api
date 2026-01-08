const { parseNumber, cleanText } = require('./utils/parsers');

/**
 * Company Scraper - Handles company details, dividends, and financials scraping
 */
class CompanyScraper {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  parseApiProfileData(profileData, securityData, symbol) {
    const info = {
      rawLogoData: '',
      isLogoPlaceholder: true,
      companyName: '',
      sectorName: '',
      email: '',
      permittedToTrade: 'No',
      status: '',
      instrumentType: '',
      listingDate: '',
      lastTradedPrice: 0,
      totalTradedQuantity: 0,
      totalTrades: 0,
      previousClose: 0,
      highPrice: 0,
      lowPrice: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      openPrice: 0,
      closePrice: 0,
      totalListedShares: 0,
      totalPaidUpValue: 0,
      marketCapitalization: 0,
      paidUpCapital: 0,
      issueManager: '',
      shareRegistrar: '',
      website: '',
      promoterShares: 0,
      publicShares: 0,
      averageTradedPrice: 0,
      isin: '',
      faceValue: 0,
      regulatoryBody: '',
      shareGroup: '',
      issuedCapital: 0,
      promoterPercentage: 0,
      publicPercentage: 0,
      updatedDate: '',
      businessDate: '',
      lastUpdatedDateTime: ''
    };

    const clean = (text) => text ? String(text).replace(/\s+/g, ' ').trim() : '';

    if (profileData) {
      if (!info.companyName) info.companyName = clean(profileData.companyName || '');
      if (!info.email) info.email = clean(profileData.companyEmail || '');

      if (!info.rawLogoData && profileData.logoFilePath) {
        info.rawLogoData = profileData.logoFilePath;
        info.isLogoPlaceholder = false;
      }
      if (info.rawLogoData && info.rawLogoData.startsWith('assets/')) {
        info.rawLogoData = `https://www.nepalstock.com/${info.rawLogoData}`;
      }
    }

    if (securityData) {
      const security = securityData.security || {};
      const dailyTrade = securityData.securityDailyTradeDto || {};
      const companyInfo = security.companyId || {};
      const sectorMaster = companyInfo.sectorMaster || {};

      if (security.instrumentType && typeof security.instrumentType === 'object') {
        info.instrumentType = clean(security.instrumentType.description || security.instrumentType.code || '');
      } else {
        info.instrumentType = clean(security.instrumentType || '');
      }

      info.status = clean(security.activeStatus || security.status || '');
      info.permittedToTrade = clean(security.permittedToTrade || 'No');
      info.listingDate = clean(security.listingDate || '');
      info.sectorName = clean(sectorMaster.sectorDescription || '');
      info.website = clean(companyInfo.companyWebsite || '');
      info.shareRegistrar = clean(companyInfo.companyContactPerson || '');

      info.lastTradedPrice = parseNumber(dailyTrade.lastTradedPrice);
      info.totalTradedQuantity = parseNumber(dailyTrade.totalTradeQuantity);
      info.totalTrades = parseInt(parseNumber(dailyTrade.totalTrades), 10);
      info.previousClose = parseNumber(dailyTrade.previousClose);
      info.highPrice = parseNumber(dailyTrade.highPrice);
      info.lowPrice = parseNumber(dailyTrade.lowPrice);
      info.openPrice = parseNumber(dailyTrade.openPrice);
      info.closePrice = parseNumber(dailyTrade.closePrice);

      if (dailyTrade.averageTradedPrice) {
        info.averageTradedPrice = parseNumber(dailyTrade.averageTradedPrice);
      } else if (dailyTrade.totalTradeQuantity && dailyTrade.totalTradeQuantity > 0) {
        const totalValue = parseNumber(dailyTrade.totalTradeValue || 0);
        if (totalValue > 0) {
          info.averageTradedPrice = totalValue / dailyTrade.totalTradeQuantity;
        }
      }

      info.totalListedShares = parseNumber(securityData.stockListedShares);
      info.paidUpCapital = parseNumber(securityData.paidUpCapital);
      info.totalPaidUpValue = parseNumber(securityData.paidUpCapital);
      info.marketCapitalization = parseNumber(securityData.marketCapitalization);
      info.promoterShares = parseNumber(securityData.promoterShares);
      info.publicShares = parseNumber(securityData.publicShares);

      info.fiftyTwoWeekHigh = parseNumber(dailyTrade.fiftyTwoWeekHigh);
      info.fiftyTwoWeekLow = parseNumber(dailyTrade.fiftyTwoWeekLow);

      info.isin = clean(security.isin || '');
      info.faceValue = parseNumber(security.faceValue);
      info.regulatoryBody = clean(sectorMaster.regulatoryBody || '');
      info.shareGroup = clean(security.shareGroupId?.name || '');
      info.issuedCapital = parseNumber(securityData.issuedCapital);
      info.promoterPercentage = parseNumber(securityData.promoterPercentage);
      info.publicPercentage = parseNumber(securityData.publicPercentage);
      info.updatedDate = clean(securityData.updatedDate || '');
      info.businessDate = clean(dailyTrade.businessDate || '');
      info.lastUpdatedDateTime = clean(dailyTrade.lastUpdatedDateTime || '');
    }

    return info;
  }

  async scrapeAllCompanyDetails(securityIds, saveCallback = null, dividendCallback = null, financialCallback = null) {
    if (!securityIds || securityIds.length === 0) return [];

    console.log(`🏢 Starting company details scrape for ${securityIds.length} companies...`);
    await this.browserManager.init();

    const browser = this.browserManager.getBrowser();
    const userAgent = this.browserManager.getUserAgent();
    const details = [];
    let page = null;

    try {
      page = await browser.newPage();
      await page.setUserAgent(userAgent);

      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      let count = 0;
      for (const sec of securityIds) {
        count++;
        const { security_id, symbol } = sec;
        const url = `https://www.nepalstock.com/company/detail/${security_id}`;

        let apiSecurityData = null;
        let apiProfileData = null;

        const responseHandler = async (response) => {
          const responseUrl = response.url();

          if (responseUrl.includes('/api/nots/security/') && responseUrl.includes(`/${security_id}`)) {
            try {
              const status = response.status();

              if (status === 200 || status === 401) {
                const data = await response.json().catch(() => null);
                if (data) {
                  if (responseUrl.includes('/profile/')) {
                    apiProfileData = data;
                  } else {
                    apiSecurityData = data;
                  }
                }
              }
            } catch (e) {
              // Silently handle API parsing errors
            }
          }
        };

        page.on('response', responseHandler);

        let retries = 2;
        let success = false;

        while (retries > 0 && !success) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            await new Promise(resolve => setTimeout(resolve, 2000));

            await page.waitForSelector('.company__title--details', { timeout: 3000 }).catch(() => { });

            const profileTab = await page.$('#profileTab');
            if (profileTab) {
              await page.evaluate(el => el.click(), profileTab);
              await new Promise(resolve => setTimeout(resolve, 1500));
              await page.waitForSelector('#profile_section', { timeout: 3000 }).catch(() => { });
            }

            success = true;
          } catch (err) {
            console.warn(`⚠️ Navigation failed for ${symbol} (retry ${3 - retries}): ${err.message}`);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        page.off('response', responseHandler);

        if (!success) {
          console.error(`❌ Failed to navigate to ${symbol} after multiple retries.`);
          continue;
        }

        let data;
        try {
          if (apiProfileData || apiSecurityData) {
            data = this.parseApiProfileData(apiProfileData, apiSecurityData, symbol);
          } else {
            const iframeHandle = await page.$('#company_detail_iframe');
            let targetFrame = page;

            if (iframeHandle) {
              const frame = await iframeHandle.contentFrame();
              if (frame) {
                targetFrame = frame;
                await frame.waitForSelector('table, .company__title--details', { timeout: 5000 }).catch(() => { });
              }
            }

            data = await targetFrame.evaluate(() => {
              const info = {};

              const clean = (text) => text ? text.replace(/\s+/g, ' ').trim() : '';
              const parseNumber = (text) => {
                if (!text) return 0;
                return parseFloat(text.replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
              };

              let logoImg = document.querySelector('#profile_section .team-member img');
              if (!logoImg || logoImg.getAttribute('src').includes('placeholder')) {
                logoImg = document.querySelector('.company__title--logo img');
              }
              info.rawLogoData = logoImg ? logoImg.getAttribute('src') : '';
              if (info.rawLogoData && info.rawLogoData.startsWith('assets/')) {
                info.rawLogoData = `https://www.nepalstock.com/${info.rawLogoData}`;
              }
              info.isLogoPlaceholder = info.rawLogoData.includes('placeholder');

              const companyNameEl = document.querySelector('.company__title--details h1');
              let companyName = companyNameEl ? clean(companyNameEl.innerText) : '';
              info.companyName = companyName.replace(/\s*\([A-Z]+\)\s*$/, '').trim();

              const metaItems = document.querySelectorAll('.company__title--metas li');
              metaItems.forEach(li => {
                const text = li.innerText;
                if (text.includes('Sector:')) {
                  info.sectorName = clean(text.split('Sector:')[1]);
                } else if (text.includes('Email Address:')) {
                  info.email = clean(text.split('Email Address:')[1]);
                } else if (text.includes('Status:')) {
                  info.status = clean(text.split('Status:')[1]);
                } else if (text.includes('Permitted to Trade:')) {
                  info.permittedToTrade = clean(text.split('Permitted to Trade:')[1]);
                }
              });

              const getTableValue = (label) => {
                const rows = Array.from(document.querySelectorAll('table tr'));
                for (const row of rows) {
                  const th = row.querySelector('th');
                  const td = row.querySelector('td');
                  if (th && td && th.innerText.trim().includes(label)) {
                    return clean(td.innerText);
                  }
                }
                return null;
              };

              info.instrumentType = getTableValue('Instrument Type') || '';
              info.listingDate = getTableValue('Listing Date') || '';

              const lastTradedPriceCell = getTableValue('Last Traded Price');
              if (lastTradedPriceCell) {
                const priceMatch = lastTradedPriceCell.match(/([0-9,]+\.?[0-9]*)/);
                info.lastTradedPrice = priceMatch ? parseNumber(priceMatch[1]) : 0;
              } else {
                info.lastTradedPrice = 0;
              }

              info.totalTradedQuantity = parseNumber(getTableValue('Total Traded Quantity'));
              info.totalTrades = parseInt(parseNumber(getTableValue('Total Trades')), 10);
              info.previousClose = parseNumber(getTableValue('Previous Day Close Price'));

              const highLowText = getTableValue('High Price / Low Price');
              if (highLowText) {
                const parts = highLowText.split('/');
                info.highPrice = parts[0] ? parseNumber(parts[0]) : 0;
                info.lowPrice = parts[1] ? parseNumber(parts[1]) : 0;
              } else {
                info.highPrice = 0;
                info.lowPrice = 0;
              }

              const fiftyTwoWeekText = getTableValue('52 Week High / 52 Week Low');
              if (fiftyTwoWeekText) {
                const parts = fiftyTwoWeekText.split('/');
                info.fiftyTwoWeekHigh = parts[0] ? parseNumber(parts[0]) : 0;
                info.fiftyTwoWeekLow = parts[1] ? parseNumber(parts[1]) : 0;
              } else {
                info.fiftyTwoWeekHigh = 0;
                info.fiftyTwoWeekLow = 0;
              }

              info.openPrice = parseNumber(getTableValue('Open Price'));

              const closePriceText = getTableValue('Close Price');
              info.closePrice = parseNumber(closePriceText ? closePriceText.replace('*', '') : '0');

              info.totalListedShares = parseNumber(getTableValue('Total Listed Shares'));
              info.totalPaidUpValue = parseNumber(getTableValue('Total Paid up Value'));
              info.marketCapitalization = parseNumber(getTableValue('Market Capitalization'));
              info.paidUpCapital = info.totalPaidUpValue || parseNumber(getTableValue('Paid Up Capital'));
              info.issueManager = getTableValue('Issue Manager') || '';
              info.shareRegistrar = getTableValue('Share Registrar') || '';
              info.website = getTableValue('Website') || '';
              info.promoterShares = parseNumber(getTableValue('Promoter Shares'));
              info.publicShares = parseNumber(getTableValue('Public Shares'));
              info.averageTradedPrice = parseNumber(getTableValue('Average Traded Price'));

              return info;
            });
          }

          const processImageData = require('../../utils/image-handler').processImageData;
          const translateToNepali = require('../../services/translation-service').translateToNepali;

          const processedLogoUrl = await processImageData(data.rawLogoData, symbol);

          const nepaliCompanyName = await translateToNepali(data.companyName);
          const nepaliSectorName = await translateToNepali(data.sectorName);

          const item = {
            securityId: security_id,
            symbol: symbol,
            ...data,
            nepali_company_name: nepaliCompanyName,
            nepali_sector_name: nepaliSectorName,
            logoUrl: processedLogoUrl
          };

          delete item.rawLogoData;

          details.push(item);

          if (saveCallback) {
            try {
              await saveCallback([item]);
              console.log(`💾 Saved ${symbol} (${count}/${securityIds.length})`);
            } catch (saveErr) {
              console.error(`❌ Failed to save ${symbol}:`, saveErr.message);
            }
          }

          if (dividendCallback) {
            try {
              const dividendTab = await page.$('#dividendTab');
              if (dividendTab) {
                await page.evaluate(el => el.click(), dividendTab);
                await new Promise(r => setTimeout(r, 1000));

                try {
                  await page.waitForFunction(
                    () => document.querySelector('#dividend table tbody tr') !== null,
                    { timeout: 3000 }
                  );
                } catch (e) { /* ignore timeout */ }

                await page.waitForSelector('#dividend table', { timeout: 2000 }).catch(() => { });

                const dividends = await page.evaluate((secId) => {
                  const table = document.querySelector('#dividend table');
                  if (!table) return [];

                  const rows = Array.from(table.querySelectorAll('tbody tr'));

                  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase().replace(/\s+/g, ' ').trim());

                  const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                  const idxFY = getIdx(['fiscal', 'year']);
                  const idxBonus = getIdx(['bonus']);
                  const idxCash = getIdx(['cash']);
                  const idxTotal = getIdx(['total']);
                  const idxBookClose = getIdx(['book', 'closure', 'date']);

                  return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return null;

                    const cleanVal = (idx) => idx !== -1 && cells[idx] ? cells[idx].innerText.trim() : null;

                    const parseNum = (txt) => {
                      if (!txt) return 0;
                      return parseFloat(txt.replace(/%|Rs\.?|,/g, '').trim()) || 0;
                    };

                    const fy = cleanVal(idxFY) || (cells[1] ? cells[1].innerText.trim() : null);
                    if (!fy) return null;

                    const bonus = parseNum(cleanVal(idxBonus));
                    const cash = parseNum(cleanVal(idxCash));
                    const total = idxTotal !== -1 ? parseNum(cleanVal(idxTotal)) : (bonus + cash);

                    return {
                      securityId: secId,
                      fiscalYear: fy,
                      bonusShare: bonus,
                      cashDividend: cash,
                      totalDividend: total,
                      publishedDate: cleanVal(idxBookClose) || ''
                    };
                  }).filter(d => d && d.fiscalYear);
                }, security_id);

                if (dividends.length > 0) {
                  await dividendCallback(dividends);
                  console.log(`   💰 Saved ${dividends.length} dividend records`);
                }
              }
            } catch (divErr) {
              console.warn(`   ⚠️ Dividend scrape failed for ${symbol}: ${divErr.message}`);
            }
          }

          if (financialCallback) {
            try {
              let financialTab = await page.$('#financialTab, #financialsTab');
              if (!financialTab) {
                const tabs = await page.$$('.nav-link');
                for (const tab of tabs) {
                  const text = await page.evaluate(el => el.innerText, tab);
                  if (text && text.trim().includes('Financial')) {
                    financialTab = tab;
                    break;
                  }
                }
              }

              if (financialTab) {
                await page.evaluate(el => el.click(), financialTab);
                await new Promise(r => setTimeout(r, 1000));

                try {
                  await page.waitForFunction(
                    () => document.querySelector('div[id*="financial"] table tbody tr') !== null,
                    { timeout: 3000 }
                  );
                } catch (e) { /* ignore */ }
                await page.waitForSelector('div[id*="financial"] table', { timeout: 5000 }).catch(() => { });

                const financials = await page.evaluate((secId) => {
                  const table = document.querySelector('div[id*="financial"] table');
                  if (!table) return [];

                  const rows = Array.from(table.querySelectorAll('tbody tr'));

                  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.toLowerCase().replace(/\s+/g, ' ').trim());
                  const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                  const idxFY = getIdx(['fiscal', 'year']);
                  const idxQ = getIdx(['quart']);
                  const idxPaidUp = getIdx(['paid', 'capital']);
                  const idxProfit = getIdx(['net profit', 'profit', 'amount']);
                  const idxEPS = getIdx(['eps', 'earnings']);
                  const idxNetWorth = getIdx(['net worth', 'book value']);
                  const idxPE = getIdx(['p/e', 'price earning', 'p.e', 'ratio']);

                  return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return null;

                    const parseNum = (txt) => {
                      if (!txt) return 0;
                      return parseFloat(txt.replace(/,/g, '').trim()) || 0;
                    };

                    const getVal = (idx) => idx !== -1 && cells[idx] ? cells[idx].innerText.trim() : null;
                    const getNum = (idx) => idx !== -1 && cells[idx] ? parseNum(cells[idx].innerText) : 0;

                    const fy = getVal(idxFY) || (cells[1] ? cells[1].innerText.trim() : null);
                    if (!fy) return null;

                    return {
                      securityId: secId,
                      fiscalYear: fy,
                      quarter: getVal(idxQ) || (cells[3] ? cells[3].innerText.trim() : ''),
                      paidUpCapital: getNum(idxPaidUp) || getNum(6),
                      netProfit: getNum(idxProfit) || getNum(5),
                      earningsPerShare: getNum(idxEPS) || getNum(8),
                      netWorthPerShare: getNum(idxNetWorth) || getNum(4),
                      priceEarningsRatio: getNum(idxPE) || getNum(7)
                    };
                  }).filter(f => f && f.fiscalYear);
                }, security_id);

                if (financials.length > 0) {
                  await financialCallback(financials);
                  console.log(`   📈 Saved ${financials.length} financial records`);
                }
              }
            } catch (finErr) {
              console.warn(`   ⚠️ Financials scrape failed for ${symbol}: ${finErr.message}`);
            }
          }

        } catch (evalError) {
          console.error(`❌ Failed to evaluate page for ${symbol}:`, evalError.message);
          continue;
        }

        if (count % 10 === 0) {
          console.log(`📊 Progress: ${count}/${securityIds.length}`);
        }
      }

      if (page) {
        await page.close().catch(() => { });
      }
    } catch (e) {
      console.error('❌ Error in company details scraping:', e);
      if (page) {
        await page.close().catch(() => { });
      }
    }

    return details;
  }
}

module.exports = CompanyScraper;
