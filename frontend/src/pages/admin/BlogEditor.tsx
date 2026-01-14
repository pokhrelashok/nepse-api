import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { api } from '../../api/client';
import { Wand2, Loader2, ArrowLeft } from 'lucide-react';

interface BlogFormData {
  title: string;
  slug: string;
  category: string;
  content: string;
  excerpt: string;
  featured_image: string;
  tags: string; // Comma separated for input
  meta_title: string;
  meta_description: string;
  is_published: boolean;
}

const initialForm: BlogFormData = {
  title: '',
  slug: '',
  category: 'blog',
  content: '',
  excerpt: '',
  featured_image: '',
  tags: '',
  meta_title: '',
  meta_description: '',
  is_published: false,
};

export default function BlogEditor() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<BlogFormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI State
  const [aiTopic, setAiTopic] = useState('');
  const [aiBlogType, setAiBlogType] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      setLoading(true);
      api.get(`/admin/blogs/${id}`)
        .then(res => {
          if (res.data.success) {
            const data = res.data.data;
            setFormData({
              ...data,
              tags: Array.isArray(data.tags)
                ? data.tags.join(', ')
                : (data.tags ? JSON.parse(data.tags).join(', ') : ''),
              is_published: data.is_published === 1 || data.is_published === true
            });
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [id, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = () => {
    setFormData(prev => ({ ...prev, is_published: !prev.is_published }));
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: !isEditMode ? generateSlug(title) : prev.slug // Only auto-gen slug on create
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      if (isEditMode) {
        await api.put(`/admin/blogs/${id}`, payload);
      } else {
        await api.post('/admin/blogs', payload);
      }
      navigate({ to: '/admin/blogs' });
    } catch (error) {
      console.error('Failed to save blog', error);
      alert('Failed to save blog');
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiTopic) return;
    setAiLoading(true);
    try {
      const res = await api.post('/admin/blogs/generate', {
        topic: aiTopic,
        category: formData.category,
        blogType: aiBlogType || 'informative'
      });

      if (res.data.success) {
        const generated = res.data.data;
        setFormData(prev => ({
          ...prev,
          title: generated.title,
          slug: generateSlug(generated.title),
          content: generated.content,
          excerpt: generated.excerpt,
          tags: generated.tags.join(', '),
          meta_title: generated.meta_title,
          meta_description: generated.meta_description
        }));
        setShowAiModal(false);
      }
    } catch (error) {
      console.error('AI Generation failed', error);
      alert('AI Generation failed. Check console.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading editor...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate({ to: '/admin/blogs' })} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">{isEditMode ? 'Edit Blog' : 'Create New Blog'}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
          >
            <Wand2 className="mr-2 h-4 w-4" /> AI Generate
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-medium disabled:opacity-50"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {formData.is_published ? ' & Publish' : ' Draft'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full p-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none text-lg font-medium"
              placeholder="Enter blog title..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Slug (URL)</label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              className="w-full p-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-mono text-gray-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content (Markdown)</label>
            <div className="relative">
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                rows={20}
                className="w-full p-4 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none font-mono text-sm leading-relaxed"
                placeholder="# Write your content here..."
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                Markdown Supported
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Excerpt</label>
            <textarea
              name="excerpt"
              value={formData.excerpt}
              onChange={handleChange}
              rows={3}
              className="w-full p-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
              placeholder="Short summary for list view..."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Publish Status</label>
              <button
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${formData.is_published ? 'bg-green-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition transition-transform ${formData.is_published ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="text-sm text-gray-500 text-right">
              {formData.is_published ? 'Visible to public' : 'Draft mode'}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Organization</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none bg-white"
              >
                <option value="news">News</option>
                <option value="tutorial">Tutorial</option>
                <option value="blog">Blog</option>
                <option value="market_update">Market Update</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags (comma separated)</label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                placeholder="investing, nepal, basics"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Featured Image URL</label>
              <input
                type="text"
                name="featured_image"
                value={formData.featured_image}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                placeholder="https://..."
              />
              {formData.featured_image && (
                <div className="mt-2 aspect-video rounded-md overflow-hidden bg-gray-100">
                  <img src={formData.featured_image} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">SEO Settings</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Meta Title</label>
              <input
                type="text"
                name="meta_title"
                value={formData.meta_title}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Meta Description</label>
              <textarea
                name="meta_description"
                value={formData.meta_description}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              Generate Content with AI
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Enter a topic and the AI will generate a title, content, SEO tags, and more.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Blog Type</label>
                <select
                  value={aiBlogType}
                  onChange={(e) => setAiBlogType(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-purple-600 focus:outline-none bg-white"
                >
                  <option value="informative">Informative (Educational)</option>
                  <option value="tutorial">Tutorial (Step-by-step Guide)</option>
                  <option value="news">News (Market Update/Analysis)</option>
                  <option value="opinion">Opinion (Editorial/Commentary)</option>
                  <option value="beginner">Beginner-Friendly (Basics)</option>
                  <option value="advanced">Advanced (In-depth Analysis)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Topic</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., How to start investing in secondary market"
                  className="w-full p-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAiGenerate}
                  disabled={!aiTopic || aiLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
                >
                  {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
