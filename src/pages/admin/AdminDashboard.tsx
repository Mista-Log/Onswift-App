import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Edit2, Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BlogPost, BlogCategory } from '@/types/blog'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

export function AdminDashboard() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [
        { data: catsData },
        { data: postsData, error: postsError },
        { data: viewsData },
      ] = await Promise.all([
        supabase.from('blog_categories').select('*').order('name'),
        supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('blog_post_views').select('post_id'),
      ])

      if (postsError) throw postsError

      setCategories((catsData as BlogCategory[]) || [])
      setPosts((postsData as BlogPost[]) || [])

      // Count unique readers per post
      const counts: Record<string, number> = {}
      viewsData?.forEach(v => { counts[v.post_id] = (counts[v.post_id] || 0) + 1 })
      setViewCounts(counts)
    } catch {
      toast({ title: 'Error', description: 'Failed to load posts', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const getCategoryName = (id: string | null) =>
    id ? categories.find(c => c.id === id)?.name ?? '—' : '—'

  const deletePost = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id)
      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== id))
      toast({ title: 'Success', description: 'Post deleted successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete post', variant: 'destructive' })
    }
  }

  const toggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'draft' ? 'published' : 'draft'
    const publishedAt = newStatus === 'published' ? new Date().toISOString() : null
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ status: newStatus, published_at: publishedAt })
        .eq('id', post.id)
      if (error) throw error
      setPosts(prev =>
        prev.map(p =>
          p.id === post.id
            ? { ...p, status: newStatus as 'draft' | 'published', published_at: publishedAt }
            : p
        )
      )
      toast({ title: 'Success', description: `Post ${newStatus === 'published' ? 'published' : 'unpublished'}` })
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const filteredPosts = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AdminLayout>
      <div className="p-4 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Posts</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your blog posts</p>
          </div>
          <Link to="/admin/posts/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Post
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="text-sm text-slate-600">Loading posts...</p>
            </div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p className="mb-4 text-slate-600">No posts found</p>
            <Link to="/admin/posts/new"><Button>Create your first post</Button></Link>
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Readers
                        </span>
                      </TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Edit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.map(post => (
                      <TableRow key={post.id}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {post.title}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {getCategoryName(post.category_id)}
                        </TableCell>
                        <TableCell>
                          <Badge className={post.status === 'published' ? 'bg-green-600' : 'bg-yellow-600'}>
                            {post.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-700">
                          {viewCounts[post.id] ?? 0}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(post.created_at).toLocaleDateString()}
                        </TableCell>
                        {/* Edit — own column */}
                        <TableCell>
                          <Link to={`/admin/posts/${post.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                        {/* Actions — publish toggle + delete */}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => toggleStatus(post)}>
                              {post.status === 'draft' ? 'Publish' : 'Unpublish'}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deletePost(post.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* ── Mobile cards ── */}
            <div className="space-y-3 md:hidden">
              {filteredPosts.map(post => (
                <div key={post.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold text-slate-900">{post.title}</p>
                    <Badge className={`shrink-0 ${post.status === 'published' ? 'bg-green-600' : 'bg-yellow-600'}`}>
                      {post.status}
                    </Badge>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>{getCategoryName(post.category_id)}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {viewCounts[post.id] ?? 0} readers
                    </span>
                    <span>Created {new Date(post.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toggleStatus(post)}>
                      {post.status === 'draft' ? 'Publish' : 'Unpublish'}
                    </Button>
                    <Link to={`/admin/posts/${post.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => deletePost(post.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
