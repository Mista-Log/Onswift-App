export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  cover_image_url: string | null
  status: 'draft' | 'published'
  category_id: string | null
  tags: string[]
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

export interface BlogComment {
  id: string
  post_id: string
  author_email: string
  author_name: string
  content: string
  approved: boolean
  created_at: string
}

export interface CMSConfig {
  id: string
  key: string
  value: Record<string, any> | null
  updated_at: string
}
