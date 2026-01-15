import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { BlogCard } from '../../components/BlogCard';

interface Blog {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  featured_image: string;
  published_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BlogList() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  /* const { search } = useSearch(); */ // Unused for now
  const [category, setCategory] = useState('');

  const fetchBlogs = async (page = 1, search = '', cat = '') => {
    setLoading(true);
    try {
      const res = await api.get('/blogs', {
        params: { page, limit: 9, search, category: cat }
      });
      if (res.data.success) {
        setBlogs(res.data.data.blogs);
        setPagination(res.data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch blogs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs(1, searchTerm, category);
  }, [searchTerm, category]);

  const handlePageChange = (newPage: number) => {
    fetchBlogs(newPage, searchTerm, category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Helmet>
        <title>Stock Market Knowledge Base - NEPSE Portfolio</title>
        <meta name="description" content="Learn about investing in Nepal Stock Exchange (NEPSE). Tutorials, market updates, and investment basics." />
        <link rel="canonical" href="https://nepseportfoliotracker.app/blogs" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Investment Insights</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Your guide to understanding the Nepal Stock Exchange. News, tutorials, and expert analysis.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          {['', 'news', 'tutorial', 'blog', 'market_update'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${category === cat
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {cat ? cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="animate-pulse bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 h-96">
              <div className="bg-gray-200 h-48 w-full"></div>
              <div className="p-6 space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : blogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">No articles found matching your criteria.</p>
          <button
            onClick={() => { setSearchTerm(''); setCategory(''); }}
            className="mt-4 text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-12 flex justify-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>

          <div className="flex items-center gap-1 px-2">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${pagination.page === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
