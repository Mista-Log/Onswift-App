import { Link } from 'react-router-dom'
import { BlogPost } from '@/types/blog'
import { Badge } from '@/components/ui/badge'

interface BlogCardProps {
  post: BlogPost
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group rounded-lg border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-lg"
    >
      {post.cover_image_url && (
        <div className="mb-4 aspect-video w-full overflow-hidden rounded-md bg-slate-200">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-slate-700 line-clamp-2">
            {post.title}
          </h3>
        </div>

        {post.excerpt && (
          <p className="text-sm text-slate-600 line-clamp-2">{post.excerpt}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {post.tags && post.tags.length > 0 && (
            <>
              {post.tags.slice(0, 2).map(tag => (
                <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-700">
                  {tag}
                </Badge>
              ))}
              {post.tags.length > 2 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  +{post.tags.length - 2}
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <time className="text-xs text-slate-500">
            {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </time>
          <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900">
            Read →
          </span>
        </div>
      </div>
    </Link>
  )
}
