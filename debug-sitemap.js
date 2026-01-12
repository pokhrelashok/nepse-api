const { getAllCompanies } = require('./src/database/queries');
const sitemapService = require('./src/services/sitemap-service');

async function test() {
  console.log('Testing getAllCompanies...');
  try {
    const companies = await getAllCompanies();
    console.log(`getAllCompanies returned type: ${typeof companies}`);
    if (Array.isArray(companies)) {
      console.log(`getAllCompanies returned array length: ${companies.length}`);
      if (companies.length > 0) {
        console.log('First company keys:', Object.keys(companies[0]));
        console.log('First company data:', companies[0]);
      }
    } else {
      console.log('getAllCompanies DID NOT return an array:', companies);
    }

    console.log('Testing generateSitemap...');
    const xml = await sitemapService.generateSitemap();
    console.log('Sitemap generated. Length:', xml.length);
    if (xml.length < 500) {
      console.log('Sitemap content:', xml);
    }
  } catch (err) {
    console.error('Error during test:', err);
    if (err.sql) console.error('SQL:', err.sql);
  }
  process.exit();
}

test();
