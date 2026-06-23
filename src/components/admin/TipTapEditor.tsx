import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import CharacterCount from '@tiptap/extension-character-count'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { useEffect, useRef, useState } from 'react'
import {
  RotateCcw, RotateCw,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon,
  Eye, EyeOff,
  Quote, Minus,
  ChevronDown, Eraser, Printer, Check, X, Loader2,
} from 'lucide-react'
import { sanitize } from 'isomorphic-dompurify'
import { supabase } from '@/lib/supabase'

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  disabled?: boolean
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-[#e1e1e2]" />
}

function ToolBtn({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-[#f4f4f5] text-[#1a1a1a]'
          : 'text-[rgba(26,26,26,0.6)] hover:bg-[#f4f4f5] hover:text-[#1a1a1a]'
      }`}
    >
      {children}
    </button>
  )
}

const BLOCK_OPTIONS = [
  { key: 'paragraph', label: 'Paragraph' },
  { key: 'h1', label: 'Heading 1' },
  { key: 'h2', label: 'Heading 2' },
  { key: 'h3', label: 'Heading 3' },
  { key: 'blockquote', label: 'Quote' },
]

export function TipTapEditor({ content, onChange, disabled }: TipTapEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [blockDropdownOpen, setBlockDropdownOpen] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg my-4' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing your post…',
        emptyEditorClass: 'is-editor-empty',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CharacterCount,
      TextStyle,
      Color,
    ],
    content,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        // blog-content is the shared CSS class (index.css) used by both the
        // editor and HtmlRenderer — this is what makes the editor WYSIWYG.
        class: 'outline-none min-h-[480px] blog-content',
      },
    },
    immediatelyRender: false,
  })

  const initialContentSet = useRef(false)

  useEffect(() => {
    if (editor && content && !initialContentSet.current) {
      editor.commands.setContent(content)
      initialContentSet.current = true
    }
  }, [editor, content])

  useEffect(() => {
    if (editor) editor.setEditable(!disabled)
  }, [editor, disabled])

  // Focus link input when it opens
  useEffect(() => {
    if (showLinkInput) {
      setTimeout(() => linkInputRef.current?.focus(), 10)
      // Pre-fill if cursor is already on a link
      if (editor?.isActive('link')) {
        const attrs = editor.getAttributes('link')
        setLinkUrl(attrs.href ?? '')
      }
    }
  }, [showLinkInput])

  const applyLink = () => {
    if (!editor) return
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const cancelLink = () => {
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return

    // Reset input so the same file can be re-selected if needed
    e.target.value = ''

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      alert('Unsupported file type. Please upload a JPEG, PNG, GIF, WebP, or SVG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB.')
      return
    }

    try {
      setImageUploading(true)
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(path)

      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run()
    } catch (err) {
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setImageUploading(false)
    }
  }

  const currentBlock = !editor
    ? 'Paragraph'
    : editor.isActive('heading', { level: 1 })
    ? 'Heading 1'
    : editor.isActive('heading', { level: 2 })
    ? 'Heading 2'
    : editor.isActive('heading', { level: 3 })
    ? 'Heading 3'
    : editor.isActive('blockquote')
    ? 'Quote'
    : 'Paragraph'

  const wordCount =
    (editor?.storage?.characterCount?.words?.() as number | undefined) ?? 0

  if (!editor) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#e1e1e2] bg-white shadow-sm">
        <div className="h-[52px] animate-pulse border-b border-[#e1e1e2] bg-[#fcfcfc]" />
        <div className="h-[76px] animate-pulse border-b border-[#e1e1e2] bg-white" />
        <div className="h-[480px] animate-pulse bg-white" />
        <div className="h-10 animate-pulse border-t border-[#e1e1e2] bg-[#fcfcfc]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col [overflow:clip] rounded-xl border border-[#e1e1e2] bg-white shadow-[0px_1px_0px_0px_rgba(26,26,26,0.08),_0px_2px_4px_-1px_rgba(26,26,26,0.08)]">

      {/* ── Menu bar + Toolbar — sticky wrapper ── */}
      <div className="sticky top-0 z-20 [overflow:clip] rounded-t-xl border-b border-[#e1e1e2]">

      {/* ── Menu bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e1e1e2] bg-[#fcfcfc] px-6 py-2">
        <div className="flex items-center">
          {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Help'].map(label => (
            <button
              key={label}
              type="button"
              className="h-9 rounded-xl px-3 text-sm font-semibold text-[rgba(26,26,26,0.65)] transition-colors hover:bg-[#f4f4f5] hover:text-[#1a1a1a]"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          Preview
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 bg-white px-8 py-5">

        {/* Undo / Redo */}
        <div className="flex items-center gap-3">
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()} title="Undo">
            <RotateCcw className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()} title="Redo">
            <RotateCw className="h-[17px] w-[17px]" />
          </ToolBtn>
        </div>

        <Divider />

        {/* Print + Block-type dropdown */}
        <div className="flex items-center gap-3">
          <ToolBtn onClick={() => window.print()} disabled={disabled} title="Print">
            <Printer className="h-[17px] w-[17px]" />
          </ToolBtn>

          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setBlockDropdownOpen(v => !v)}
              onBlur={() => setTimeout(() => setBlockDropdownOpen(false), 150)}
              className="flex h-7 items-center gap-1 rounded-md bg-[#f4f4f5] px-2.5 text-sm font-medium text-[#52525b] transition-colors hover:bg-[#e4e4e7] disabled:opacity-40"
            >
              <span className="min-w-[90px] text-left">{currentBlock}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
            {blockDropdownOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-[#e1e1e2] bg-white py-1 shadow-md">
                {BLOCK_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm text-[#1a1a1a] hover:bg-[#f4f4f5]"
                    onClick={() => {
                      if (key === 'paragraph') {
                        editor.chain().focus().setNode('paragraph').run()
                      } else if (key === 'h1') {
                        editor.chain().focus().setNode('heading', { level: 1 }).run()
                      } else if (key === 'h2') {
                        editor.chain().focus().setNode('heading', { level: 2 }).run()
                      } else if (key === 'h3') {
                        editor.chain().focus().setNode('heading', { level: 3 }).run()
                      } else if (key === 'blockquote') {
                        editor.chain().focus().toggleBlockquote().run()
                      }
                      setBlockDropdownOpen(false)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Divider />

        {/* Text formatting */}
        <div className="flex items-center gap-3">
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={disabled} title="Bold">
            <Bold className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={disabled} title="Italic">
            <Italic className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} disabled={disabled} title="Underline">
            <UnderlineIcon className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} disabled={disabled} title="Strikethrough">
            <Strikethrough className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} disabled={disabled} title="Blockquote">
            <Quote className="h-[17px] w-[17px]" />
          </ToolBtn>
        </div>

        <Divider />

        {/* Link (inline popover) & Image */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <ToolBtn
              onClick={() => setShowLinkInput(v => !v)}
              active={editor.isActive('link') || showLinkInput}
              disabled={disabled}
              title="Insert link"
            >
              <LinkIcon className="h-[17px] w-[17px]" />
            </ToolBtn>

            {showLinkInput && (
              <div className="absolute left-0 top-full z-30 mt-2 flex items-center gap-2 rounded-lg border border-[#e1e1e2] bg-white p-2 shadow-lg">
                <input
                  ref={linkInputRef}
                  type="url"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                    if (e.key === 'Escape') cancelLink()
                  }}
                  className="h-7 w-52 rounded-md border border-[#e1e1e2] bg-white px-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={applyLink}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white hover:opacity-90"
                  title="Apply link"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelLink}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[rgba(26,26,26,0.5)] hover:bg-[#f4f4f5]"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Hidden file input — triggered by the button below */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleImageUpload}
          />
          <ToolBtn
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || imageUploading}
            title="Upload image"
          >
            {imageUploading
              ? <Loader2 className="h-[17px] w-[17px] animate-spin" />
              : <ImageIcon className="h-[17px] w-[17px]" />
            }
          </ToolBtn>
        </div>

        <Divider />

        {/* Lists */}
        <div className="flex items-center gap-3">
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={disabled} title="Bullet list">
            <List className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={disabled} title="Numbered list">
            <ListOrdered className="h-[17px] w-[17px]" />
          </ToolBtn>
        </div>

        <Divider />

        {/* Alignment */}
        <div className="flex items-center gap-3">
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} disabled={disabled} title="Align left">
            <AlignLeft className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} disabled={disabled} title="Align center">
            <AlignCenter className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} disabled={disabled} title="Align right">
            <AlignRight className="h-[17px] w-[17px]" />
          </ToolBtn>
        </div>

        <Divider />

        {/* Horizontal rule & Clear formatting */}
        <div className="flex items-center gap-3">
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={disabled} title="Horizontal rule">
            <Minus className="h-[17px] w-[17px]" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            disabled={disabled}
            title="Clear formatting"
          >
            <Eraser className="h-[17px] w-[17px]" />
          </ToolBtn>
        </div>
      </div>
      {/* ── end sticky wrapper ── */}
      </div>

      {/* ── Editor / Preview ── */}
      {showPreview ? (
        <div className="flex-1 overflow-auto px-16 py-10">
          <div
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: sanitize(editor.getHTML()) }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-16 py-10">
          <EditorContent editor={editor} />
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-[#e1e1e2] bg-[#fcfcfc] px-4">
        <span className="text-sm font-medium text-[rgba(26,26,26,0.6)]">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <svg className="h-4 w-4 text-[rgba(26,26,26,0.3)]" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="13" cy="13" r="1.2" />
          <circle cx="9"  cy="13" r="1.2" />
          <circle cx="13" cy="9"  r="1.2" />
          <circle cx="5"  cy="13" r="1.2" />
          <circle cx="9"  cy="9"  r="1.2" />
          <circle cx="13" cy="5"  r="1.2" />
        </svg>
      </div>
    </div>
  )
}
