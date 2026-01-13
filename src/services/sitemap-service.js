const { getAllCompanies, getAllPublishedBlogs } = require('../database/queries');
const logger = require('../utils/logger');

/**
 * Generate Sitemap XML
 * @returns {Promise<string>} XML string
 */
async function generateSitemap() {
  try {
    const companies = await getAllCompanies();
    const baseUrl = process.env.BASE_URL || 'https://nepseportfoliotracker.app';

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add home page
    sitemap += '  <url>\n';
    sitemap += `    <loc>${baseUrl}/</loc>\n`;
    sitemap += '    <changefreq>daily</changefreq>\n';
    sitemap += '    <priority>1.0</priority>\n';
    sitemap += '  </url>\n';

    // Add stocks list page
    sitemap += '  <url>\n';
    sitemap += `    <loc>${baseUrl}/stocks</loc>\n`;
    sitemap += '    <changefreq>daily</changefreq>\n';
    sitemap += '    <priority>0.9</priority>\n';
    sitemap += '  </url>\n';

    // Add static pages
    ['feedback', 'privacy-policy', 'terms-of-service'].forEach(page => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/${page}</loc>\n`;
      sitemap += '    <changefreq>monthly</changefreq>\n';
      sitemap += '    <priority>0.3</priority>\n';
      sitemap += '  </url>\n';
    });

    // Add each company page
    companies.forEach(company => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/script/${company.symbol}</loc>\n`;
      sitemap += '    <changefreq>daily</changefreq>\n';
      sitemap += '    <priority>0.8</priority>\n';
      sitemap += '  </url>\n';
    });

    // Add blog articles
    const blogs = await getAllPublishedBlogs();
    blogs.forEach(blog => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/blogs/${blog.slug}</loc>\n`;
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += '    <priority>0.7</priority>\n';
      sitemap += '  </url>\n';
    });

    sitemap += '</urlset>';

    return sitemap;
  } catch (error) {
    logger.error('Error generating sitemap:', error);
    throw error;
  }
}

module.exports = {
  generateSitemap
};
