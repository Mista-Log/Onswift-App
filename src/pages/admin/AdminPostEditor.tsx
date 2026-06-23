import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { BlogPost, BlogCategory } from '@/types/blog'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Trash2, WifiOff, Check, Loader2, CloudOff, Upload, X } from 'lucide-react'
import { TipTapEditor } from '@/components/admin/TipTapEditor'

const postSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  slug: z.string().min(1, 'Slug is required'),
  excerpt: z.string().optional().nullable(),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  cover_image_url: z.string().optional().nullable(),
  tags: z.string().optional(),
  category_id: z.string().optional().nullable(),
  status: z.enum(['draft', 'published']),
})

type PostFormValues = z.infer<typeof postSchema>
type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function draftKey(id?: string) {
  return `onswift_blog_draft_${id ?? 'new'}`
}

export function AdminPostEditor() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [loading, setLoading] = useState(!!id)
  const [submitting, setSubmitting] = useState(false)
  const [post, setPost] = useState<BlogPost | null>(null)
  const [categories, setCategories] = useState<BlogCategory[]>([])

  // ── Cover image upload ──────────────────────────────────────────────────────
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // ── Online / offline state ──────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const pendingSaveRef = useRef(false)

  // ── Auto-save status ────────────────────────────────────────────────────────
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      slug: '',
      excerpt: null,
      content: '',
      cover_image_url: null,
      tags: '',
      category_id: null,
      status: 'draft',
    },
  })

  // ── Perform the actual auto-save to Supabase ────────────────────────────────
  const doAutoSave = useCallback(async () => {
    if (!id) return
    const values = form.getValues()
    const contentEmpty = !values.content || values.content === '<p></p>'
    if (!values.title?.trim() || contentEmpty) return

    try {
      setAutoSaveStatus('saving')
      const tags = values.tags
        ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
        : []

      const { error } = await supabase
        .from('blog_posts')
        .update({
          title: values.title,
          slug: values.slug,
          excerpt: values.excerpt || null,
          content: values.content,
          cover_image_url: values.cover_image_url || null,
          tags,
          category_id: values.category_id || null,
          status: values.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      pendingSaveRef.current = false
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2500)
    } catch {
      setAutoSaveStatus('error')
    }
  }, [id, form])

  // ── Online / offline event listeners ───────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      // Flush any queued save that was blocked by being offline
      if (pendingSaveRef.current && id) {
        doAutoSave()
      }
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [id, doAutoSave])

  // ── Watch form → localStorage backup + debounced Supabase auto-save ─────────
  useEffect(() => {
    const { unsubscribe } = form.watch((values) => {
      // Always write to localStorage as crash / tab-close backup
      try {
        localStorage.setItem(draftKey(id), JSON.stringify(values))
      } catch {
        // localStorage might be full — ignore
      }

      // Only auto-save to Supabase for existing posts
      if (!id) return

      pendingSaveRef.current = true
      setAutoSaveStatus('pending')

      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        if (isOnline) {
          doAutoSave()
        }
        // If offline, pendingSaveRef stays true — doAutoSave fires on reconnect
      }, 3000)
    })

    return () => {
      unsubscribe()
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [id, isOnline, doAutoSave, form])

  // ── Cover image upload to Supabase Storage ─────────────────────────────────
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      toast({ title: 'Unsupported file', description: 'Use JPEG, PNG, GIF, WebP, or SVG.', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Image must be under 5 MB.', variant: 'destructive' })
      return
    }

    try {
      setCoverUploading(true)
      const ext = file.name.split('.').pop()
      const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(path)

      form.setValue('cover_image_url', publicUrl, { shouldValidate: true })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setCoverUploading(false)
    }
  }

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadCategories()
    if (id) loadPost(id)
  }, [id])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name')
      if (error) throw error
      setCategories(data as BlogCategory[])
    } catch {
      console.error('Failed to load categories')
    }
  }

  const loadPost = async (postId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Post not found')

      const postData = data as BlogPost
      setPost(postData)
      form.reset({
        title: postData.title,
        slug: postData.slug,
        excerpt: postData.excerpt,
        content: postData.content,
        cover_image_url: postData.cover_image_url,
        tags: postData.tags?.join(', ') || '',
        category_id: postData.category_id || null,
        status: postData.status,
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to load post', variant: 'destructive' })
      navigate('/admin/dashboard')
    } finally {
      setLoading(false)
    }
  }

  // ── Manual save / publish ───────────────────────────────────────────────────
  const onSubmit = async (values: PostFormValues) => {
    setSubmitting(true)
    try {
      const tags = values.tags
        ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
        : []

      const payload = {
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt || null,
        content: values.content,
        cover_image_url: values.cover_image_url || null,
        tags,
        category_id: values.category_id || null,
        status: values.status,
        updated_at: new Date().toISOString(),
        ...(values.status === 'published' && !post?.published_at && {
          published_at: new Date().toISOString(),
        }),
      }

      if (id && post) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', id)
        if (error) throw error
        // Clear draft backup on successful manual save
        try { localStorage.removeItem(draftKey(id)) } catch {}
        toast({ title: 'Success', description: 'Post updated successfully' })
      } else {
        const { error } = await supabase.from('blog_posts').insert([payload])
        if (error) throw error
        try { localStorage.removeItem(draftKey()) } catch {}
        toast({ title: 'Success', description: 'Post created successfully' })
      }

      navigate('/admin/dashboard')
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save post',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const deletePost = async () => {
    if (!id || !confirm('Are you sure? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id)
      if (error) throw error
      try { localStorage.removeItem(draftKey(id)) } catch {}
      toast({ title: 'Success', description: 'Post deleted' })
      navigate('/admin/dashboard')
    } catch {
      toast({ title: 'Error', description: 'Failed to delete post', variant: 'destructive' })
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    form.setValue('title', title)
    if (!post) form.setValue('slug', generateSlug(title))
  }

  // ── Auto-save status label ──────────────────────────────────────────────────
  const AutoSaveIndicator = () => {
    if (!id) return null
    if (!isOnline) return (
      <span className="flex items-center gap-1.5 text-xs text-amber-500">
        <CloudOff className="h-3.5 w-3.5" />
        Offline — saved locally
      </span>
    )
    if (autoSaveStatus === 'saving') return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Auto-saving…
      </span>
    )
    if (autoSaveStatus === 'saved') return (
      <span className="flex items-center gap-1.5 text-xs text-green-600">
        <Check className="h-3.5 w-3.5" />
        Auto-saved
      </span>
    )
    if (autoSaveStatus === 'error') return (
      <span className="text-xs text-red-500">Auto-save failed</span>
    )
    if (autoSaveStatus === 'pending') return (
      <span className="text-xs text-slate-400">Unsaved changes</span>
    )
    return null
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="text-sm text-slate-600">Loading post...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="shrink-0 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
              {id ? form.watch('title') || 'Untitled Post' : 'Create Post'}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:block"><AutoSaveIndicator /></span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                form.setValue('status', 'published')
                form.handleSubmit(onSubmit)()
              }}
              disabled={submitting}
            >
              ✓ Publish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={form.handleSubmit(onSubmit)}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        {/* Auto-save on mobile — below the button row */}
        <div className="mt-1 sm:hidden"><AutoSaveIndicator /></div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-col lg:flex-row">
        {/* Left panel */}
        <div className="flex-1 overflow-auto p-4 sm:p-8">
          <Form {...form}>
            <form className="space-y-6 sm:space-y-8" onSubmit={e => e.preventDefault()}>
              {/* Title & Excerpt */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Post title"
                          {...field}
                          onChange={handleTitleChange}
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief summary"
                          rows={3}
                          {...field}
                          value={field.value || ''}
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Content editor */}
              <FormItem>
                <FormLabel>Content *</FormLabel>
                <FormControl>
                  <TipTapEditor
                    content={form.watch('content')}
                    onChange={html => form.setValue('content', html, { shouldValidate: true })}
                    disabled={submitting}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.content?.message}</FormMessage>
              </FormItem>

              {/* Slug & Cover Image */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (for Blog Links) *</FormLabel>
                      <FormControl>
                        <Input placeholder="post-slug" {...field} disabled={submitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cover_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog Cover Image</FormLabel>
                      {/* Hidden file input */}
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleCoverUpload}
                      />
                      {/* URL input + Upload button */}
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="https://example.com/image.jpg"
                            {...field}
                            value={field.value || ''}
                            disabled={submitting || coverUploading}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={submitting || coverUploading}
                          onClick={() => coverInputRef.current?.click()}
                          className="shrink-0 gap-1.5"
                        >
                          {coverUploading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Upload className="h-4 w-4" />}
                          Upload
                        </Button>
                      </div>
                      {/* Live preview */}
                      {field.value && (
                        <div className="relative mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img
                            src={field.value}
                            alt="Cover preview"
                            className="h-44 w-full object-cover"
                            onError={e => {
                              const img = e.currentTarget
                              img.style.display = 'none'
                              img.nextElementSibling?.removeAttribute('hidden')
                            }}
                          />
                          <p hidden className="px-4 py-3 text-sm text-slate-400">
                            Could not load preview — check the URL
                          </p>
                          <button
                            type="button"
                            title="Remove Blog Cover Image"
                            onClick={() => form.setValue('cover_image_url', null)}
                            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tags */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel> SEO Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="tag1, tag2, tag3" {...field} disabled={submitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Right panel — metadata */}
        <aside className="w-full shrink-0 overflow-auto border-t border-slate-200 bg-white p-4 sm:p-6 lg:w-80 lg:border-l lg:border-t-0">
          {/* Status dot */}
          <div className="mb-8 flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: form.watch('status') === 'draft' ? '#eab308' : '#22c55e' }}
            />
            <span className="text-sm font-medium text-slate-900">
              {form.watch('status') === 'draft' ? 'Editing draft' : 'Published'}
            </span>
          </div>

          {/* Info */}
          <div className="mb-8 border-b border-slate-200 pb-8">
            <h3 className="mb-4 text-xs font-semibold uppercase text-slate-500">Information</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="mb-1 block text-xs text-slate-500">Created</span>
                <p className="font-medium text-slate-900">
                  {post
                    ? new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '—'}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-xs text-slate-500">Updated</span>
                <p className="font-medium text-slate-900">
                  {post
                    ? new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="mb-8 border-b border-slate-200 pb-8">
            <h3 className="mb-4 text-xs font-semibold uppercase text-slate-500">Relations</h3>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Category</label>
              <Select
                value={form.watch('category_id') || ''}
                onValueChange={value => form.setValue('category_id', value || null)}
              >
                <SelectTrigger disabled={submitting} className="text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status selector */}
          <div className="mb-8 border-b border-slate-200 pb-8">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Status</label>
              <Select
                value={form.watch('status')}
                onValueChange={value => form.setValue('status', value as 'draft' | 'published')}
              >
                <SelectTrigger disabled={submitting} className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Delete */}
          {id && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deletePost}
              className="w-full justify-center gap-2 text-black-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete this entry
            </Button>
          )}
        </aside>
      </div>

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-2xl">
          <WifiOff className="h-4 w-4 shrink-0 text-yellow-400" />
          <div>
            <p className="text-sm font-semibold leading-tight">You're offline</p>
            <p className="text-xs leading-tight opacity-60">Changes saved locally — will sync when you reconnect</p>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
