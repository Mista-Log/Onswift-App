import { useEffect, useRef, useState, useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { saveDoc } from "@/hooks/useDocs";
import type { DocDetail } from "@/hooks/useDocs";
import {
  Check,
  Loader2,
  Share2,
  MoreHorizontal,
  FileText,

  PanelLeft,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocShareModal } from "./DocShareModal";

interface DocEditorProps {
  doc: DocDetail;
  onTitleChange?: (title: string) => void;
  onToggleSidebar?: () => void;
}

type SaveState = "idle" | "saving" | "saved";

export function DocEditor({ doc, onTitleChange, onToggleSidebar }: DocEditorProps) {
  const { resolvedTheme } = useTheme();
  const [title, setTitle] = useState(doc.title || "Untitled");
  const [icon, setIcon] = useState(doc.icon || "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const readOnly = doc.user_role === "viewer";

  const editor = useCreateBlockNote({
    initialContent:
      doc.content && doc.content.length > 0
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (doc.content as any)
        : undefined,
  });

  useEffect(() => {
    editor.isEditable = !readOnly;
  }, [editor, readOnly]);

  useEffect(() => {
    setTitle(doc.title || "Untitled");
    setIcon(doc.icon || "");
  }, [doc.id, doc.title, doc.icon]);

  const triggerSave = useCallback(
    (patch: Parameters<typeof saveDoc>[1]) => {
      if (readOnly) return;
      clearTimeout(debounceRef.current);
      setSaveState("saving");
      debounceRef.current = setTimeout(async () => {
        const result = await saveDoc(doc.id, patch);
        if (result) {
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        } else {
          setSaveState("idle");
        }
      }, 1500);
    },
    [doc.id, readOnly],
  );

  const handleEditorChange = useCallback(() => {
    if (readOnly) return;
    triggerSave({ content: editor.document as object[] });
  }, [editor, triggerSave, readOnly]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      const val = e.target.value;
      setTitle(val);
      onTitleChange?.(val);
      clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = setTimeout(() => {
        triggerSave({ title: val });
      }, 800);
    },
    [onTitleChange, triggerSave, readOnly],
  );

  const handleIconChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      const val = e.target.value.slice(-2);
      setIcon(val);
      triggerSave({ icon: val });
    },
    [triggerSave, readOnly],
  );

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = useCallback(() => {
    const md = editor.blocksToMarkdownLossy(editor.document);
    downloadBlob(md, `${title || "untitled"}.md`, "text/markdown");
  }, [editor, title]);


  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 md:px-8 py-2.5 border-b border-border/50 gap-2">

        {/* Left — mobile sidebar toggle + icon picker */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Sidebar toggle — mobile only */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Toggle pages"
          >
            <PanelLeft size={16} />
          </button>

          {/* Icon picker */}
          <input
            className={cn(
              "w-7 h-7 text-center text-lg bg-transparent border-none outline-none rounded transition-colors",
              readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted",
            )}
            value={icon}
            onChange={handleIconChange}
            readOnly={readOnly}
            placeholder="📄"
            maxLength={2}
            title={readOnly ? "Page icon" : "Click to set page icon"}
          />
        </div>

        {/* Right — save state + share + more */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* View-only badge for viewers */}
          {readOnly && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-md px-2 h-7">
              <Eye size={11} className="flex-shrink-0" />
              <span className="hidden sm:inline">View only</span>
            </div>
          )}

          {/* Save indicator — only for editors/owners */}
          {!readOnly && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[44px] justify-end">
              {saveState === "saving" && (
                <>
                  <Loader2 size={11} className="animate-spin flex-shrink-0" />
                  <span className="hidden sm:inline">Saving…</span>
                </>
              )}
              {saveState === "saved" && (
                <>
                  <Check size={11} className="text-green-500 flex-shrink-0" />
                  <span className="hidden sm:inline">Saved</span>
                </>
              )}
            </div>
          )}

          {/* Share button — only for owners */}
          {doc.user_role === "owner" && (
            <button
              onClick={() => setShareOpen(true)}
              className={cn(
                "flex items-center gap-1.5 h-7 px-2 sm:px-3 rounded-md text-xs font-medium",
                "border border-border hover:bg-muted transition-colors",
              )}
            >
              <Share2 size={12} className="flex-shrink-0" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-md",
                  "hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
                )}
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExportMarkdown} className="gap-2">
                <FileText size={14} />
                Export as Markdown
              </DropdownMenuItem>

              {doc.user_role === "owner" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShareOpen(true)} className="gap-2">
                    <Share2 size={14} />
                    Manage access
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Page title */}
      <div className="px-4 sm:px-10 md:px-[54px] pt-6 sm:pt-8 md:pt-10 pb-2">
        <input
          className={cn(
            "w-full font-bold bg-transparent border-none outline-none",
            "text-2xl sm:text-3xl md:text-4xl",
            "placeholder:text-muted-foreground/40 text-foreground",
            readOnly && "cursor-default select-text",
          )}
          value={title}
          onChange={handleTitleChange}
          readOnly={readOnly}
          placeholder="Untitled"
        />
      </div>

      {/* BlockNote editor */}
      <div className="flex-1 overflow-auto">
        <BlockNoteView
          editor={editor}
          onChange={handleEditorChange}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          className="min-h-full"
        />
      </div>

      {/* Share modal */}
      <DocShareModal
        doc={doc}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
