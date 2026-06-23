import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { BlogPost } from '@/types/blog'
import { HtmlRenderer } from '@/components/blog/HtmlRenderer'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft } from 'lucide-react'

function estimateReadTime(content: string): number {
  const text = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const wordCount = text.split(' ').filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [popularPosts, setPopularPosts] = useState<BlogPost[]>([])
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) { navigate('/blog'); return }
    fetchAll(slug)
  }, [slug])

  // Record a unique view once per visitor per post
  useEffect(() => {
    if (!post) return
    try {
      let visitorId = localStorage.getItem('onswift_visitor_id')
      if (!visitorId) {
        visitorId = crypto.randomUUID()
        localStorage.setItem('onswift_visitor_id', visitorId)
      }
      supabase
        .from('blog_post_views')
        .upsert(
          { post_id: post.id, visitor_id: visitorId },
          { onConflict: 'post_id,visitor_id', ignoreDuplicates: true }
        )
        .then(() => {})
    } catch {}
  }, [post?.id])

  const fetchAll = async (postSlug: string) => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', postSlug)
        .eq('status', 'published')
        .single()

      if (error) throw error
      const postData = data as BlogPost
      setPost(postData)

      const [popularRes, relatedRes] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('*')
          .eq('status', 'published')
          .neq('slug', postSlug)
          .order('published_at', { ascending: false })
          .limit(4),
        postData.category_id
          ? supabase
              .from('blog_posts')
              .select('*')
              .eq('status', 'published')
              .eq('category_id', postData.category_id)
              .neq('slug', postSlug)
              .order('published_at', { ascending: false })
              .limit(4)
          : supabase
              .from('blog_posts')
              .select('*')
              .eq('status', 'published')
              .neq('slug', postSlug)
              .order('published_at', { ascending: false })
              .limit(4),
      ])

      setPopularPosts((popularRes.data || []) as BlogPost[])
      setRelatedPosts((relatedRes.data || []) as BlogPost[])
    } catch {
      toast({ title: 'Error', description: 'Post not found', variant: 'destructive' })
      navigate('/blog')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#172b4d] border-r-transparent" />
          <p className="text-sm text-[#42526e]">Loading post…</p>
        </div>
      </div>
    )
  }

  if (!post) return null

  const readTime = estimateReadTime(post.content)
  const publishDate = formatDate(post.published_at || post.created_at)
  const category = post.tags?.[0]

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <div className="border-b border-[#d6dadc] bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#42526e] transition-colors hover:text-[#172b4d]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12">
        {/* Article header */}
        <div className="mb-8 max-w-[843px]">
          {category && (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.72px] text-[#115fd6]">
              {category}
            </p>
          )}
          <h1 className="mb-6 text-[42px] font-bold leading-[1.15] text-[#172b4d] sm:text-[52px]">
            {post.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#42526e]">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#172b4d] text-sm font-semibold text-white">
                O
              </div>
              <span>
                By <span className="font-semibold text-[#172b4d]">OnSwift Team</span>
              </span>
            </div>
            <span className="text-[#d6dadc]">|</span>
            <span>Published on {publishDate}</span>
            <span className="text-[#d6dadc]">|</span>
            <span>{readTime} min read</span>
          </div>
        </div>

        {/* Feature image */}
        {post.cover_image_url && (
          <div className="mb-10 h-[360px] w-full overflow-hidden rounded-lg sm:h-[500px]">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Body + Sidebar */}
        <div className="flex flex-col gap-12 lg:flex-row">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            <HtmlRenderer content={post.content} />

            {/* Post footer */}
            <div className="mt-12 border-t border-[#d6dadc] pt-8">
              <p className="text-[20px] leading-[33px] text-[#172b4d]">
                Good or bad, we'd love to hear your thoughts.{' '}
                <a
                  href="https://twitter.com/onswift"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#136aff] hover:underline"
                >
                  Find us on Twitter
                </a>
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-[317px]">
            {/* Popular Posts */}
            {popularPosts.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-5 text-[14px] font-semibold uppercase tracking-[0.84px] text-[#42526e]">
                  Popular Posts
                </h3>
                <div>
                  {popularPosts.map((p, i) => (
                    <div key={p.id}>
                      <Link to={`/blog/${p.slug}`} className="group flex gap-3 py-3">
                        {p.cover_image_url ? (
                          <img
                            src={p.cover_image_url}
                            alt={p.title}
                            className="h-20 w-20 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-20 w-20 shrink-0 rounded bg-slate-100" />
                        )}
                        <div className="min-w-0">
                          {p.tags?.[0] && (
                            <p className="mb-1 text-[12px] uppercase tracking-[0.72px] text-[#42526e]">
                              {p.tags[0]}
                            </p>
                          )}
                          <p className="text-[15px] font-medium leading-snug text-[#172b4d] line-clamp-3 transition-colors group-hover:text-[#115fd6]">
                            {p.title}
                          </p>
                        </div>
                      </Link>
                      {i < popularPosts.length - 1 && (
                        <div className="h-px bg-[#172b4d] opacity-10" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA block */}
            <div className="rounded-md bg-primary p-6 text-center text-white">
              <h4 className="mb-3 text-[22px] font-semibold leading-snug">
                Get More Done Together With Us
              </h4>
              <p className="mb-6 text-[16px] leading-relaxed opacity-90">
                Manage your creative projects smarter with OnSwift.
              </p>
              <Link
                to="/login"
                className="inline-block rounded-[3px] bg-white px-6 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
              >
                Get Started
              </Link>
            </div>
          </aside>
        </div>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 border-t border-[#d6dadc] pt-10">
            <p className="mb-8 text-[12px] font-semibold uppercase tracking-[0.72px] text-[#42526e]">
              Here are some related articles you may find interesting:
            </p>
            <div className="space-y-8">
              {relatedPosts.map(p => {
                const rtime = estimateReadTime(p.content)
                const rcat = p.tags?.[0] || 'General'
                return (
                  <Link
                    key={p.id}
                    to={`/blog/${p.slug}`}
                    className="group flex flex-col gap-6 sm:flex-row"
                  >
                    {p.cover_image_url ? (
                      <img
                        src={p.cover_image_url}
                        alt={p.title}
                        className="h-[180px] w-full shrink-0 rounded-lg object-cover sm:h-[203px] sm:w-[270px]"
                      />
                    ) : (
                      <div className="h-[180px] w-full shrink-0 rounded-lg bg-slate-100 sm:h-[203px] sm:w-[270px]" />
                    )}
                    <div className="pt-1">
                      <p className="mb-2 text-[12px] uppercase tracking-[0.72px] text-[#42526e]">
                        {rcat} — {rtime} Minute Read
                      </p>
                      <h4 className="mb-3 text-[22px] font-semibold leading-snug text-[#172b4d] line-clamp-2 transition-colors group-hover:text-[#115fd6]">
                        {p.title}
                      </h4>
                      {p.excerpt && (
                        <p className="text-[15px] leading-[24px] text-[#172b4d] opacity-70 line-clamp-3">
                          {p.excerpt}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
