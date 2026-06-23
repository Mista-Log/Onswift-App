import { sanitize } from 'isomorphic-dompurify'

interface HtmlRendererProps {
  content: string
}

export function HtmlRenderer({ content }: HtmlRendererProps) {
  const sanitizedHtml = sanitize(content)

  return (
    <div
      className="blog-content"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
