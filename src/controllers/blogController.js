const { pool } = require('../database/database');
const { formatResponse, formatError } = require('../utils/formatter');
const aiService = require('../services/ai-service');
const logger = require('../utils/logger');

// Get all blogs (Public/Admin)
// Query params: page, limit, search, category, status (admin only)
exports.getBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status;

    // Determine if admin or public request (middleware adds user info)
    const isAdmin = req.user && req.user.role === 'admin'; // Assuming auth middleware adds user

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Public only sees published
    if (!isAdmin || status === 'published') {
      whereClause += ' AND is_published = 1';
    } else if (status) {
      // Admin filtering by specific status
      if (status === 'draft') whereClause += ' AND is_published = 0';
    }

    if (search) {
      whereClause += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    // Count total
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM blogs ${whereClause}`, params);
    const total = countRows[0].total;

    // Get Data
    const [rows] = await pool.execute(
      `SELECT id, title, slug, excerpt, category, tags, featured_image, is_published, published_at, created_at 
       FROM blogs ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json(formatResponse({
      blogs: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }));

  } catch (error) {
    logger.error('Error fetching blogs:', error);
    res.status(500).json(formatError('Failed to fetch blogs'));
  }
};

// Get single blog by slug (Public)
exports.getPublicBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await pool.execute(
      `SELECT * FROM blogs WHERE slug = ? AND is_published = 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    res.json(formatResponse(rows[0]));
  } catch (error) {
    logger.error('Error fetching blog:', error);
    res.status(500).json(formatError('Failed to fetch blog'));
  }
};

// Get single blog by ID (Admin)
exports.getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM blogs WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    res.json(formatResponse(rows[0]));
  } catch (error) {
    logger.error('Error fetching blog:', error);
    res.status(500).json(formatError('Failed to fetch blog'));
  }
};

// Create Blog (Admin)
exports.createBlog = async (req, res) => {
  try {
    const { title, slug, content, excerpt, category, tags, featured_image, meta_title, meta_description, is_published, published_at } = req.body;

    // Validations (Basic)
    if (!title || !slug || !content) {
      return res.status(400).json(formatError('Title, Slug and Content are required', 400));
    }

    const [result] = await pool.execute(
      `INSERT INTO blogs (title, slug, content, excerpt, category, tags, featured_image, meta_title, meta_description, is_published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        slug,
        content,
        excerpt,
        category || 'blog',
        JSON.stringify(tags || []),
        featured_image,
        meta_title,
        meta_description,
        is_published ? 1 : 0,
        published_at || (is_published ? new Date() : null)
      ]
    );

    res.status(201).json(formatResponse({ id: result.insertId, message: 'Blog created successfully' }));

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json(formatError('Slug already exists', 409));
    }
    logger.error('Error creating blog:', error);
    res.status(500).json(formatError('Failed to create blog'));
  }
};

// Update Blog (Admin)
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, excerpt, category, tags, featured_image, meta_title, meta_description, is_published, published_at } = req.body;

    const [result] = await pool.execute(
      `UPDATE blogs SET 
        title = ?, slug = ?, content = ?, excerpt = ?, category = ?, tags = ?, 
        featured_image = ?, meta_title = ?, meta_description = ?, is_published = ?, published_at = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        title,
        slug,
        content,
        excerpt,
        category,
        JSON.stringify(tags || []),
        featured_image,
        meta_title,
        meta_description,
        is_published ? 1 : 0,
        published_at,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    res.json(formatResponse({ message: 'Blog updated successfully' }));

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json(formatError('Slug already exists', 409));
    }
    logger.error('Error updating blog:', error);
    res.status(500).json(formatError('Failed to update blog'));
  }
};

// Delete Blog (Admin)
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM blogs WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json(formatError('Blog not found', 404));
    }

    res.json(formatResponse({ message: 'Blog deleted successfully' }));
  } catch (error) {
    logger.error('Error deleting blog:', error);
    res.status(500).json(formatError('Failed to delete blog'));
  }
};

// Generate Content (Admin)
exports.generateBlogContent = async (req, res) => {
  try {
    const { topic, category } = req.body;
    if (!topic) {
      return res.status(400).json(formatError('Topic is required', 400));
    }

    const generatedContent = await aiService.generateBlogPost(topic, category || 'blog');
    res.json(formatResponse(generatedContent));

  } catch (error) {
    logger.error('Error generating content:', error);
    res.status(500).json(formatError('Failed to generate content'));
  }
};
