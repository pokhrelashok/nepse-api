import { useState, useEffect } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { api } from '../../api/client';
import { ArrowLeft, Calendar, Share2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Blog {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string; // JSON string from DB
  featured_image: string;
  published_at: string;
  meta_title: string;
  meta_description: string;
}

export default function BlogDetail() {
  const { slug } = useParams({ from: '/public-layout/blogs/$slug' });
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBlog = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/blogs/${slug}`);
        if (res.data.success) {
          setBlog(res.data.data);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchBlog();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-2/3"></div>
          <div className="h-96 bg-gray-200 rounded w-full"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Article Not Found</h2>
        <p className="text-gray-600 mb-8">{error || "The article you're looking for doesn't exist or has been removed."}</p>
        <Link to="/blogs" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Back to Articles
        </Link>
      </div>
    );
  }

  /* 
    Depending on the DB driver version, tags might be returned as a JSON string OR an automatically parsed array.
    We handle both cases here to prevent JSON.parse crashes.
  */
  const tags = Array.isArray(blog.tags) ? blog.tags : (blog.tags ? JSON.parse(blog.tags) : []);

  return (
    <article className="min-h-screen bg-gray-50 pb-20">
      <Helmet>
        <title>{blog.meta_title || blog.title} - NEPSE Portfolio</title>
        <meta name="description" content={blog.meta_description || blog.excerpt} />
        {/* Open Graph / Social Media */}
        <meta property="og:title" content={blog.title} />
        <meta property="og:description" content={blog.excerpt} />
        <meta property="og:image" content={blog.featured_image} />
        <meta property="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Link to="/blogs" className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Articles
          </Link>

          <div className="flex flex-wrap gap-3 mb-6">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wide">
              {blog.category.replace('_', ' ')}
            </span>
            <span className="flex items-center text-gray-500 text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              {new Date(blog.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-8">
            {blog.title}
          </h1>

          {blog.featured_image && (
            <div className="rounded-2xl overflow-hidden shadow-lg mb-10 aspect-video relative">
              <img
                src={blog.featured_image}
                alt={blog.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 mb-8">
          {/* 
            Note: In a real app, use a markdown renderer like 'react-markdown'.
            For now, assuming safe HTML is returned or just rendering text.
            If using raw HTML from backend, use dangerouslySetInnerHTML carefully.
          */}
          <div className="prose prose-lg prose-blue max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-img:rounded-xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {blog.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Tags & Share */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-t border-gray-200 pt-8">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag: string) => (
              <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-default">
                #{tag}
              </span>
            ))}
          </div>

          <button
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: blog.title,
                    text: blog.excerpt,
                    url: window.location.href,
                  });
                } else {
                  await navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }
              } catch (err) {
                console.error('Share failed:', err);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-100 text-blue-700 font-bold transition-all"
          >
            <Share2 className="h-4 w-4" /> Share Article
          </button>
        </div>
      </div>
    </article>
  );
}
