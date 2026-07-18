/**
 * WelcomeRichText — inline TipTap editor for the Welcome/Intro form block.
 * Selecting text pops a bubble with bold / italic / underline / link; typing "@"
 * opens a dropdown of the form's field labels and inserts a reference pill that
 * stores the field's stable block id (never the label text), so references
 * survive renames and reordering.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { EditorContent, ReactRenderer, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionItem {
  id: string;
  label: string;
}

interface WelcomeRichTextProps {
  content: string;
  onChange: (html: string) => void;
  mentionItems: MentionItem[];
}

// ── Mention dropdown (rendered at the caret while typing "@") ────────────────

interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const MentionList = forwardRef<MentionListHandle, SuggestionProps<MentionItem>>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.label });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }), [selectedIndex, items]);

    if (items.length === 0) {
      return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          No fields to reference yet
        </div>
      );
    }

    return (
      <div className="min-w-44 max-w-64 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={cn(
              "w-full truncate rounded-sm px-2.5 py-1.5 text-left text-sm",
              index === selectedIndex ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <span className="text-muted-foreground">@</span>{item.label}
          </button>
        ))}
      </div>
    );
  },
);
MentionList.displayName = "MentionList";

/** Suggestion render lifecycle: mounts MentionList in a fixed-position element at the caret. */
function mentionSuggestionRender() {
  let component: ReactRenderer<MentionListHandle, SuggestionProps<MentionItem>> | null = null;
  let popup: HTMLDivElement | null = null;

  const updatePosition = (clientRect?: (() => DOMRect | null) | null) => {
    const rect = clientRect?.();
    if (!rect || !popup) return;
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 6}px`;
  };

  const destroy = () => {
    popup?.remove();
    component?.destroy();
    popup = null;
    component = null;
  };

  return {
    onStart: (props: SuggestionProps<MentionItem>) => {
      component = new ReactRenderer(MentionList, { props, editor: props.editor });
      popup = document.createElement("div");
      popup.style.position = "fixed";
      popup.style.zIndex = "60";
      popup.appendChild(component.element);
      document.body.appendChild(popup);
      updatePosition(props.clientRect);
    },
    onUpdate: (props: SuggestionProps<MentionItem>) => {
      component?.updateProps(props);
      updatePosition(props.clientRect);
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        destroy();
        return true;
      }
      return component?.ref?.onKeyDown(props) ?? false;
    },
    onExit: destroy,
  };
}

// ── Bubble toolbar button ─────────────────────────────────────────────────────

function BubbleBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export function WelcomeRichText({ content, onChange, mentionItems }: WelcomeRichTextProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write a welcome message for your client…" }),
      Mention.configure({
        renderHTML({ node }) {
          return [
            "span",
            {
              "data-type": "mention",
              "data-id": node.attrs.id,
              "data-label": node.attrs.label,
              class: "mention",
            },
            `@${node.attrs.label}`,
          ];
        },
        suggestion: {
          char: "@",
          items: ({ query }: { query: string }) =>
            mentionItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
          render: mentionSuggestionRender,
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "welcome-rich-text prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[1.75rem] text-base leading-relaxed",
      },
    },
    onUpdate: ({ editor }: { editor: Editor }) => onChange(editor.getHTML()),
  });

  // Sync external content changes (e.g. localStorage draft restore) into the editor.
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkUrl("");
    setShowLinkInput(false);
  };

  return (
    <>
      <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md">
        {showLinkInput ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); }
              }}
              placeholder="https://…"
              className="h-7 w-44 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <BubbleBtn onClick={applyLink} title="Apply link">
              <Check className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn onClick={() => { setShowLinkInput(false); setLinkUrl(""); }} title="Cancel">
              <X className="h-3.5 w-3.5" />
            </BubbleBtn>
          </div>
        ) : (
          <>
            <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
              <Bold className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
              <Italic className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
              <UnderlineIcon className="h-3.5 w-3.5" />
            </BubbleBtn>
            <BubbleBtn
              onClick={() => {
                setLinkUrl(editor.getAttributes("link").href ?? "");
                setShowLinkInput(true);
              }}
              active={editor.isActive("link")}
              title="Link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </BubbleBtn>
          </>
        )}
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
