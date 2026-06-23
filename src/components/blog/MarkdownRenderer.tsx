import { useMemo } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkHtml from 'remark-html'
import { sanitize } from 'isomorphic-dompurify'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = useMemo(() => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkHtml)

    const result = processor.processSync(content)
    const unsafeHtml = String(result)
    return sanitize(unsafeHtml)
  }, [content])

  return (
    <div
      className="prose prose-slate max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
