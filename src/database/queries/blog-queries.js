const { pool } = require('../database');

/**
 * Get all published blogs (for sitemap)
 * @returns {Promise<Array>} List of published blogs
 */
async function getAllPublishedBlogs() {
  const [rows] = await pool.execute(
    'SELECT slug, updated_at FROM blogs WHERE is_published = 1 ORDER BY published_at DESC'
  );
  return rows;
}

module.exports = {
  getAllPublishedBlogs
};
