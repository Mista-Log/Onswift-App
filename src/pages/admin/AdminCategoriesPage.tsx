import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { BlogCategory } from '@/types/blog'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function AdminCategoriesPage() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [postCounts, setPostCounts] = useState<Record<string, number>>({})

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
  })

  useEffect(() => {
    loadCategoriesAndCounts()
  }, [])

  const loadCategoriesAndCounts = async () => {
    try {
      setLoading(true)
      const { data: catsData, error: catsError } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name')

      if (catsError) throw catsError

      const cats = (catsData as BlogCategory[]) || []
      setCategories(cats)

      const { data: postsData } = await supabase
        .from('blog_posts')
        .select('category_id', { count: 'exact' })

      const counts: Record<string, number> = {}
      cats.forEach(cat => {
        counts[cat.id] = postsData?.filter(p => p.category_id === cat.id).length || 0
      })
      setPostCounts(counts)
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load categories',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      const slug = values.slug || generateSlug(values.name)

      const { error } = await supabase.from('blog_categories').insert([
        {
          name: values.name,
          slug,
          description: values.description || null,
        },
      ])

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Category created',
      })

      form.reset()
      loadCategoriesAndCounts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create category'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return

    try {
      const { error } = await supabase.from('blog_categories').delete().eq('id', id)

      if (error) throw error

      setCategories(categories.filter(c => c.id !== id))
      toast({
        title: 'Success',
        description: 'Category deleted',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      })
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    form.setValue('name', name)
    form.setValue('slug', generateSlug(name))
  }

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
          <p className="mt-2 text-sm text-slate-600">Organize your blog posts by category</p>
        </div>

        {/* Create Form */}
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 max-w-2xl">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Create Category</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Category name"
                        {...field}
                        onChange={handleNameChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="category-slug" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description"
                        rows={3}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Create Category
              </Button>
            </form>
          </Form>
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="text-sm text-slate-600">Loading categories...</p>
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">No categories yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Posts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{cat.slug}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {postCounts[cat.id] || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCategory(cat.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
