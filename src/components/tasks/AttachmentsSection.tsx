import { useRef, useState } from "react";
import { ExternalLink, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AttachmentItem {
  id: string;
  name: string;
  file_url?: string | null;
  url?: string | null;
}

interface AttachmentsSectionProps {
  attachments: AttachmentItem[];
  /** Each callback rejects with an Error whose message is shown to the user. */
  onAddLink: (url: string) => Promise<void>;
  onAddFile: (file: File) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  /** Defaults to allowed for every item. */
  canRemove?: (attachment: AttachmentItem) => boolean;
  title?: string;
  hint?: string;
}

/**
 * Plain files and links on a task (reference material, not a submission for approval).
 * Used for personal tasks and for the reference files on a project task.
 */
export function AttachmentsSection({
  attachments,
  onAddLink,
  onAddFile,
  onRemove,
  canRemove,
  title = "Attachments",
  hint,
}: AttachmentsSectionProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [busy, setBusy] = useState<"link" | "file" | string | null>(null);

  const run = async (key: "link" | "file" | string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const addLink = () => {
    const url = linkDraft.trim();
    if (!url) return;
    void run("link", async () => {
      await onAddLink(url);
      setLinkDraft("");
    });
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>

      {attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((a) => {
            const href = a.file_url || a.url || undefined;
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-2 py-1.5">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{a.name}</span>
                  </a>
                ) : (
                  <span className="truncate text-sm">{a.name}</span>
                )}
                {(canRemove ? canRemove(a) : true) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${a.name}`}
                    disabled={busy === a.id}
                    onClick={() => run(a.id, () => onRemove(a.id))}
                  >
                    {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm italic text-muted-foreground">Nothing attached yet.</p>
      )}

      <div className="flex gap-2">
        <Input
          value={linkDraft}
          placeholder="Paste a link"
          className="h-8 flex-1 text-sm"
          onChange={(e) => setLinkDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLink();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          disabled={!linkDraft.trim() || busy === "link"}
          onClick={addLink}
        >
          {busy === "link" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add link
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (fileInput.current) fileInput.current.value = "";
          if (file) void run("file", () => onAddFile(file));
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        disabled={busy === "file"}
        onClick={() => fileInput.current?.click()}
      >
        {busy === "file" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        Upload a file
      </Button>
    </div>
  );
}
