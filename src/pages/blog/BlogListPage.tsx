import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { BlogPost, BlogCategory } from '@/types/blog'
import { useToast } from '@/hooks/use-toast'
import { ArrowRight } from 'lucide-react'

const POSTS_PER_PAGE = 9

function estimateReadTime(content: string): number {
  const text = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const wordCount = text.split(' ').filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function BlogListPage() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [page, selectedCategory])

  const fetchCategories = async () => {
    const { data } = await supabase.from('blog_categories').select('*').order('name')
    setCategories((data || []) as BlogCategory[])
  }

  const fetchPosts = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('blog_posts')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE - 1)

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory)
      }

      const { data, error, count } = await query
      if (error) throw error
      setPosts((data || []) as BlogPost[])
      setTotalPosts(count || 0)
    } catch {
      toast({ title: 'Error', description: 'Failed to load blog posts', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (catId: string | null) => {
    setSelectedCategory(catId)
    setPage(1)
  }

  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE)
  const featuredPost = page === 1 ? posts[0] : null
  const remainingPosts = page === 1 ? posts.slice(1) : posts

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header */}
      <div className="border-b border-[#d6dadc] bg-white px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.84px] text-[#115fd6]">
            The OnSwift Blog
          </p>
          <h1 className="mb-4 text-[42px] font-bold leading-tight text-[#172b4d] sm:text-[52px]">
            Insights, stories &amp; updates
          </h1>
          <p className="max-w-xl text-[18px] leading-relaxed text-[#42526e]">
            From team workflows to creative tooling, we share what we know.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-12">
        {/* Category filter */}
        {categories.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryChange(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-[#172b4d] text-white'
                  : 'border border-[#d6dadc] text-[#42526e] hover:border-[#172b4d] hover:text-[#172b4d]'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#172b4d] text-white'
                    : 'border border-[#d6dadc] text-[#42526e] hover:border-[#172b4d] hover:text-[#172b4d]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#172b4d] border-r-transparent" />
              <p className="text-sm text-[#42526e]">Loading posts…</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-[#d6dadc] py-20 text-center">
            <p className="text-[#42526e]">No posts published yet.</p>
          </div>
        ) : (
          <>
            {/* Featured post — large card on page 1 */}
            {featuredPost && (
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group mb-12 flex flex-col overflow-hidden rounded-xl border border-[#d6dadc] transition-shadow hover:shadow-lg sm:flex-row"
              >
                {featuredPost.cover_image_url ? (
                  <div className="h-60 w-full shrink-0 overflow-hidden sm:h-auto sm:w-[420px]">
                    <img
                      src={featuredPost.cover_image_url}
                      alt={featuredPost.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="h-60 w-full shrink-0 bg-slate-100 sm:h-auto sm:w-[420px]" />
                )}
                <div className="flex flex-col justify-center p-8">
                  {featuredPost.tags?.[0] && (
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.72px] text-[#115fd6]">
                      {featuredPost.tags[0]}
                    </p>
                  )}
                  <h2 className="mb-4 text-[28px] font-bold leading-snug text-[#172b4d] transition-colors group-hover:text-[#115fd6] sm:text-[32px]">
                    {featuredPost.title}
                  </h2>
                  {featuredPost.excerpt && (
                    <p className="mb-6 text-[16px] leading-relaxed text-[#42526e] line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[#42526e]">
                    <span>{formatDate(featuredPost.published_at || featuredPost.created_at)}</span>
                    <span>·</span>
                    <span>{estimateReadTime(featuredPost.content)} min read</span>
                    <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[#115fd6]">
                      Read article <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Post grid */}
            {remainingPosts.length > 0 && (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {remainingPosts.map(post => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-[#d6dadc] transition-shadow hover:shadow-lg"
                  >
                    {post.cover_image_url ? (
                      <div className="h-52 overflow-hidden">
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    ) : (
                      <div className="h-52 bg-slate-100" />
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      {post.tags?.[0] && (
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.72px] text-[#115fd6]">
                          {post.tags[0]}
                        </p>
                      )}
                      <h3 className="mb-3 text-[18px] font-semibold leading-snug text-[#172b4d] line-clamp-2 transition-colors group-hover:text-[#115fd6]">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mb-4 flex-1 text-[14px] leading-relaxed text-[#42526e] line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-2 text-[12px] text-[#42526e]">
                        <span>{formatDate(post.published_at || post.created_at)}</span>
                        <span>·</span>
                        <span>{estimateReadTime(post.content)} min read</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-14 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded border border-[#d6dadc] px-4 py-2 text-sm font-medium text-[#42526e] transition-colors hover:border-[#172b4d] hover:text-[#172b4d] disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-[#172b4d] text-white'
                        : 'border border-[#d6dadc] text-[#42526e] hover:border-[#172b4d] hover:text-[#172b4d]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded border border-[#d6dadc] px-4 py-2 text-sm font-medium text-[#42526e] transition-colors hover:border-[#172b4d] hover:text-[#172b4d] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
