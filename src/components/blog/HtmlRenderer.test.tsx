import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { HtmlRenderer } from './HtmlRenderer'

vi.mock('isomorphic-dompurify', () => ({
  sanitize: (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, ''),
}))

describe('HtmlRenderer', () => {
  it('renders plain HTML content', () => {
    const { container } = render(<HtmlRenderer content="<p>Hello world</p>" />)
    expect(container.querySelector('p')?.textContent).toBe('Hello world')
  })

  it('applies the blog-content class for WYSIWYG styling', () => {
    const { container } = render(<HtmlRenderer content="<p>test</p>" />)
    expect(container.firstElementChild?.classList.contains('blog-content')).toBe(true)
  })

  it('strips <script> tags (XSS protection)', () => {
    const { container } = render(
      <HtmlRenderer content='<p>Safe</p><script>alert("xss")</script>' />
    )
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).not.toContain('alert')
  })

  it('strips inline event handlers (XSS protection)', () => {
    const { container } = render(
      <HtmlRenderer content='<img src="x" onerror="alert(1)" />' />
    )
    expect(container.innerHTML).not.toContain('onerror')
  })

  it('renders an empty wrapper for empty content', () => {
    const { container } = render(<HtmlRenderer content="" />)
    expect(container.firstElementChild?.innerHTML).toBe('')
  })

  it('renders h1/h2/h3 at correct tag levels', () => {
    const { container } = render(
      <HtmlRenderer content="<h1>Title</h1><h2>Sub</h2><h3>Minor</h3>" />
    )
    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelector('h2')?.textContent).toBe('Sub')
    expect(container.querySelector('h3')?.textContent).toBe('Minor')
  })

  it('renders bullet lists', () => {
    const { container } = render(
      <HtmlRenderer content="<ul><li>Item A</li><li>Item B</li></ul>" />
    )
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders ordered lists', () => {
    const { container } = render(
      <HtmlRenderer content="<ol><li>First</li><li>Second</li></ol>" />
    )
    expect(container.querySelector('ol')).toBeTruthy()
  })

  it('renders blockquotes', () => {
    const { container } = render(
      <HtmlRenderer content="<blockquote><p>Quote</p></blockquote>" />
    )
    expect(container.querySelector('blockquote')).toBeTruthy()
  })

  it('renders bold and italic marks', () => {
    const { container } = render(
      <HtmlRenderer content="<p><strong>Bold</strong> <em>italic</em></p>" />
    )
    expect(container.querySelector('strong')?.textContent).toBe('Bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
  })

  it('preserves text-align inline styles from TipTap', () => {
    const { container } = render(
      <HtmlRenderer content='<p style="text-align: center">Centered</p>' />
    )
    expect(container.querySelector('p')?.style.textAlign).toBe('center')
  })
})
