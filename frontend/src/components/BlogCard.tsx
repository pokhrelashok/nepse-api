import { Link } from '@tanstack/react-router';
import { Calendar, Tag, ArrowRight } from 'lucide-react';

interface Blog {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags?: string[];
  featured_image: string;
  published_at: string;
}

interface BlogCardProps {
  blog: Blog;
}

export function BlogCard({ blog }: BlogCardProps) {
  return (
    <Link
      to="/blogs/$slug"
      params={{ slug: blog.slug }}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full"
    >
      <div className="relative overflow-hidden h-48">
        {blog.featured_image ? (
          <img
            src={blog.featured_image}
            alt={blog.title}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <span className="text-4xl text-blue-200">NP</span>
          </div>
        )}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-blue-800 rounded-full shadow-sm">
            {blog.category.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-center text-gray-500 text-xs mb-3 gap-3">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(blog.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
          {blog.tags && blog.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              <span className="truncate max-w-[100px]">
                {Array.isArray(blog.tags) ? blog.tags[0] : JSON.parse(blog.tags as unknown as string)[0]}
              </span>
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {blog.title}
        </h2>

        <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
          {blog.excerpt}
        </p>

        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
          Read Article <ArrowRight className="ml-2 h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
